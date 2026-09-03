const express = require("express");
const availabilityController = require("../controllers/availabilityController");
const sitterController = require("../controllers/sitterController");
const { requireRole, verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/me", verifyToken, requireRole("sitter"), sitterController.getMySitterProfile);
router.put("/me", verifyToken, requireRole("sitter"), sitterController.updateMySitterProfile);
router.get("/me/availability", verifyToken, requireRole("sitter"), sitterController.getMyAvailability);
router.put("/me/availability/weekly", verifyToken, requireRole("sitter"), sitterController.updateMyWeeklyAvailability);
router.put("/me/availability/exceptions", verifyToken, requireRole("sitter"), sitterController.updateMyAvailabilityExceptions);
router.get("/me/pet-types", verifyToken, requireRole("sitter"), sitterController.listMyPetTypes);
router.put("/me/pet-types", verifyToken, requireRole("sitter"), sitterController.updateMyPetTypes);
router.get("/me/services", verifyToken, requireRole("sitter"), sitterController.listMyServices);
router.put("/me/services", verifyToken, requireRole("sitter"), sitterController.updateMyServices);
router.get("/:sitterId/availability/slots", availabilityController.listSitterAvailabilitySlots);
router.get("/:sitterId/availability/check", availabilityController.checkSitterAvailability);
router.get("/", sitterController.listSitters);

module.exports = router;
