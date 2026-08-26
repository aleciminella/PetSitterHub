const express = require("express");
const sitterController = require("../controllers/sitterController");
const { requireRole, verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/me", verifyToken, requireRole("sitter"), sitterController.getMySitterProfile);
router.put("/me", verifyToken, requireRole("sitter"), sitterController.updateMySitterProfile);
router.get("/", sitterController.listSitters);

module.exports = router;
