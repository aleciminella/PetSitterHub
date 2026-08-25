const express = require("express");
const reviewController = require("../controllers/reviewController");
const { requireRole, verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/sitters/:sitterId/reviews", reviewController.listSitterReviews);
router.post("/bookings/:bookingId/reviews", verifyToken, requireRole("owner"), reviewController.createReview);

module.exports = router;
