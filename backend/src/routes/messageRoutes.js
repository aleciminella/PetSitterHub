const express = require("express");
const messageController = require("../controllers/messageController");
const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router({ mergeParams: true });

router.get("/", verifyToken, messageController.listMessages); // utilizzata per caricare i messaggi
router.post("/", verifyToken, messageController.createMessage); // utilizzata per creare messaggi

module.exports = router;
