const { after, before, describe, test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

require("dotenv").config({
  path: path.join(__dirname, "..", ".env")
});

const app = require("../src/app");
const pool = require("../src/db/pool");

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}/api`;
});

after(async () => {
  await cleanupCreatedBookings();
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await pool.end();
});

async function apiRequest(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  return {
    body,
    response,
    status: response.status
  };
}

async function login(email, password = "password123") {
  const { body, status } = await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });

  assert.equal(status, 200);
  assert.ok(body.token);
  assert.equal(body.user.email, email);

  return body.token;
}

const createdBookingIds = [];

function nextAvailableMondayAt(hour, durationHours = 1) {
  const date = new Date();
  date.setDate(date.getDate() + 180);

  while (date.getDay() !== 1) {
    date.setDate(date.getDate() + 1);
  }

  date.setHours(hour, 0, 0, 0);

  const end = new Date(date);
  end.setHours(hour + durationHours, 0, 0, 0);

  return {
    startsAt: date.toISOString(),
    endsAt: end.toISOString()
  };
}

async function getDemoBookingInput(ownerToken) {
  const pets = await apiRequest("/pets", {
    token: ownerToken
  });
  assert.equal(pets.status, 200);

  const pet = pets.body.pets.find((item) => item.species === "cane");
  assert.ok(pet);

  const sitters = await apiRequest("/sitters?petType=cane");
  assert.equal(sitters.status, 200);

  const sitter = sitters.body.sitters.find((item) => item.first_name === "Giulia");
  assert.ok(sitter);

  const service = sitter.services.find((item) => item.name === "Passeggiata");
  assert.ok(service);

  return {
    petId: pet.id,
    serviceId: service.id,
    sitterId: sitter.id
  };
}

async function createDemoBooking(ownerToken, hour = 10) {
  const bookingInput = await getDemoBookingInput(ownerToken);
  const bookingDates = nextAvailableMondayAt(hour);

  const created = await apiRequest("/bookings", {
    method: "POST",
    token: ownerToken,
    body: JSON.stringify({
      ...bookingInput,
      ...bookingDates,
      notes: "Prenotazione creata da test automatico."
    })
  });

  assert.equal(created.status, 201);
  createdBookingIds.push(created.body.booking.id);

  return {
    booking: created.body.booking,
    input: bookingInput,
    dates: bookingDates
  };
}

async function cleanupCreatedBookings() {
  for (const bookingId of createdBookingIds.splice(0)) {
    await pool.query("delete from reviews where booking_id = $1", [bookingId]);
    await pool.query("delete from payments where booking_id = $1", [bookingId]);
    await pool.query("delete from messages where booking_id = $1", [bookingId]);
    await pool.query("delete from notifications where booking_id = $1", [bookingId]);
    await pool.query("delete from bookings where id = $1", [bookingId]);
  }
}

describe("API pubbliche", () => {
  test("health e health/db rispondono correttamente", async () => {
    const health = await apiRequest("/health");
    assert.equal(health.status, 200);
    assert.equal(health.body.status, "ok");

    const database = await apiRequest("/health/db");
    assert.equal(database.status, 200);
    assert.equal(database.body.database, "connected");
  });

  test("servizi e sitter pubblici sono disponibili", async () => {
    const services = await apiRequest("/services");
    assert.equal(services.status, 200);
    assert.ok(Array.isArray(services.body.services));
    assert.ok(services.body.services.some((service) => service.name === "Passeggiata"));

    const sitters = await apiRequest("/sitters");
    assert.equal(sitters.status, 200);
    assert.ok(Array.isArray(sitters.body.sitters));
    assert.ok(sitters.body.sitters.some((sitter) => sitter.first_name === "Giulia"));
  });
});

describe("Autenticazione e ruoli", () => {
  test("login corretto restituisce utente e token", async () => {
    const { body, status } = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "mario.owner@example.com",
        password: "password123"
      })
    });

    assert.equal(status, 200);
    assert.ok(body.token);
    assert.equal(body.user.role, "owner");
  });

  test("login con password errata viene bloccato", async () => {
    const { body, status } = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "mario.owner@example.com",
        password: "password-sbagliata"
      })
    });

    assert.equal(status, 401);
    assert.equal(body.error, "Credenziali non valide");
  });

  test("un sitter non può usare le API degli animali del proprietario", async () => {
    const sitterToken = await login("giulia.sitter@example.com");
    const { body, status } = await apiRequest("/pets", {
      token: sitterToken
    });

    assert.equal(status, 403);
    assert.equal(body.error, "Operazione non autorizzata");
  });

  test("un proprietario non può usare le API admin", async () => {
    const ownerToken = await login("mario.owner@example.com");
    const { body, status } = await apiRequest("/admin/overview", {
      token: ownerToken
    });

    assert.equal(status, 403);
    assert.equal(body.error, "Operazione non autorizzata");
  });

  test("un admin può leggere la panoramica", async () => {
    const adminToken = await login("admin@petsitterhub.it");
    const { body, status } = await apiRequest("/admin/overview", {
      token: adminToken
    });

    assert.equal(status, 200);
    assert.ok(body.overview);
    assert.ok(Number(body.overview.total_users) >= 1);
  });
});

describe("Animali proprietario", () => {
  test("un proprietario può leggere, creare, modificare ed eliminare un animale", async () => {
    const ownerToken = await login("mario.owner@example.com");

    const list = await apiRequest("/pets", {
      token: ownerToken
    });
    assert.equal(list.status, 200);
    assert.ok(Array.isArray(list.body.pets));

    const petName = `Test automatico ${Date.now()}`;
    const created = await apiRequest("/pets", {
      method: "POST",
      token: ownerToken,
      body: JSON.stringify({
        name: petName,
        species: "cane",
        breed: "Meticcio",
        age: 3,
        notes: "Creato da test automatico."
      })
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.pet.name, petName);

    const petId = created.body.pet.id;
    const updated = await apiRequest(`/pets/${petId}`, {
      method: "PUT",
      token: ownerToken,
      body: JSON.stringify({
        name: `${petName} modificato`,
        species: "cane",
        breed: "Meticcio",
        age: 4,
        notes: "Modificato da test automatico."
      })
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.pet.age, 4);

    const deleted = await apiRequest(`/pets/${petId}`, {
      method: "DELETE",
      token: ownerToken
    });
    assert.equal(deleted.status, 204);
    assert.equal(deleted.body, null);
  });
});

describe("Prenotazioni, pagamenti e messaggi", () => {
  test("un proprietario crea una richiesta e il sitter può accettarla", async () => {
    const ownerToken = await login("mario.owner@example.com");
    const sitterToken = await login("giulia.sitter@example.com");
    const { booking, input, dates } = await createDemoBooking(ownerToken, 10);

    assert.equal(booking.status, "pending");
    assert.ok(Number(booking.total_price) > 0);

    const forbiddenAccept = await apiRequest(`/bookings/${booking.id}/accept`, {
      method: "PATCH",
      token: ownerToken
    });
    assert.equal(forbiddenAccept.status, 403);

    const accepted = await apiRequest(`/bookings/${booking.id}/accept`, {
      method: "PATCH",
      token: sitterToken
    });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.booking.status, "accepted");

    const overlap = await apiRequest("/bookings", {
      method: "POST",
      token: ownerToken,
      body: JSON.stringify({
        ...input,
        ...dates,
        notes: "Prenotazione sovrapposta da bloccare."
      })
    });
    assert.equal(overlap.status, 409);
    assert.equal(overlap.body.error, "Sitter non disponibile nell'orario selezionato");
  });

  test("il pagamento è possibile solo dopo l'accettazione del sitter", async () => {
    const ownerToken = await login("mario.owner@example.com");
    const sitterToken = await login("giulia.sitter@example.com");
    const { booking } = await createDemoBooking(ownerToken, 11);

    const blockedPayment = await apiRequest(`/bookings/${booking.id}/payments`, {
      method: "POST",
      token: ownerToken,
      body: JSON.stringify({ method: "demo_card" })
    });
    assert.equal(blockedPayment.status, 400);
    assert.equal(blockedPayment.body.error, "Pagamento disponibile solo dopo l'accettazione del sitter");

    const accepted = await apiRequest(`/bookings/${booking.id}/accept`, {
      method: "PATCH",
      token: sitterToken
    });
    assert.equal(accepted.status, 200);

    const paid = await apiRequest(`/bookings/${booking.id}/payments`, {
      method: "POST",
      token: ownerToken,
      body: JSON.stringify({ method: "demo_card" })
    });
    assert.equal(paid.status, 201);
    assert.equal(paid.body.payment.status, "paid");
    assert.equal(paid.body.payment.method, "demo_card");
  });

  test("i messaggi di una prenotazione aggiornano il conteggio dei non letti", async () => {
    const ownerToken = await login("mario.owner@example.com");
    const sitterToken = await login("giulia.sitter@example.com");
    const { booking } = await createDemoBooking(ownerToken, 12);

    const unreadBefore = await apiRequest("/messages/unread-count", {
      token: sitterToken
    });
    assert.equal(unreadBefore.status, 200);

    const sent = await apiRequest(`/bookings/${booking.id}/messages`, {
      method: "POST",
      token: ownerToken,
      body: JSON.stringify({
        body: "Ciao, questo messaggio arriva da un test automatico."
      })
    });
    assert.equal(sent.status, 201);

    const unreadAfterSend = await apiRequest("/messages/unread-count", {
      token: sitterToken
    });
    assert.equal(unreadAfterSend.status, 200);
    assert.ok(unreadAfterSend.body.unreadCount >= unreadBefore.body.unreadCount + 1);

    const messages = await apiRequest(`/bookings/${booking.id}/messages`, {
      token: sitterToken
    });
    assert.equal(messages.status, 200);
    assert.ok(messages.body.messages.some((message) => message.body.includes("test automatico")));

    const unreadAfterRead = await apiRequest("/messages/unread-count", {
      token: sitterToken
    });
    assert.equal(unreadAfterRead.status, 200);
    assert.ok(unreadAfterRead.body.unreadCount < unreadAfterSend.body.unreadCount);
  });
});

