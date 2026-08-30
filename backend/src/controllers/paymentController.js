const pool = require("../db/pool");

function createProviderReference(method, bookingId) {
  const prefix = method === "bank_transfer" ? "BONIFICO" : "DEMO";
  return `${prefix}-${Date.now()}-${bookingId}`;
}

function getInitialPaymentStatus(method) {
  if (method === "bank_transfer") {
    return "authorized";
  }

  return "paid";
}

async function createNotification(userId, bookingId, type, title, body) {
  try {
    await pool.query(
      `insert into notifications (user_id, booking_id, type, title, body)
       values ($1, $2, $3, $4, $5)`,
      [userId, bookingId, type, title, body]
    );
  } catch (err) {
    console.error("Errore creazione notifica", err);
  }
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
      `select b.id, b.total_price, b.status, sp.user_id as sitter_user_id
       from bookings b
       join sitter_profiles sp on sp.id = b.sitter_id
       where b.id = $1
         and b.owner_id = $2`,
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
       values ($1, $2, $3, $4, $5)
       returning id, booking_id, amount, method, status, provider_reference, created_at`,
      [
        req.params.bookingId,
        booking.total_price,
        paymentMethod,
        getInitialPaymentStatus(paymentMethod),
        createProviderReference(paymentMethod, req.params.bookingId)
      ]
    );

    const notificationText = paymentMethod === "bank_transfer"
      ? "Il proprietario ha indicato un bonifico. Confermalo quando risulta ricevuto."
      : "Il proprietario ha completato il pagamento demo della prenotazione.";

    await createNotification(
      booking.sitter_user_id,
      booking.id,
      "payment_received",
      paymentMethod === "bank_transfer" ? "Bonifico da confermare" : "Pagamento ricevuto",
      notificationText
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

async function confirmBankTransfer(req, res, next) {
  try {
    const result = await pool.query(
      `update payments pay
       set status = 'paid'
       from bookings b
       join sitter_profiles sp on sp.id = b.sitter_id
       where pay.id = $1
         and pay.booking_id = b.id
         and sp.user_id = $2
         and pay.method = 'bank_transfer'
         and pay.status = 'authorized'
       returning pay.id, pay.booking_id, b.owner_id, pay.amount, pay.method, pay.status, pay.provider_reference, pay.created_at`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Bonifico da confermare non trovato"
      });
    }

    await createNotification(
      result.rows[0].owner_id,
      result.rows[0].booking_id,
      "payment_received",
      "Bonifico confermato",
      "Il sitter ha confermato la ricezione del bonifico."
    );

    return res.json({
      payment: result.rows[0]
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  confirmBankTransfer,
  createPayment
};
