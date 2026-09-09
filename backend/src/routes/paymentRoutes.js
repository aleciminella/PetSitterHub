const express = require("express");
const paymentController = require("../controllers/paymentController");
const { requireRole, verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/bookings/:bookingId/payments", verifyToken, requireRole("owner"), paymentController.createPayment); // usato per effettuare pagamento demo in owner-dashboard.js in payBooking()
router.patch("/payments/:id/confirm-bank-transfer", verifyToken, requireRole("sitter"), paymentController.confirmBankTransfer); // usato per confermare arrivo bonifico in sitter-dashboard.js in confirmBankTransfer()

module.exports = router;
