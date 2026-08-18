const express = require("express");
const authRoutes = require("./routes/authRoutes");
const healthRoutes = require("./routes/healthRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const sitterRoutes = require("./routes/sitterRoutes");

const app = express();

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/sitters", sitterRoutes);

app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    error: "Internal server error"
  });
});

module.exports = app;
