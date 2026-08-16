const express = require("express");

const app = express();
const port = 3000;

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "PetSitterHub API"
  });
});

app.listen(port, () => {
  console.log(`PetSitterHub API listening on port ${port}`);
});
