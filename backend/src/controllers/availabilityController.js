const {
  getServiceAvailabilityMode,
  listAvailableSlots
} = require("../services/bookingService");

const MAX_SLOT_RANGE_DAYS = 31; // Tetto massimo: non si possono chiedere gli orari liberi per più di 31 giorni alla volta

function parseDateParam(value) { // Prende una data scritta come testo e la trasforma in un vero oggetto data che JavaScript può manipolare
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) { // Se un utente scrive nell'indirizzo una data finta che non esiste (come "2025-02-31" o "ciao"), JavaScript non riesce a calcolare i millisecondi (getTime() restituisce NaN = Not a Number). La funzione se ne accorge e restituisce null (data non valida).
    return null;
  }

  return date;
}

function endOfDay(date) { // Questa funzione prende il giorno e sposta l'orologio all'ultimo istante della giornata (quando vengono chiesti ad esempio gli orari liberi "fino al 15 Marzo", non intendi fino alla mezzanotte tra il 14 e il 15, ma intendi fino alla fine del 15 Marzo)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

async function listSitterAvailabilitySlots(req, res, next) {
  try {
    const sitterId = req.params.sitterId;
    const from = parseDateParam(req.query.from);
    const to = parseDateParam(req.query.to || req.query.from);

    if (!from || !to || to < from) {
      return res.status(400).json({
        error: "Intervallo date non valido"
      });
    }

    const rangeDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1; // calcola numero di giorni tra inizio e fine

    if (rangeDays > MAX_SLOT_RANGE_DAYS) {
      return res.status(400).json({
        error: "Intervallo date troppo ampio"
      });
    }

    const availabilityMode = await getServiceAvailabilityMode(req.query.serviceId); // recupera la modalità del servizio richiesto: hourly_slot, fixed_slot, daily_exclusive oppure daily_non_exclusive.
    const days = await listAvailableSlots(sitterId, from, endOfDay(to), availabilityMode); // coordina tutto il calcolo dei giorni e degli orari disponibili

    return res.json({
      days
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listSitterAvailabilitySlots
};
