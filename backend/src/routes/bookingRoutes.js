const express = require("express");
const bookingController = require("../controllers/bookingController");
const { requireRole, verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", verifyToken, bookingController.listBookings);
router.post("/", verifyToken, requireRole("owner"), bookingController.createBooking);

module.exports = router;
