const express = require("express");
const adminController = require("../controllers/adminController");
const { requireRole, verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/overview", verifyToken, requireRole("admin"), adminController.getOverview);
router.get("/bookings", verifyToken, requireRole("admin"), adminController.listBookings);
router.get("/reviews", verifyToken, requireRole("admin"), adminController.listReviews);
router.get("/users", verifyToken, requireRole("admin"), adminController.listUsers);
router.delete("/users/:id", verifyToken, requireRole("admin"), adminController.deleteUser);
router.patch("/users/:id/promote-admin", verifyToken, requireRole("admin"), adminController.promoteUserToAdmin);
router.patch("/sitters/:id/verification", verifyToken, requireRole("admin"), adminController.updateSitterVerification);

module.exports = router;
