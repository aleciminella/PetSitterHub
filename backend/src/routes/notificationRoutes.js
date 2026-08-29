const express = require("express");
const notificationController = require("../controllers/notificationController");
const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", verifyToken, notificationController.listNotifications);

module.exports = router;
