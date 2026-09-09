const express = require("express");
const notificationController = require("../controllers/notificationController");
const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", verifyToken, notificationController.listNotifications); // usato in loadNavbarBadge() in app.js per pallino notifica in navbar e nella funzione loadNotifications() sia in owner-dashboard.js che in sitter-dashboard.js

// usate in owner-dashboard.js e sitter-dashboard.js (guardare in sitter per commenti)
router.patch("/read-all", verifyToken, notificationController.markAllNotificationsAsRead); // cambia valore is_read
router.patch("/:id/read", verifyToken, notificationController.markNotificationAsRead); // cambia valore is_read nella notifica con id passato
router.delete("/", verifyToken, notificationController.deleteAllNotifications); // elimina tutte le notifiche
router.delete("/:id", verifyToken, notificationController.deleteNotification); // elimina una notifica

module.exports = router;
