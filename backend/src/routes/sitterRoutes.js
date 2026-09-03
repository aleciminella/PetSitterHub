const express = require("express");
const availabilityController = require("../controllers/availabilityController");
const sitterController = require("../controllers/sitterController");
const { requireRole, verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

// area privata sitter

// Dati personali e Biografia
router.get("/me", verifyToken, requireRole("sitter"), sitterController.getMySitterProfile); // Legge la propria bio di presentazione e la città base
router.put("/me", verifyToken, requireRole("sitter"), sitterController.updateMySitterProfile); // Modifica la bio o la città

// Gli orari e il calendario (Disponibilità)
router.get("/me/availability", verifyToken, requireRole("sitter"), sitterController.getMyAvailability); // Guarda il riepilogo dei suoi orari di lavoro
router.put("/me/availability/weekly", verifyToken, requireRole("sitter"), sitterController.updateMyWeeklyAvailability); // Imposta gli orari fissi settimanali
router.put("/me/availability/exceptions", verifyToken, requireRole("sitter"), sitterController.updateMyAvailabilityExceptions); // Imposta aperture e chiusure speciali

// Animali accettati dal sitter
router.get("/me/pet-types", verifyToken, requireRole("sitter"), sitterController.listMyPetTypes); // Guarda quali animali accetta al momento
router.put("/me/pet-types", verifyToken, requireRole("sitter"), sitterController.updateMyPetTypes); // Aggiorna gli animali accettati

// Prezzi e servizi del sitter
router.get("/me/services", verifyToken, requireRole("sitter"), sitterController.listMyServices); // Restituisce il listino prezzi attuale
router.put("/me/services", verifyToken, requireRole("sitter"), sitterController.updateMyServices); // Modifica i prezzi



// area pubblica sitter (non ci sono verifyToken ne requireRole)
router.get("/:sitterId/availability/slots", availabilityController.listSitterAvailabilitySlots); // Resituisce gli slot disponibili del sitter
router.get("/:sitterId/availability/check", availabilityController.checkSitterAvailability); // Controlla se il sitter è libero o occupato prima di far cliccare su "Conferma prenotazione"
router.get("/", sitterController.listSitters); // Restituisce elenco di tutti i sitter 

module.exports = router;
