const pool = require("../db/pool");

async function createNotification({ userId, bookingId, type, title, body }) {
  await pool.query(
    `insert into notifications (user_id, booking_id, type, title, body)
     values ($1, $2, $3, $4, $5)`,
    [userId, bookingId || null, type, title, body]
  );
}

module.exports = {
  createNotification
};
