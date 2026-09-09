const pool = require("../db/pool");
const SLOT_MINUTES = 60;
const ACTIVE_BOOKING_STATUSES = ["accepted"]; // solo le prenotazioni con stato accepted occupano il calendario




function calculateTotalPrice(price, priceUnit, startsAt, endsAt) { // Calcola quanto deve pagare il proprietario
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const durationMs = end.getTime() - start.getTime(); // Prende la differenza di tempo tra inizio e fine

  if (priceUnit === "hourly") { // Se la tarrifa è ad ore trasforma in ore e moltiplica per il prezzo orario
    const hours = Math.max(1, Math.ceil(durationMs / (1000 * 60 * 60))); // Math.max(1, ...) garantisce che si paghi sempre almeno 1 ora minima.
    return price * hours;
  }

  if (priceUnit === "daily") { // Se la tarrifa è giornaliera trasforma in giorni moltiplicando per la tariffa
    const days = Math.max(1, Math.ceil(durationMs / (1000 * 60 * 60 * 24)));
    return price * days;
  }

  return price;
}




function hasInvalidDates(startsAt, endsAt) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  return Number.isNaN(start.getTime())
    || Number.isNaN(end.getTime())
    || end <= start
    || !hasValidSlot(start)
    || !hasValidSlot(end);
}

function hasInvalidTimedServiceDuration(startsAt, endsAt, availabilityMode) {
  if (availabilityMode !== "hourly_slot" && availabilityMode !== "fixed_slot") {
    return false;
  }

  return new Date(endsAt).getTime() - new Date(startsAt).getTime() !== SLOT_MINUTES * 60 * 1000;
}



function hasPastStart(startsAt) {
  const start = new Date(startsAt);

  return Number.isNaN(start.getTime()) || start <= new Date();
}




function hasValidSlot(date) { // gli slot devono iniziare e terminare su un'ora intera
  return date.getSeconds() === 0
    && date.getMilliseconds() === 0
    && date.getMinutes() === 0;
}





function toDateKey(date) { // Prende una data e la trasforma nella stringa pulita YYYY-MM-DD
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}




function toMinutes(value) { // Prende un orario come "14:30" e lo trasforma in minuti totali dall'inizio della giornata: (14 * 60) + 30 = 870 minuti
  const [hours, minutes] = String(value).slice(0, 5).split(":").map(Number);

  return hours * 60 + minutes;
}




function getAvailabilityForDate(dateKey, weekday, weeklyAvailability, exceptions) { // funzione che decide quali orari applicare in una data specifica
  const exception = exceptions.find((item) => {  // Se la data è speciale restituisce quella
    const startsOn = typeof item.starts_on === "string" ? item.starts_on : toDateKey(item.starts_on);
    const endsOn = typeof item.ends_on === "string" ? item.ends_on : toDateKey(item.ends_on);

    return startsOn <= dateKey && endsOn >= dateKey;
  });

  if (exception) {
    return exception;
  }

  return weeklyAvailability.find((item) => item.weekday === weekday); // se non trova nessuna eccezione, cerca nella tabella degli orari settimanali normali
}





function eachBookingDate(startsAt, endsAt) { // Prende una data di inizio e una di fine e con un ciclo while crea un array con tutti i singoli giorni intermedi
  const dates = [];
  const current = new Date(startsAt.getFullYear(), startsAt.getMonth(), startsAt.getDate());
  const last = new Date(endsAt.getFullYear(), endsAt.getMonth(), endsAt.getDate());

  while (current <= last) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}






async function matchesSitterAvailabilitySchedule(sitterId, startsAt, endsAt) { // funzione che prende dal database sia gli orari settimanali sia i giorni speciali nel periodo richiesto e controlla che il sitter sia disponibile
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  const weeklyResult = await pool.query( // orari standard del sitter
    `select weekday, is_available, starts_at, ends_at
     from sitter_weekly_availability
     where sitter_id = $1`,
    [sitterId]
  );

  const exceptionResult = await pool.query( // date speciali del sitter
    `select starts_on, ends_on, is_available, starts_at, ends_at
     from sitter_availability_exceptions
     where sitter_id = $1
       and starts_on <= $3::date
       and ends_on >= $2::date`,
    [sitterId, toDateKey(start), toDateKey(end)]
  );

  return eachBookingDate(start, end).every((date) => { // crea un array con i giorni intermedi
    const dateKey = toDateKey(date);
    const availability = getAvailabilityForDate(dateKey, date.getDay(), weeklyResult.rows, exceptionResult.rows); // controlla per ogni giorno dell'array l'orario

    if (!availability || !availability.is_available) { // se solo un giorno non è disponibile restituisce false
      return false;
    }

    const availableStart = toMinutes(availability.starts_at); // trasforma in minuti dall'inizio della giornata l'orario di apertura
    const availableEnd = toMinutes(availability.ends_at);
    const requestedStart = dateKey === toDateKey(start) ? start.getHours() * 60 + start.getMinutes() : availableStart; // se è il primo giorno prendi orario richiesto altrimenti quello di apertura
    const requestedEnd = dateKey === toDateKey(end) ? end.getHours() * 60 + end.getMinutes() : availableEnd;

    return requestedStart >= availableStart && requestedEnd <= availableEnd; // verifica che se l'orario richiesto cade dentro l'orario di lavoro
  });
}



