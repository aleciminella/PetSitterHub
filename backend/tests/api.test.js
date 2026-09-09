const { after, before, test } = require("node:test"); // il sistema di test integrato in Node.js.
// test() dichiara un test.
// before() esegue una preparazione prima di tutti i test.
// after() esegue la pulizia finale
const assert = require("node:assert/strict"); // confronta il risultato ottenuto con quello previsto
require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env") }); // carica JWT_SECRET senza sovrascrivere DATABASE_URL passata dal terminale
const app = require("../src/app"); // applicazione Express
const pool = require("../src/db/pool"); // connessione PostgreSQL.

let server;
let baseUrl;
let createdBookingId;

before(async () => {
  server = app.listen(0); // dice al sistema operativo di scegliere automaticamente una porta libera. Questo evita conflitti con il backend eventualmente già acceso sulla porta 4000
  await new Promise((resolve) => server.once("listening", resolve)); // Il test aspetta l’evento listening, recupera la porta scelta e costruisce un indirizzo come: http://127.0.0.1:52143/api
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});


// Dopo tutti i test
after(async () => {
  if (createdBookingId) {
    await pool.query("delete from bookings where id = $1", [createdBookingId]); // Se un test ha registrato un'ID di prenotazione in createdBookingId, esegue una query SQL per eliminarla dal database e lasciare l'ambiente pulito.
  }
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))); // Chiude il server Express
  await pool.end(); // Chiude la connessione PostgreSQL
});



async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || "GET",
    headers: {
      ...(options.json ? { "Content-Type": "application/json" } : {}), // se invia JSON
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) // fornito un token
    },
    body: options.json ? JSON.stringify(options.json) : undefined // Converte l'oggetto JSON del corpo in stringa
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null }; // Legge il corpo della risposta e ne fa il parse in JSON se presente, restituendo un oggetto con lo status HTTP e il body.
}




async function login(email) { // Effettua il login usando un account demo.
  const response = await request("/auth/login", {
    method: "POST",
    json: { email, password: "password123" }
  });
  assert.equal(response.status, 200); // assert.equal(response.status, 200) controlla che il login sia riuscito. Se il server restituisse 401, il test si fermerebbe come fallito.
  return response.body.token; // Alla fine restituisce solamente il token, necessario per le API protette
}


function dateKey(date) { // Utility che converte un oggetto Date nel formato stringa YYYY-MM-DD richiesto dalle API.
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}




// Test 1: API pubbliche

test("le API pubbliche rispondono correttamente", async () => {
  // Chiama tre endpoint che non richiedono autenticazione
  const health = await request("/health/db");
  const services = await request("/services");
  const sitters = await request("/sitters");

  assert.equal(health.body.database, "connected"); // PostgreSQL deve risultare collegato
  assert.ok(services.body.services.length > 0); // Deve esistere almeno un servizio.
  assert.ok(sitters.body.sitters.length > 0); // Deve esistere almeno un sitter configurato.
});




// Test 2: autenticazione e ruoli

test("login, token e ruoli proteggono le API", async () => {
  const ownerToken = await login("mario.owner@example.com"); // Accede come Mario e riceve un token da proprietario.
  const profile = await request("/auth/profile", { token: ownerToken }); // Usa il token per leggere il profilo.
  const forbidden = await request("/admin/overview", { token: ownerToken }); // Prova ad accedere ad una rotta riservata all'admin
  const missingToken = await request("/pets"); // Prova ad accedere agli animali senza inviare alcun token.

  assert.equal(profile.body.user.role, "owner"); // Mario deve essere riconosciuto come owner.
  assert.equal(forbidden.status, 403); // Un proprietario sull’area admin deve ricevere 403 Forbidden.
  assert.equal(missingToken.status, 401); // Una richiesta senza token deve ricevere 401 Unauthorized.
});





// Test 3: flusso prenotazione

test("una richiesta viene accettata, pagata e impedisce la promozione", async () => {
  // Vengono autenticati i tre ruoli:
  const ownerToken = await login("mario.owner@example.com");
  const sitterToken = await login("giulia.sitter@example.com");
  const adminToken = await login("admin@petsitterhub.it");


  const sitterProfile = await request("/auth/profile", { token: sitterToken }); // Serve a recuperare l'ID utente (user.id) del sitter.
  const pets = await request("/pets", { token: ownerToken }); // Serve ad avere l'elenco degli animali reali registrati per Mario.
  const sitters = await request("/sitters?petType=cane"); // Serve per cercare i pet sitter disponibili per i cani.
  const sitter = sitters.body.sitters.find((item) => item.first_name === "Giulia"); // Prende l'oggetto completo del profilo di Giulia (compresi il suo ID sitter e la lista dei suoi servizi).
  const service = sitter.services.find((item) => item.name === "Passeggiata"); // Recupera il service.id necessario per poter poi prenotare quella specifica prestazione.

  const to = new Date();
  to.setDate(to.getDate() + 30); // Prepara un intervallo che va da oggi ai prossimi 30 giorni.

  const availability = await request(`/sitters/${sitter.id}/availability/slots?from=${dateKey(new Date())}&to=${dateKey(to)}&serviceId=${service.id}`); // richiede gli slot di disponibilità del sitter
  const slot = availability.body.days.flatMap((day) => day.slots)[0]; // estrae il primo slot libero disponibile.


  // Invia la richiesta di prenotazione come owner, assegna createdBookingId per la pulizia finale e verifica che lo stato iniziale sia "pending".
  const created = await request("/bookings", {
    method: "POST", token: ownerToken,
    json: { petId: pets.body.pets.find((pet) => pet.species === "cane").id, sitterId: sitter.id, serviceId: service.id, startsAt: slot.startsAt, endsAt: slot.endsAt }
  });
  createdBookingId = created.body.booking.id;
  assert.equal(created.body.booking.status, "pending");

  // Il sitter accetta la richiesta di prenotazione tramite la rotta PATCH /accept.
  const accepted = await request(`/bookings/${createdBookingId}/accept`, { method: "PATCH", token: sitterToken });

  // L'amministratore tenta di promuovere ad Admin il sitter che ha una prenotazione attiva accettata.
  const promotion = await request(`/admin/users/${sitterProfile.body.user.id}/promote-admin`, { method: "PATCH", token: adminToken });

  // Il proprietario effettua il pagamento della prenotazione con il metodo "demo_card".
  const payment = await request(`/bookings/${createdBookingId}/payments`, {
    method: "POST", token: ownerToken, json: { method: "demo_card" }
  });

  assert.equal(accepted.body.booking.status, "accepted"); // La prenotazione deve risultare aggiornata a "accepted".
  assert.equal(promotion.status, 409); // Tentare di promuovere ad admin un sitter con prenotazioni attive/pendenti deve fallire restituendo il codice 409 Conflict
  assert.equal(payment.body.payment.status, "paid"); // Controlla che il pagamento viene registrato con successo con stato "paid".
});
