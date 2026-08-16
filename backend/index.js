const express = require("express");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "PetSitterHub API"
  });
});

app.listen(port, () => {
  console.log(`PetSitterHub API listening on port ${port}`);
});