async function isSitterAvailable(sitterId, startsAt, endsAt) {
  return matchesSitterAvailabilitySchedule(sitterId, startsAt, endsAt);
}





// Verifica la compatibilità prima di prenotare. Controlla che il sitter offra quel servizio per quella specifica specie di animale
async function findCompatibleSitterService(ownerId, petId, sitterId, serviceId) {
  const result = await pool.query(
    `select p.species as pet_type, ss.price, s.name as service_name, s.price_unit, s.availability_mode
     from pets p
     join sitter_services ss on ss.pet_type = p.species
     join services s on s.id = ss.service_id
     where p.id = $1
       and p.owner_id = $2
       and p.is_active = true
       and ss.sitter_id = $3
       and ss.service_id = $4`,
    [petId, ownerId, sitterId, serviceId]
  );

  return result.rows[0] || null; // Se compatibile, restituisce il prezzo del sitter e la modalità del servizio per calcolare il totale, altrimenti restituisce null
}



async function hasActiveDuplicateBooking(ownerId, petId, sitterId, serviceId, startsAt, endsAt) {
  const result = await pool.query(
    `select id
     from bookings
     where owner_id = $1
       and pet_id = $2
       and sitter_id = $3
       and service_id = $4
       and starts_at = $5
       and ends_at = $6
       and status = any($7)
     limit 1`,
    [ownerId, petId, sitterId, serviceId, startsAt, endsAt, ["pending", "accepted"]]
  );

  return result.rows.length > 0;
}




async function getServiceAvailabilityMode(serviceId) {
  if (!serviceId) {
    return "hourly_slot";
  }

  const result = await pool.query(
    `select availability_mode
     from services
     where id = $1`,
    [serviceId]
  );

  return result.rows[0] ? result.rows[0].availability_mode : "hourly_slot";
}




function atMinutes(date, minutes) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    Math.floor(minutes / 60),
    minutes % 60,
    0,
    0
  );
}




function intervalsOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}




async function loadScheduleAndAcceptedBookings(sitterId, rangeStart, rangeEnd) {
  const startKey = toDateKey(rangeStart);
  const endKey = toDateKey(rangeEnd);

  const [weeklyResult, exceptionResult, bookingsResult] = await Promise.all([
    pool.query(
      `select weekday, is_available, starts_at, ends_at
       from sitter_weekly_availability
       where sitter_id = $1`,
      [sitterId]
    ),
    pool.query(
      `select starts_on, ends_on, is_available, starts_at, ends_at
       from sitter_availability_exceptions
       where sitter_id = $1
         and starts_on <= $3::date
         and ends_on >= $2::date`,
      [sitterId, startKey, endKey]
    ),
    pool.query(
      `select b.starts_at, b.ends_at, s.availability_mode
       from bookings b
       join services s on s.id = b.service_id
       where b.sitter_id = $1
         and b.status = any($4)
         and b.starts_at < $3
         and b.ends_at > $2`,
      [sitterId, rangeStart, rangeEnd, ACTIVE_BOOKING_STATUSES]
    )
  ]);

  return {
    weeklyAvailability: weeklyResult.rows,
    exceptions: exceptionResult.rows,
    acceptedBookings: bookingsResult.rows.map((row) => ({
      startsAt: new Date(row.starts_at),
      endsAt: new Date(row.ends_at),
      availabilityMode: row.availability_mode
    }))
  };
}



function slotConflictsWithAccepted(slotStart, slotEnd, acceptedBookings, availabilityMode) {
  const conflictModes = getConflictAvailabilityModes(availabilityMode);

  return acceptedBookings.some((booking) => ( // .some() controlla le prenotazioni una alla volta e restituisce true appena ne trova almeno una incompatibile.
    conflictModes.includes(booking.availabilityMode) // Verifica che la modalità della prenotazione accettata sia tra quelle che bloccano il servizio richiesto
    && intervalsOverlap(slotStart, slotEnd, booking.startsAt, booking.endsAt) // Controlla che i due intervalli temporali si sovrappongano.
  ));
}



