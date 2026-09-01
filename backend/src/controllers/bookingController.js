const pool = require("../db/pool");

function calculateTotalPrice(price, priceUnit, startsAt, endsAt) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const durationMs = end.getTime() - start.getTime();

  if (priceUnit === "hourly") {
    const hours = Math.max(1, Math.ceil(durationMs / (1000 * 60 * 60)));
    return price * hours;
  }

  if (priceUnit === "daily") {
    const days = Math.max(1, Math.ceil(durationMs / (1000 * 60 * 60 * 24)));
    return price * days;
  }

  return price;
}

function hasInvalidDates(startsAt, endsAt) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  return Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start;
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toMinutes(value) {
  const [hours, minutes] = String(value).slice(0, 5).split(":").map(Number);

  return hours * 60 + minutes;
}

function getAvailabilityForDate(dateKey, weekday, weeklyAvailability, exceptions) {
  const exception = exceptions.find((item) => {
    const startsOn = typeof item.starts_on === "string" ? item.starts_on : toDateKey(item.starts_on);
    const endsOn = typeof item.ends_on === "string" ? item.ends_on : toDateKey(item.ends_on);

    return startsOn <= dateKey && endsOn >= dateKey;
  });

  if (exception) {
    return exception;
  }

  return weeklyAvailability.find((item) => item.weekday === weekday);
}

function eachBookingDate(startsAt, endsAt) {
  const dates = [];
  const current = new Date(startsAt.getFullYear(), startsAt.getMonth(), startsAt.getDate());
  const last = new Date(endsAt.getFullYear(), endsAt.getMonth(), endsAt.getDate());

  while (current <= last) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

async function isSitterAvailable(sitterId, startsAt, endsAt) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  const weeklyResult = await pool.query(
    `select weekday, is_available, starts_at, ends_at
     from sitter_weekly_availability
     where sitter_id = $1`,
    [sitterId]
  );

  const exceptionResult = await pool.query(
    `select starts_on, ends_on, is_available, starts_at, ends_at
     from sitter_availability_exceptions
     where sitter_id = $1
       and starts_on <= $3::date
       and ends_on >= $2::date`,
    [sitterId, toDateKey(start), toDateKey(end)]
  );

  return eachBookingDate(start, end).every((date) => {
    const dateKey = toDateKey(date);
    const availability = getAvailabilityForDate(dateKey, date.getDay(), weeklyResult.rows, exceptionResult.rows);

    if (!availability || !availability.is_available) {
      return false;
    }

    const availableStart = toMinutes(availability.starts_at);
    const availableEnd = toMinutes(availability.ends_at);
    const requestedStart = dateKey === toDateKey(start) ? start.getHours() * 60 + start.getMinutes() : availableStart;
    const requestedEnd = dateKey === toDateKey(end) ? end.getHours() * 60 + end.getMinutes() : availableEnd;

    return requestedStart >= availableStart && requestedEnd <= availableEnd;
  });
}

function getPagination(query) {
  const limit = Math.min(Number(query.limit) || 20, 50);
  const offset = Number(query.offset) || 0;

  return {
    limit: Math.max(limit, 1),
    offset: Math.max(offset, 0)
  };
}

function addPeriodFilter(conditions, period) {
  if (period === "future") {
    conditions.push("b.ends_at >= now()");
  }

  if (period === "past") {
    conditions.push("b.ends_at < now()");
  }
}

function getBookingOrder(period) {
  if (period === "future") {
    return "b.starts_at asc";
  }

  return "b.starts_at desc";
}

async function createNotification(userId, bookingId, type, title, body) {
  try {
    await pool.query(
      `insert into notifications (user_id, booking_id, type, title, body)
       values ($1, $2, $3, $4, $5)`,
      [userId, bookingId, type, title, body]
    );
  } catch (err) {
    console.error("Errore creazione notifica", err);
  }
}

