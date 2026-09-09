const express = require("express");
const reviewController = require("../controllers/reviewController");
const { requireRole, verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/sitters/:sitterId/reviews", reviewController.listSitterReviews); // utilizzato in  search.js in showReviews()
router.post("/bookings/:bookingId/reviews", verifyToken, requireRole("owner"), reviewController.createReview); // utilizzata dal proprietario per creare recensione in sendReview()
router.put("/reviews/:reviewId", verifyToken, requireRole("owner"), reviewController.updateReview); // utilizzata dal proprietario per modificare recensione in sendReview()

module.exports = router;
