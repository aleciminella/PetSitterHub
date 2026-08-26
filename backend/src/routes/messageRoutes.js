const express = require("express");
const messageController = require("../controllers/messageController");
const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router({ mergeParams: true });

router.get("/", verifyToken, messageController.listMessages);
router.post("/", verifyToken, messageController.createMessage);

module.exports = router;
