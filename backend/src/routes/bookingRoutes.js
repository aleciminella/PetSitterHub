const express = require("express");
const bookingController = require("../controllers/bookingController");
const { requireRole, verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", verifyToken, bookingController.listBookings); // utilizzata dagli utenti loggati, restituisce risultati diversi in base a chi la chiama.
router.post("/quote", verifyToken, requireRole("owner"), bookingController.quoteBooking); // rotta per calcolare il prezzo poichè è pericoloso farlo sul frontend. Usata in checkAvailabilityAndQuote() in search.js
router.post("/", verifyToken, requireRole("owner"), bookingController.createBooking); // usata dal proprietario per inviare una prenotazione. Controllo anche lato backend per overlap
router.patch("/:id/accept", verifyToken, requireRole("sitter"), bookingController.acceptBooking); // usata dal sitter per accettare una prenotazione. Controllo lato backend per overlap
router.patch("/:id/reject", verifyToken, requireRole("sitter"), bookingController.rejectBooking); // usata dal sitter per rifiutare una prenotazione
router.patch("/:id/cancel", verifyToken, requireRole("owner"), bookingController.cancelBooking); // usata dal proprietario per annullare una prenotazione
router.patch("/:id/cancel-by-sitter", verifyToken, requireRole("sitter"), bookingController.cancelBookingBySitter); // usata dal sitter per annullare prenotazione


module.exports = router;
