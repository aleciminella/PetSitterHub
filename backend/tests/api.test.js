const { after, before, test } = require("node:test");
const assert = require("node:assert/strict");
const app = require("../src/app");
const pool = require("../src/db/pool");

let server;
let baseUrl;
let createdBookingId;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  if (createdBookingId) {
    await pool.query("delete from bookings where id = $1", [createdBookingId]);
  }
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  await pool.end();
});

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || "GET",
    headers: {
      ...(options.json ? { "Content-Type": "application/json" } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: options.json ? JSON.stringify(options.json) : undefined
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function login(email) {
  const response = await request("/auth/login", {
    method: "POST",
    json: { email, password: "password123" }
  });
  assert.equal(response.status, 200);
  return response.body.token;
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

test("le API pubbliche rispondono correttamente", async () => {
  const health = await request("/health/db");
  const services = await request("/services");
  const sitters = await request("/sitters");

  assert.equal(health.body.database, "connected");
  assert.ok(services.body.services.length > 0);
  assert.ok(sitters.body.sitters.length > 0);
});

test("login, token e ruoli proteggono le API", async () => {
  const ownerToken = await login("mario.owner@example.com");
  const profile = await request("/auth/profile", { token: ownerToken });
  const forbidden = await request("/admin/overview", { token: ownerToken });
  const missingToken = await request("/pets");

  assert.equal(profile.body.user.role, "owner");
  assert.equal(forbidden.status, 403);
  assert.equal(missingToken.status, 401);
});

test("una richiesta viene accettata, pagata e impedisce la promozione", async () => {
  const ownerToken = await login("mario.owner@example.com");
  const sitterToken = await login("giulia.sitter@example.com");
  const adminToken = await login("admin@petsitterhub.it");
  const sitterProfile = await request("/auth/profile", { token: sitterToken });
  const pets = await request("/pets", { token: ownerToken });
  const sitters = await request("/sitters?petType=cane");
  const sitter = sitters.body.sitters.find((item) => item.first_name === "Giulia");
  const service = sitter.services.find((item) => item.name === "Passeggiata");
  const to = new Date();
  to.setDate(to.getDate() + 30);
  const availability = await request(`/sitters/${sitter.id}/availability/slots?from=${dateKey(new Date())}&to=${dateKey(to)}&serviceId=${service.id}`);
  const slot = availability.body.days.flatMap((day) => day.slots)[0];
  const created = await request("/bookings", {
    method: "POST", token: ownerToken,
    json: { petId: pets.body.pets.find((pet) => pet.species === "cane").id, sitterId: sitter.id, serviceId: service.id, startsAt: slot.startsAt, endsAt: slot.endsAt }
  });
  createdBookingId = created.body.booking.id;
  assert.equal(created.body.booking.status, "pending");

  const accepted = await request(`/bookings/${createdBookingId}/accept`, { method: "PATCH", token: sitterToken });
  const promotion = await request(`/admin/users/${sitterProfile.body.user.id}/promote-admin`, { method: "PATCH", token: adminToken });
  const payment = await request(`/bookings/${createdBookingId}/payments`, {
    method: "POST", token: ownerToken, json: { method: "demo_card" }
  });
  assert.equal(accepted.body.booking.status, "accepted");
  assert.equal(promotion.status, 409);
  assert.equal(payment.body.payment.status, "paid");
});
