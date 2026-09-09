const express = require("express");
const availabilityController = require("../controllers/availabilityController");
const sitterController = require("../controllers/sitterController");
const { requireRole, verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

// area privata sitter

// Dati personali e Biografia
router.get("/me", verifyToken, requireRole("sitter"), sitterController.getMySitterProfile); // Legge la propria bio di presentazione e la città base. Chiamata in loadProfile() nel file sitter-dashboard.js
router.put("/me", verifyToken, requireRole("sitter"), sitterController.updateMySitterProfile); // Modifica la bio o la città. Chiamata in saveProfile()

// Gli orari e il calendario (Disponibilità)
router.get("/me/availability", verifyToken, requireRole("sitter"), sitterController.getMyAvailability); // Guarda il riepilogo dei suoi orari di lavoro. Chiamata in loadAvaiability ()
router.put("/me/availability/weekly", verifyToken, requireRole("sitter"), sitterController.updateMyWeeklyAvailability); // Imposta gli orari fissi settimanali. Chiamata in saveWeeklyAvailability()
router.put("/me/availability/exceptions", verifyToken, requireRole("sitter"), sitterController.updateMyAvailabilityExceptions); // Imposta aperture e chiusure speciali. Chiamata in saveAvailabilityExceptions()

// Animali accettati dal sitter
router.get("/me/pet-types", verifyToken, requireRole("sitter"), sitterController.listMyPetTypes); // Guarda quali animali accetta al momento. Chiamata in loadPetTypes()
router.put("/me/pet-types", verifyToken, requireRole("sitter"), sitterController.updateMyPetTypes); // Aggiorna gli animali accettati. Chiamata in savePetTypes()

// Prezzi e servizi del sitter
router.get("/me/services", verifyToken, requireRole("sitter"), sitterController.listMyServices); // Restituisce il listino prezzi attuale. Chiamata in loadServices()
router.put("/me/services", verifyToken, requireRole("sitter"), sitterController.updateMyServices); // Modifica i prezzi. Chiamata in saveServices()



// area pubblica sitter (non ci sono verifyToken ne requireRole). Usati in search.js
router.get("/:sitterId/availability/slots", availabilityController.listSitterAvailabilitySlots); // chiede a bookingService di calcolare gli slot disponibili del sitter e li restituisce. Chiamata in loadAvailabilitySlots()
router.get("/", sitterController.listSitters); // Restituisce elenco di tutti i sitter. Chiamata in loadSitter()

// il calcolo degli slot avviene sempre con la chimata api GET /api/sitters/:sitterId/availability/slots. ListSitterAvailabilitySlots() chiede a bookingService di calcolare gli slot.
// Quando avviene il calcolo degli slot in booking service cerca tutte le prenotazioni accepted e in base alla tipologia di servizio (bloccante o meno) restituisce gli slot


// FLUSSO

// listSitterAvailabilitySlots() chiama getServiceAvailabilityMode() per recuperare la modalità del servizio richiesto: hourly_slot, fixed_slot, daily_exclusive oppure daily_non_exclusive.

// listSitterAvailabilitySlots() chiama listAvailableSlots() del bookingService che coordina tutto il calcolo dei giorni e degli orari disponibili.
    // listAvailableSlots() chiama loadScheduleAndAcceptedBookings() per caricare dal database la disponibilità settimanale, le eventuali eccezioni e le prenotazioni accepted del sitter comprese nel periodo richiesto.
    // listAvailableSlots() chiama getAvailabilityForDate() per ogni giorno per decidere quale disponibilità applicare: l'eccezione specifica, se presente, oppure il normale orario settimanale del sitter.
    // listAvailableSlots() chiama slotConflictsWithAccepted() per ogni slot generato per verificare se l'intervallo si sovrappone a una prenotazione accepted incompatibile.
        // slotConflictsWithAccepted() chiama getConflictAvailabilityModes() per conoscere quali modalità di servizio entrano in conflitto con quella richiesta e stabilire quindi se lo slot debba essere escluso dalla risposta

// Infine listAvailableSlots() restituisce al controller solamente i giorni e gli slot non passati, compatibili con gli orari e non già occupati.


module.exports = router;