async function listBookings(req, res, next) {
  try {
    let result;
    const period = ["future", "past", "all"].includes(req.query.period) ? req.query.period : "all";
    const pagination = getPagination(req.query);

    if (req.user.role === "owner") {
      const values = [req.user.id];
      const conditions = ["b.owner_id = $1"];
      addPeriodFilter(conditions, period);
      values.push(pagination.limit, pagination.offset);

      result = await pool.query(
        `select
           b.id,
           b.starts_at,
           b.ends_at,
           case
             when b.status = 'accepted' and b.ends_at < now() then 'completed'
             else b.status
           end as status,
           b.total_price,
           b.notes,
           b.created_at,
           pay.id as payment_id,
           pay.method as payment_method,
           pay.status as payment_status,
           pay.provider_reference,
           p.id as pet_id,
           p.name as pet_name,
           p.species as pet_type,
           s.id as service_id,
           s.name as service_name,
           sp.id as sitter_id,
           u.first_name as sitter_first_name,
           u.last_name as sitter_last_name
         from bookings b
         join pets p on p.id = b.pet_id
         join services s on s.id = b.service_id
         join sitter_profiles sp on sp.id = b.sitter_id
         join users u on u.id = sp.user_id
         left join payments pay on pay.booking_id = b.id
         where ${conditions.join(" and ")}
         order by ${getBookingOrder(period)}
         limit $${values.length - 1}
         offset $${values.length}`,
        values
      );
    } else if (req.user.role === "sitter") {
      const values = [req.user.id];
      const conditions = ["sp.user_id = $1"];
      addPeriodFilter(conditions, period);
      values.push(pagination.limit, pagination.offset);

      result = await pool.query(
        `select
           b.id,
           b.starts_at,
           b.ends_at,
           case
             when b.status = 'accepted' and b.ends_at < now() then 'completed'
             else b.status
           end as status,
           b.total_price,
           b.notes,
           b.created_at,
           pay.id as payment_id,
           pay.method as payment_method,
           pay.status as payment_status,
           pay.provider_reference,
           p.id as pet_id,
           p.name as pet_name,
           p.species as pet_type,
           s.id as service_id,
           s.name as service_name,
           owner.id as owner_id,
           owner.first_name as owner_first_name,
           owner.last_name as owner_last_name
         from bookings b
         join pets p on p.id = b.pet_id
         join services s on s.id = b.service_id
         join users owner on owner.id = b.owner_id
         join sitter_profiles sp on sp.id = b.sitter_id
         left join payments pay on pay.booking_id = b.id
         where ${conditions.join(" and ")}
         order by ${getBookingOrder(period)}
         limit $${values.length - 1}
         offset $${values.length}`,
        values
      );
    } else {
      return res.status(403).json({
        error: "Operazione non autorizzata"
      });
    }

    return res.json({
      bookings: result.rows
    });
  } catch (err) {
    return next(err);
  }
}

async function createBooking(req, res, next) {
  try {
    const { sitterId, serviceId, petId, startsAt, endsAt, notes } = req.body;

    if (!sitterId || !serviceId || !petId || !startsAt || !endsAt) {
      return res.status(400).json({
        error: "Mancano campi richiesti"
      });
    }

    if (hasInvalidDates(startsAt, endsAt)) {
      return res.status(400).json({
        error: "Date prenotazione non valide"
      });
    }

    const serviceResult = await pool.query(
      `select p.species as pet_type, ss.price, s.price_unit
       from pets p
       join sitter_services ss on ss.pet_type = p.species
       join services s on s.id = ss.service_id
       where p.id = $1
         and p.owner_id = $2
         and ss.sitter_id = $3
         and ss.service_id = $4`,
      [petId, req.user.id, sitterId, serviceId]
    );

    if (serviceResult.rows.length === 0) {
      return res.status(400).json({
        error: "Animale, sitter o servizio non compatibili"
      });
    }

    const service = serviceResult.rows[0];
    const totalPrice = calculateTotalPrice(Number(service.price), service.price_unit, startsAt, endsAt);
    const available = await isSitterAvailable(sitterId, startsAt, endsAt);

    if (!available) {
      return res.status(409).json({
        error: "Sitter non disponibile nell'orario selezionato"
      });
    }

    const bookingResult = await pool.query(
      `insert into bookings (owner_id, sitter_id, service_id, pet_id, pet_type, starts_at, ends_at, total_price, notes)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       returning id, owner_id, sitter_id, service_id, pet_id, pet_type, starts_at, ends_at, status, total_price, notes, created_at`,
      [
        req.user.id,
        sitterId,
        serviceId,
        petId,
        service.pet_type,
        startsAt,
        endsAt,
        totalPrice,
        notes || null
      ]
    );

    await createNotification(
      await findSitterUserId(sitterId),
      bookingResult.rows[0].id,
      "booking_created",
      "Nuova richiesta di prenotazione",
      "Hai ricevuto una nuova richiesta di prenotazione."
    );

    return res.status(201).json({
      booking: bookingResult.rows[0]
    });
  } catch (err) {
    return next(err);
  }
}

async function findBookingForSitter(bookingId, sitterUserId) {
  const result = await pool.query(
    `select b.id, b.owner_id, b.sitter_id, b.starts_at, b.ends_at, b.status
     from bookings b
     join sitter_profiles sp on sp.id = b.sitter_id
     where b.id = $1
       and sp.user_id = $2`,
    [bookingId, sitterUserId]
  );

  return result.rows[0];
}

async function findSitterUserId(sitterId) {
  const result = await pool.query(
    `select user_id
     from sitter_profiles
     where id = $1`,
    [sitterId]
  );

  return result.rows[0] && result.rows[0].user_id;
}

async function hasAcceptedBookingOverlap(booking) {
  const result = await pool.query(
    `select id
     from bookings
     where sitter_id = $1
       and id <> $2
       and status = 'accepted'
       and starts_at < $3
       and ends_at > $4
     limit 1`,
    [booking.sitter_id, booking.id, booking.ends_at, booking.starts_at]
  );

  return result.rows.length > 0;
}

