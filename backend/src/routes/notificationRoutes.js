const express = require("express");
const notificationController = require("../controllers/notificationController");
const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", verifyToken, notificationController.listNotifications);
router.patch("/read-all", verifyToken, notificationController.markAllNotificationsAsRead);
router.patch("/:id/read", verifyToken, notificationController.markNotificationAsRead);
router.delete("/", verifyToken, notificationController.deleteAllNotifications);
router.delete("/:id", verifyToken, notificationController.deleteNotification);

module.exports = router;
