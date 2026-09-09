const express = require("express");
const serviceController = require("../controllers/serviceController");

const router = express.Router();

router.get("/", serviceController.listServices); // restituisce tutti i servizi. Chiamata in loadServices() in search.js e in services-page.js

module.exports = router;