async function findBookingForOwner(bookingId, ownerId) {
  const result = await pool.query(
    `select b.id, b.status, sp.user_id as sitter_user_id
     from bookings b
     join sitter_profiles sp on sp.id = b.sitter_id
     where b.id = $1
       and b.owner_id = $2`,
    [bookingId, ownerId]
  );

  return result.rows[0];
}

async function acceptBooking(req, res, next) {
  try {
    const booking = await findBookingForSitter(req.params.id, req.user.id);

    if (!booking) {
      return res.status(404).json({
        error: "Prenotazione non trovata"
      });
    }

    if (booking.status !== "pending") {
      return res.status(400).json({
        error: "La prenotazione non può essere accettata"
      });
    }

    const hasOverlap = await hasAcceptedBookingOverlap(booking);

    if (hasOverlap) {
      return res.status(409).json({
        error: "Il sitter ha già una prenotazione accettata in questo orario"
      });
    }

    const available = await isSitterAvailable(booking.sitter_id, booking.starts_at, booking.ends_at);

    if (!available) {
      return res.status(409).json({
        error: "Sitter non disponibile nell'orario selezionato"
      });
    }

    const result = await pool.query(
      `update bookings
       set status = 'accepted', updated_at = now()
       where id = $1
       returning id, status, updated_at`,
      [req.params.id]
    );

    await createNotification(
      booking.owner_id,
      booking.id,
      "booking_accepted",
      "Richiesta accettata",
      "Il sitter ha accettato la tua richiesta. Ora puoi procedere con il pagamento."
    );

    return res.json({
      booking: result.rows[0]
    });
  } catch (err) {
    return next(err);
  }
}

async function rejectBooking(req, res, next) {
  try {
    const booking = await findBookingForSitter(req.params.id, req.user.id);

    if (!booking) {
      return res.status(404).json({
        error: "Prenotazione non trovata"
      });
    }

    if (booking.status !== "pending") {
      return res.status(400).json({
        error: "La prenotazione non può essere rifiutata"
      });
    }

    const result = await pool.query(
      `update bookings
       set status = 'rejected', updated_at = now()
       where id = $1
       returning id, status, updated_at`,
      [req.params.id]
    );

    await createNotification(
      booking.owner_id,
      booking.id,
      "booking_rejected",
      "Richiesta rifiutata",
      "Il sitter ha rifiutato la tua richiesta di prenotazione."
    );

    return res.json({
      booking: result.rows[0]
    });
  } catch (err) {
    return next(err);
  }
}

async function cancelBooking(req, res, next) {
  try {
    const booking = await findBookingForOwner(req.params.id, req.user.id);

    if (!booking) {
      return res.status(404).json({
        error: "Prenotazione non trovata"
      });
    }

    if (["cancelled", "rejected", "completed"].includes(booking.status)) {
      return res.status(400).json({
        error: "La prenotazione non può essere annullata"
      });
    }

    const result = await pool.query(
      `update bookings
       set status = 'cancelled', updated_at = now()
       where id = $1
       returning id, status, updated_at`,
      [req.params.id]
    );

    await createNotification(
      booking.sitter_user_id,
      booking.id,
      "booking_cancelled",
      "Prenotazione annullata",
      "Il proprietario ha annullato una prenotazione."
    );

    return res.json({
      booking: result.rows[0]
    });
  } catch (err) {
    return next(err);
  }
}

async function cancelBookingBySitter(req, res, next) {
  const client = await pool.connect();

  try {
    const booking = await findBookingForSitter(req.params.id, req.user.id);

    if (!booking) {
      return res.status(404).json({
        error: "Prenotazione non trovata"
      });
    }

    if (booking.status !== "accepted") {
      return res.status(400).json({
        error: "Solo le prenotazioni accettate possono essere annullate dal sitter"
      });
    }

    await client.query("begin");

    const bookingResult = await client.query(
      `update bookings
       set status = 'cancelled', updated_at = now()
       where id = $1
       returning id, status, updated_at`,
      [req.params.id]
    );

    const paymentResult = await client.query(
      `update payments
       set status = 'refunded'
       where booking_id = $1
         and status in ('authorized', 'paid')
       returning id, booking_id, amount, method, status, provider_reference, created_at`,
      [req.params.id]
    );

    await client.query("commit");

    await createNotification(
      booking.owner_id,
      booking.id,
      "booking_cancelled",
      "Prenotazione annullata",
      "Il sitter ha annullato la prenotazione. Se avevi già pagato, riceverai un rimborso demo."
    );

    return res.json({
      booking: bookingResult.rows[0],
      payment: paymentResult.rows[0] || null
    });
  } catch (err) {
    await client.query("rollback");
    return next(err);
  } finally {
    client.release();
  }
}

module.exports = {
  acceptBooking,
  cancelBooking,
  cancelBookingBySitter,
  createBooking,
  listBookings,
  rejectBooking
};
