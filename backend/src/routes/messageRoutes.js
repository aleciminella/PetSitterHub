const express = require("express");
const messageController = require("../controllers/messageController");
const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router({ mergeParams: true });

router.get("/unread-count", verifyToken, messageController.countUnreadMessages);
router.get("/", verifyToken, messageController.listMessages);
router.post("/", verifyToken, messageController.createMessage);

module.exports = router;
