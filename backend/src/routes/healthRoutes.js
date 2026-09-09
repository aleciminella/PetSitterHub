const express = require("express");
const pool = require("../db/pool");

const router = express.Router();

router.get("/", (req, res) => { // per confermare che il server web Node.js/Express sia acceso e in grado di rispondere alle richieste HTTP.
  res.json({
    status: "ok",
    service: "PetSitterHub API"
  });
});

router.get("/db", async (req, res) => { // Serve a verificare che le credenziali e la connessione al database SQL siano corrette. es. http://localhost:4000/api/health/db
  const result = await pool.query("select now() as checked_at");

  res.json({
    status: "ok",
    database: "connected",
    checkedAt: result.rows[0].checked_at
  });
});

module.exports = router;
