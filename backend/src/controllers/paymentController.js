const pool = require("../db/pool");

function createProviderReference(method, bookingId) {
  const prefix = method === "bank_transfer" ? "BONIFICO" : "DEMO";
  return `${prefix}-${Date.now()}-${bookingId}`;
}

async function createPayment(req, res, next) {
  try {
    const { method } = req.body;
    const paymentMethod = method || "demo_card";

    if (!["demo_card", "bank_transfer"].includes(paymentMethod)) {
      return res.status(400).json({
        error: "Metodo di pagamento non valido"
      });
    }

    const bookingResult = await pool.query(
      `select id, total_price, status
       from bookings
       where id = $1
         and owner_id = $2`,
      [req.params.bookingId, req.user.id]
    );

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({
        error: "Prenotazione non trovata"
      });
    }

    const booking = bookingResult.rows[0];

    if (booking.status !== "accepted") {
      return res.status(400).json({
        error: "Pagamento disponibile solo dopo l'accettazione del sitter"
      });
    }

    const result = await pool.query(
      `insert into payments (booking_id, amount, method, status, provider_reference)
       values ($1, $2, $3, 'paid', $4)
       returning id, booking_id, amount, method, status, provider_reference, created_at`,
      [
        req.params.bookingId,
        booking.total_price,
        paymentMethod,
        createProviderReference(paymentMethod, req.params.bookingId)
      ]
    );

    return res.status(201).json({
      payment: result.rows[0]
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({
        error: "Pagamento già registrato per questa prenotazione"
      });
    }

    return next(err);
  }
}

module.exports = {
  createPayment
};
