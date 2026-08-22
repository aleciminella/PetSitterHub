const express = require("express");
const petController = require("../controllers/petController");
const { requireRole, verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", verifyToken, requireRole("owner"), petController.listPets);

module.exports = router;
