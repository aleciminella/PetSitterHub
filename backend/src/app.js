process.env.TZ = process.env.TZ || "Europe/Rome";

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

const app = express(); // crea l'oggetto principale dell'applicazione
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5500";

app.use((req, res, next) => { // accetta dati da un'altra porta (i browser per motivi di sicurezza bloccano, CORS)
  res.header("Access-Control-Allow-Origin", frontendOrigin);
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { // Prima di mandare dati, i browser inviano una richiesta chiamata OPTIONS per chiedere se possono comunicare, il server risponde con 204 (procedi).
    return res.sendStatus(204);
  }

  return next();
});

app.use(express.json({ limit: "5mb" })); // i dati viaggiano in formato json, imposta il limite a 5mb


// smistamento delle rotte (associa ad ogni indirizzo url il suo file dedicato)
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


// gestore globale degli errori
app.use((err, req, res, next) => {
  console.error(err); // Stampa l'errore nei log del terminale per lo sviluppatore

  res.status(500).json({
    error: "Internal server error" // Al visitatore restituisce una risposta pulita con codice di errore 500 
  });
});

module.exports = app;
