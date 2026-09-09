const { after, before, test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const app = require("../src/app");
const pool = require("../src/db/pool");

let server;
let baseUrl;
const createdBookingIds = [];
const createdUserEmails = [];

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  for (const bookingId of createdBookingIds) {
    await pool.query("delete from payments where booking_id = $1", [bookingId]);
    await pool.query("delete from messages where booking_id = $1", [bookingId]);
    await pool.query("delete from notifications where booking_id = $1", [bookingId]);
    await pool.query("delete from bookings where id = $1", [bookingId]);
  }

  for (const email of createdUserEmails) {
    await pool.query("delete from users where email = $1", [email]);
  }

  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await pool.end();
});

async function apiRequest(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method || "GET",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body
  });

  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function login(email, password = "password123") {
  const result = await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });

  assert.equal(result.status, 200);
  return result.body.token;
}

async function registerOwner(label) {
  const email = `test-${label}-${Date.now()}@example.com`;
  const result = await apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: "password123",
      firstName: "Test",
      lastName: label,
      role: "owner",
      city: "Roma"
    })
  });

  assert.equal(result.status, 201);
  createdUserEmails.push(email);
  return result.body;
}

function nextMondayAt(hour) {
  const start = new Date();
  start.setDate(start.getDate() + 180);

  while (start.getDay() !== 1) {
    start.setDate(start.getDate() + 1);
  }

  start.setHours(hour, 0, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);

  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}

test("le API pubbliche restituiscono stato, servizi e sitter", async () => {
  const health = await apiRequest("/health/db");
  assert.equal(health.status, 200);
  assert.equal(health.body.database, "connected");

  const services = await apiRequest("/services");
  assert.equal(services.status, 200);
  assert.ok(services.body.services.some((service) => service.name === "Passeggiata"));

  const sitters = await apiRequest("/sitters");
  assert.equal(sitters.status, 200);
  assert.ok(sitters.body.sitters.some((sitter) => sitter.first_name === "Giulia"));
});

test("registrazione, token e controllo del ruolo funzionano", async () => {
  const registered = await registerOwner("Auth");
  assert.ok(registered.token);
  assert.equal(registered.user.role, "owner");

  const profile = await apiRequest("/auth/profile", { token: registered.token });
  assert.equal(profile.status, 200);
  assert.equal(profile.body.user.email, registered.user.email);

  const forbidden = await apiRequest("/admin/overview", { token: registered.token });
  assert.equal(forbidden.status, 403);

  const missingToken = await apiRequest("/pets");
  assert.equal(missingToken.status, 401);
});

test("un proprietario può creare ed eliminare un animale", async () => {
  const owner = await registerOwner("Pet");

  const created = await apiRequest("/pets", {
    method: "POST",
    token: owner.token,
    body: JSON.stringify({ name: "Animale test", species: "cane", breed: "Meticcio" })
  });
  assert.equal(created.status, 201);

  const deleted = await apiRequest(`/pets/${created.body.pet.id}`, {
    method: "DELETE",
    token: owner.token
  });
  assert.equal(deleted.status, 204);

  const pets = await apiRequest("/pets", { token: owner.token });
  assert.equal(pets.body.pets.some((pet) => pet.id === created.body.pet.id), false);
});

test("una prenotazione passa da pending ad accepted e poi viene pagata", async () => {
  const ownerToken = await login("mario.owner@example.com");
  const sitterToken = await login("giulia.sitter@example.com");

  const pets = await apiRequest("/pets", { token: ownerToken });
  const pet = pets.body.pets.find((item) => item.species === "cane");

  const sitters = await apiRequest("/sitters?petType=cane");
  const sitter = sitters.body.sitters.find((item) => item.first_name === "Giulia");
  const service = sitter.services.find((item) => item.name === "Passeggiata");
  const dates = nextMondayAt(10);

  const created = await apiRequest("/bookings", {
    method: "POST",
    token: ownerToken,
    body: JSON.stringify({
      petId: pet.id,
      sitterId: sitter.id,
      serviceId: service.id,
      ...dates
    })
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.booking.status, "pending");
  createdBookingIds.push(created.body.booking.id);

  const accepted = await apiRequest(`/bookings/${created.body.booking.id}/accept`, {
    method: "PATCH",
    token: sitterToken
  });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.booking.status, "accepted");

  const payment = await apiRequest(`/bookings/${created.body.booking.id}/payments`, {
    method: "POST",
    token: ownerToken,
    body: JSON.stringify({ method: "demo_card" })
  });
  assert.equal(payment.status, 201);
  assert.equal(payment.body.payment.status, "paid");
});

test("la soft delete disattiva l'utente e impedisce nuove operazioni", async () => {
  const adminToken = await login("admin@petsitterhub.it");
  const owner = await registerOwner("Delete");

  const deleted = await apiRequest(`/admin/users/${owner.user.id}`, {
    method: "DELETE",
    token: adminToken
  });
  assert.equal(deleted.status, 204);

  const oldToken = await apiRequest("/auth/profile", { token: owner.token });
  assert.equal(oldToken.status, 401);
  assert.equal(oldToken.body.error, "Account non attivo");

  const promotion = await apiRequest(`/admin/users/${owner.user.id}/promote-admin`, {
    method: "PATCH",
    token: adminToken
  });
  assert.equal(promotion.status, 404);
});
