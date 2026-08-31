const express = require("express");
const adminController = require("../controllers/adminController");
const { requireRole, verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/overview", verifyToken, requireRole("admin"), adminController.getOverview);

module.exports = router;
