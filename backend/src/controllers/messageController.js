const pool = require("../db/pool");

async function findAccessibleBooking(bookingId, user) {
  const result = await pool.query(
    `select b.id
     from bookings b
     left join sitter_profiles sp on sp.id = b.sitter_id
     where b.id = $1
       and (
         b.owner_id = $2
         or sp.user_id = $2
       )`,
    [bookingId, user.id]
  );

  return result.rows[0];
}

async function listMessages(req, res, next) {
  try {
    const booking = await findAccessibleBooking(req.params.bookingId, req.user);

    if (!booking) {
      return res.status(404).json({
        error: "Prenotazione non trovata"
      });
    }

    const result = await pool.query(
      `select
         m.id,
         m.body,
         m.sent_at,
         u.id as sender_id,
         u.first_name as sender_first_name,
         u.last_name as sender_last_name,
         u.role as sender_role
       from messages m
       join users u on u.id = m.sender_id
       where m.booking_id = $1
       order by m.sent_at asc`,
      [req.params.bookingId]
    );

    return res.json({
      messages: result.rows
    });
  } catch (err) {
    return next(err);
  }
}

async function createMessage(req, res, next) {
  try {
    const { body } = req.body;

    if (!body || body.trim().length === 0) {
      return res.status(400).json({
        error: "Messaggio obbligatorio"
      });
    }

    const booking = await findAccessibleBooking(req.params.bookingId, req.user);

    if (!booking) {
      return res.status(404).json({
        error: "Prenotazione non trovata"
      });
    }

    const result = await pool.query(
      `insert into messages (booking_id, sender_id, body)
       values ($1, $2, $3)
       returning id, booking_id, sender_id, body, sent_at`,
      [req.params.bookingId, req.user.id, body.trim()]
    );

    return res.status(201).json({
      message: result.rows[0]
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createMessage,
  listMessages
};
