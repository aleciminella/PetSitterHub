const express = require("express");
const adminController = require("../controllers/adminController");
const { requireRole, verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/overview", verifyToken, requireRole("admin"), adminController.getOverview); // usata in loadAdminOverview() in admin-dashboard.js. Restituisce panoramica (utenti attivi, sitter, prenotazioni totali, prenotazioni pending, ecc..). Il frontend trasforma i valori nei riquadri statistici.
router.get("/bookings", verifyToken, requireRole("admin"), adminController.listBookings); // restituisce prenotazioni dalla più recente creata. Usata in loadAdminBookings() in admin-dashboard.js (limit indica quanti risultati restituire, offset quanti saltarne).
router.get("/reviews", verifyToken, requireRole("admin"), adminController.listReviews); // restituisce elenco recensioni dalla più recente. Usata in loadAdminReviews() in admin-dashboard.js.
router.get("/users", verifyToken, requireRole("admin"), adminController.listUsers); // restituisce elenco utenti attivi. Usata in admin-dashboard.js nel metodo loadAdminUsers().
router.delete("/users/:id", verifyToken, requireRole("admin"), adminController.deleteUser); // fa una soft deletion applicando is_active = false. Usata in admin-dashboard.js nel metodo deleteUser(). In adminController gestisce prenotazioni e rimborsi.
router.patch("/users/:id/promote-admin", verifyToken, requireRole("admin"), adminController.promoteUserToAdmin); // usata per promuovere a ruolo admin in admin-dashboard.js nel metodo promoteUserToAdmin().
router.patch("/sitters/:id/verification", verifyToken, requireRole("admin"), adminController.updateSitterVerification); // usata per verificare un sitter in admin-dashboard.js nel metodo promoteUserToAdmin().

module.exports = router;
