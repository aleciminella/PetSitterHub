const pool = require("../db/pool");

async function findAccessibleBooking(bookingId, user) {
  const result = await pool.query(
    `select b.id, b.owner_id, sp.user_id as sitter_user_id
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

async function createNotification(userId, bookingId, title, body) {
  await pool.query(
    `insert into notifications (user_id, booking_id, type, title, body)
     values ($1, $2, 'message_received', $3, $4)`,
    [userId, bookingId, title, body]
  );
}

async function listMessages(req, res, next) {
  try {
    const booking = await findAccessibleBooking(req.params.bookingId, req.user);

    if (!booking) {
      return res.status(404).json({
        error: "Prenotazione non trovata"
      });
    }

    await pool.query(
      `update messages
       set read_at = now()
       where booking_id = $1
         and sender_id <> $2
         and read_at is null`,
      [req.params.bookingId, req.user.id]
    );

    const result = await pool.query(
      `select
         m.id,
         m.body,
         m.sent_at,
         m.read_at,
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

async function countUnreadMessages(req, res, next) {
  try {
    const result = await pool.query(
      `select count(*)::integer as unread_count
       from messages m
       join bookings b on b.id = m.booking_id
       left join sitter_profiles sp on sp.id = b.sitter_id
       where m.sender_id <> $1
         and m.read_at is null
         and (
           b.owner_id = $1
           or sp.user_id = $1
         )`,
      [req.user.id]
    );

    return res.json({
      unreadCount: result.rows[0].unread_count
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

    const receiverId = Number(req.user.id) === Number(booking.owner_id)
      ? booking.sitter_user_id
      : booking.owner_id;

    await createNotification(
      receiverId,
      booking.id,
      "Nuovo messaggio",
      "Hai ricevuto un nuovo messaggio su una prenotazione."
    );

    return res.status(201).json({
      message: result.rows[0]
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  countUnreadMessages,
  createMessage,
  listMessages
};
