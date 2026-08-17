const express = require("express");
const serviceController = require("../controllers/serviceController");

const router = express.Router();

router.get("/", serviceController.listServices);

module.exports = router;
