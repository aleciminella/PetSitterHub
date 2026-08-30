const pool = require("../db/pool");

async function createNotification(userId, bookingId, title, body) {
  await pool.query(
    `insert into notifications (user_id, booking_id, type, title, body)
     values ($1, $2, 'review_received', $3, $4)`,
    [userId, bookingId, title, body]
  );
}

async function listSitterReviews(req, res, next) {
  try {
    const result = await pool.query(
      `select
         r.id,
         r.rating,
         r.comment,
         r.created_at,
         u.first_name as owner_first_name,
         u.last_name as owner_last_name
       from reviews r
       join users u on u.id = r.owner_id
       where r.sitter_id = $1
       order by r.created_at desc`,
      [req.params.sitterId]
    );

    return res.json({
      reviews: result.rows
    });
  } catch (err) {
    return next(err);
  }
}

async function createReview(req, res, next) {
  try {
    const { rating, comment } = req.body;
    const parsedRating = Number(rating);

    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({
        error: "Valutazione non valida"
      });
    }

    const bookingResult = await pool.query(
      `select b.id, b.sitter_id, sp.user_id as sitter_user_id
       from bookings b
       join sitter_profiles sp on sp.id = b.sitter_id
       where b.id = $1
         and owner_id = $2
         and b.status = 'completed'`,
      [req.params.bookingId, req.user.id]
    );

    if (bookingResult.rows.length === 0) {
      return res.status(400).json({
        error: "Recensione disponibile solo per prenotazioni completate"
      });
    }

    const booking = bookingResult.rows[0];

    const result = await pool.query(
      `insert into reviews (booking_id, owner_id, sitter_id, rating, comment)
       values ($1, $2, $3, $4, $5)
       returning id, booking_id, owner_id, sitter_id, rating, comment, created_at`,
      [
        req.params.bookingId,
        req.user.id,
        booking.sitter_id,
        parsedRating,
        comment || null
      ]
    );

    await createNotification(
      booking.sitter_user_id,
      booking.id,
      "Nuova recensione ricevuta",
      `Hai ricevuto una recensione da ${parsedRating} stelle.`
    );

    return res.status(201).json({
      review: result.rows[0]
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({
        error: "Recensione già inserita per questa prenotazione"
      });
    }

    return next(err);
  }
}

module.exports = {
  createReview,
  listSitterReviews
};
