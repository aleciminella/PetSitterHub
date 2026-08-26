const express = require("express");
const paymentController = require("../controllers/paymentController");
const { requireRole, verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/bookings/:bookingId/payments", verifyToken, requireRole("owner"), paymentController.createPayment);

module.exports = router;
