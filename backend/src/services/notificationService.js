const pool = require("../db/pool");

// usato da varie parti come in messageController per i messaggi, in paymentController per notifiche sui pagamenti ecc..
async function createNotification({ userId, bookingId, type, title, body }) { // Questo codice è il modulo helper che gestisce la creazione delle notifiche all'interno del database
  await pool.query(
    `insert into notifications (user_id, booking_id, type, title, body)
     values ($1, $2, $3, $4, $5)`,
    [userId, bookingId || null, type, title, body]
  );
}

module.exports = {
  createNotification
};
