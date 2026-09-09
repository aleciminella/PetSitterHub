// Rotte autenticazione (login, registrazione, richiesta dati profilo dopo autenticazione)

const express = require("express");
const authController = require("../controllers/authController");
const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/profile", verifyToken, authController.getProfile); // Utilizzato in validateSavedSession() in app.js per verificare se il token è ancora valido (ptenzialmente può restituire dati utente ma al momento viene usata solo come controllo)
router.post("/register", authController.register);
router.post("/login", authController.login);


// Dopo registrazione o login, auth.js salva utente e token nel localStorage.
// Quando il frontend chiama un'API privata, recupera il token e lo invia nell'header Authorization.
// Nel backend verifyToken controlla firma, scadenza e account associato.
// Se il token manca, è scaduto o non è valido, il backend restituisce 401.
// app.js (per navbar) chiama /api/auth/profile a ogni caricamento di pagina per verificare la sessione.
// Se riceve 401 o 404, elimina la sessione locale ed effettua il logout.

module.exports = router;
