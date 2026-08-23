const express = require("express");
const petController = require("../controllers/petController");
const { requireRole, verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", verifyToken, requireRole("owner"), petController.listPets);
router.post("/", verifyToken, requireRole("owner"), petController.createPet);
router.put("/:id", verifyToken, requireRole("owner"), petController.updatePet);

module.exports = router;
