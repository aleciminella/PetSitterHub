// Rotte autenticazione (login, registrazione, richiesta dati profilo dopo autenticazione)

const express = require("express");
const authController = require("../controllers/authController");
const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/profile", verifyToken, authController.getProfile); // con get chiedo dati dal server
router.post("/register", authController.register); // con post invio dati al server
router.post("/login", authController.login);

module.exports = router;
