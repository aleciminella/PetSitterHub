const express = require("express");
const petController = require("../controllers/petController");
const { requireRole, verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();


// viene verificato il token e che si ha il ruolo owner
router.get("/", verifyToken, requireRole("owner"), petController.listPets); // usato dal proprietario per vedere i suoi animali
router.post("/", verifyToken, requireRole("owner"), petController.createPet); // usato dal proprietario per creare un animale
router.delete("/:id", verifyToken, requireRole("owner"), petController.deletePet); // usato dal proprietario per eliminare animale

module.exports = router;
