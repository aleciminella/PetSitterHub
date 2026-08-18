const express = require("express");
const sitterController = require("../controllers/sitterController");

const router = express.Router();

router.get("/", sitterController.listSitters);

module.exports = router;
