const express = require("express");
const authController = require("../controllers/authController");
const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/profile", verifyToken, authController.getProfile);
router.post("/register", authController.register);
router.post("/login", authController.login);

module.exports = router;
