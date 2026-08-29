const express = require("express");
const bookingController = require("../controllers/bookingController");
const { requireRole, verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", verifyToken, bookingController.listBookings);
router.post("/", verifyToken, requireRole("owner"), bookingController.createBooking);
router.patch("/:id/accept", verifyToken, requireRole("sitter"), bookingController.acceptBooking);
router.patch("/:id/reject", verifyToken, requireRole("sitter"), bookingController.rejectBooking);
router.patch("/:id/cancel", verifyToken, requireRole("owner"), bookingController.cancelBooking);
router.patch("/:id/cancel-by-sitter", verifyToken, requireRole("sitter"), bookingController.cancelBookingBySitter);

module.exports = router;
