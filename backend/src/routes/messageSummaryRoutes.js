const express = require("express");
const messageController = require("../controllers/messageController");
const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/unread-count", verifyToken, messageController.countUnreadMessages); // utilizzato da app.js per vedere se necessario il pallino notifiche se ci sono messaggi non letti

module.exports = router;