async function listAvailableSlots(sitterId, rangeStart, rangeEnd, availabilityMode) {
  const start = new Date(rangeStart);
  const end = new Date(rangeEnd);
  const now = new Date();
  const mode = availabilityMode || "hourly_slot"; // Se non viene fornita una modalità, usa per sicurezza hourly_slot
  const { weeklyAvailability, exceptions, acceptedBookings } = await loadScheduleAndAcceptedBookings( // carica dal database la disponibilità settimanale, le eventuali eccezioni e le prenotazioni accepted del sitter comprese nel periodo richiesto.
    sitterId,
    start,
    end
  );

  const days = []; // contiene risultato finale

  eachBookingDate(start, end).forEach((date) => { // per ogni giorno
    const dateKey = toDateKey(date); // converte data nel formato adatto
    const availability = getAvailabilityForDate(dateKey, date.getDay(), weeklyAvailability, exceptions); // decide quale disponibilità applicare: l'eccezione specifica, se presente, oppure il normale orario settimanale del sitter.

    if (!availability || !availability.is_available) { // Se non esiste una configurazione oppure il sitter è chiuso, salta solamente quel giorno.
      return;
    }

    // orari convertiti in minuti dalla mezzanotte
    const availableStart = toMinutes(availability.starts_at);
    const availableEnd = toMinutes(availability.ends_at);

    const slots = []; // contiene intervalli disponibili della giornata

    if (mode === "daily_exclusive" || mode === "daily_non_exclusive") { // Per un servizio giornaliero non vengono generate singole ore. L’intera giornata lavorativa rappresenta un solo intervallo
      const slotStart = atMinutes(date, availableStart);
      const slotEnd = atMinutes(date, availableEnd);

      if (slotStart > now && !slotConflictsWithAccepted(slotStart, slotEnd, acceptedBookings, mode)) { // slotConflictsWithAccepted verifica se l'intervallo si sovrappone a una prenotazione accepted incompatibile.
        slots.push({ // Aggiungi a slots
          startsAt: slotStart.toISOString(),
          endsAt: slotEnd.toISOString()
        });
      }
    } else {
      for (let minutes = availableStart; minutes + SLOT_MINUTES <= availableEnd; minutes += SLOT_MINUTES) {
        const slotStart = atMinutes(date, minutes);
        const slotEnd = atMinutes(date, minutes + SLOT_MINUTES);

        if (slotStart > now && !slotConflictsWithAccepted(slotStart, slotEnd, acceptedBookings, mode)) { // come per i servizi giornalieri viene controllata che lo slot di partenza sia successivo ad il momento attuale e che non si sovrapponga ad una prenotazione accepted incompatibile.
          slots.push({
            startsAt: slotStart.toISOString(),
            endsAt: slotEnd.toISOString()
          });
        }
      }
    }

    if (slots.length > 0) {
      days.push({
        date: dateKey,
        slots
      });
    }
  });

  return days;
}



function getConflictAvailabilityModes(availabilityMode) {
  const conflictModes = {
    daily_exclusive: ["hourly_slot", "fixed_slot", "daily_exclusive", "daily_non_exclusive"],
    daily_non_exclusive: ["daily_exclusive"],
    fixed_slot: ["hourly_slot", "fixed_slot", "daily_exclusive"],
    hourly_slot: ["hourly_slot", "fixed_slot", "daily_exclusive"]
  };

  return conflictModes[availabilityMode] || conflictModes.hourly_slot;
}




async function hasAcceptedBookingOverlap(booking) {
  const result = await pool.query(
    `select b.id
     from bookings b
     join services s on s.id = b.service_id
     where b.sitter_id = $1
       and b.id <> $2
       and b.status = any($5)
       and b.starts_at < $3
       and b.ends_at > $4
       and s.availability_mode = any($6)
     limit 1`,
    [
      booking.sitter_id,
      booking.id,
      booking.ends_at,
      booking.starts_at,
      ACTIVE_BOOKING_STATUSES,
      getConflictAvailabilityModes(booking.availability_mode)
    ]
  );

  return result.rows.length > 0;
}




module.exports = {
  calculateTotalPrice,
  findCompatibleSitterService,
  getServiceAvailabilityMode,
  hasActiveDuplicateBooking,
  hasAcceptedBookingOverlap,
  hasInvalidDates,
  hasInvalidTimedServiceDuration,
  hasPastStart,
  isSitterAvailable,
  listAvailableSlots,
  matchesSitterAvailabilitySchedule
};
