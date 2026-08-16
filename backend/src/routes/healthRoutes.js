const express = require("express");
const pool = require("../db/pool");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "PetSitterHub API"
  });
});

router.get("/db", async (req, res) => {
  const result = await pool.query("select now() as checked_at");

  res.json({
    status: "ok",
    database: "connected",
    checkedAt: result.rows[0].checked_at
  });
});

module.exports = router;
