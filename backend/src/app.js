const express = require("express");
const adminRoutes = require("./routes/adminRoutes");
const authRoutes = require("./routes/authRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const healthRoutes = require("./routes/healthRoutes");
const messageRoutes = require("./routes/messageRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const petRoutes = require("./routes/petRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const sitterRoutes = require("./routes/sitterRoutes");

const app = express();
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5500";

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", frontendOrigin);
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  return next();
});

app.use(express.json({ limit: "5mb" }));

app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/bookings/:bookingId/messages", messageRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/pets", petRoutes);
app.use("/api", paymentRoutes);
app.use("/api", reviewRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/sitters", sitterRoutes);

app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    error: "Internal server error"
  });
});

module.exports = app;
