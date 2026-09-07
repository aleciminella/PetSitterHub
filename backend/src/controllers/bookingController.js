const pool = require("../db/pool");
const {
  calculateTotalPrice,
  findCompatibleSitterService,
  hasActiveDuplicateBooking,
  hasAcceptedBookingOverlap,
  hasInvalidDates,
  hasPastStart,
  isSitterAvailable
} = require("../services/bookingService");
const { createNotification } = require("../services/notificationService");

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
    conditions.push("(b.ends_at >= now() or b.status = 'pending')");
  }

  if (period === "past") {
    conditions.push("b.ends_at < now() and b.status <> 'pending'");
  }
}

function getBookingOrder(period) {
  const direction = period === "future" ? "asc" : "desc";
  const statusPriority = `case b.status
    when 'accepted' then 1
    when 'rejected' then 2
    when 'cancelled' then 3
    else 4
  end`;

  return `b.starts_at::date ${direction}, ${statusPriority} asc, b.starts_at ${direction}, b.created_at asc`;
}

async function createBookingNotification(notification) {
  try {
    await createNotification(notification);
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
           (
             select count(*)::integer
             from messages m
             where m.booking_id = b.id
               and m.sender_id <> $1
               and m.read_at is null
           ) as unread_messages,
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
           u.last_name as sitter_last_name,
           review.id as review_id,
           review.rating as review_rating,
           review.comment as review_comment,
           b.id = (
             select completed_booking.id
             from bookings completed_booking
             where completed_booking.owner_id = b.owner_id
               and completed_booking.sitter_id = b.sitter_id
               and (
                 completed_booking.status = 'completed'
                 or (completed_booking.status = 'accepted' and completed_booking.ends_at < now())
               )
             order by completed_booking.ends_at desc
             limit 1
           ) as can_review
         from bookings b
         join pets p on p.id = b.pet_id
         join services s on s.id = b.service_id
         join sitter_profiles sp on sp.id = b.sitter_id
         join users u on u.id = sp.user_id
         left join payments pay on pay.booking_id = b.id
         left join reviews review
           on review.owner_id = b.owner_id
          and review.sitter_id = b.sitter_id
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
           (
             select count(*)::integer
             from messages m
             where m.booking_id = b.id
               and m.sender_id <> $1
               and m.read_at is null
           ) as unread_messages,
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

    if (hasPastStart(startsAt)) {
      return res.status(400).json({
        error: "Non puoi prenotare un orario già passato"
      });
    }

    const service = await findCompatibleSitterService(req.user.id, petId, sitterId, serviceId);

    if (!service) {
      return res.status(400).json({
        error: "Animale, sitter o servizio non compatibili"
      });
    }

    const hasDuplicate = await hasActiveDuplicateBooking(
      req.user.id,
      petId,
      sitterId,
      serviceId,
      startsAt,
      endsAt
    );

    if (hasDuplicate) {
      return res.status(409).json({
        error: "Hai già inviato questa richiesta di prenotazione"
      });
    }

    const totalPrice = calculateTotalPrice(Number(service.price), service.price_unit, startsAt, endsAt);
    const available = await isSitterAvailable(sitterId, startsAt, endsAt);

    if (!available) {
      return res.status(409).json({
        error: "Sitter non disponibile nell'orario selezionato"
      });
    }

    const hasOverlap = await hasAcceptedBookingOverlap({
      id: 0,
      sitter_id: sitterId,
      starts_at: startsAt,
      ends_at: endsAt,
      availability_mode: service.availability_mode
    });

    if (hasOverlap) {
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

    await createBookingNotification({
      userId: await findSitterUserId(sitterId),
      bookingId: bookingResult.rows[0].id,
      type: "booking_created",
      title: "Nuova richiesta di prenotazione",
      body: "Hai ricevuto una nuova richiesta di prenotazione."
    });

    return res.status(201).json({
      booking: bookingResult.rows[0]
    });
  } catch (err) {
    if (err.code === "23505" && err.constraint === "bookings_active_request_unique_idx") {
      return res.status(409).json({
        error: "Hai già inviato questa richiesta di prenotazione"
      });
    }

    return next(err);
  }
}

async function quoteBooking(req, res, next) {
  try {
    const { sitterId, serviceId, petId, startsAt, endsAt } = req.body;

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

    if (hasPastStart(startsAt)) {
      return res.status(400).json({
        error: "Non puoi prenotare un orario già passato"
      });
    }

    const service = await findCompatibleSitterService(req.user.id, petId, sitterId, serviceId);

    if (!service) {
      return res.status(400).json({
        error: "Animale, sitter o servizio non compatibili"
      });
    }

    const hasDuplicate = await hasActiveDuplicateBooking(
      req.user.id,
      petId,
      sitterId,
      serviceId,
      startsAt,
      endsAt
    );

    if (hasDuplicate) {
      return res.status(409).json({
        error: "Hai già inviato questa richiesta di prenotazione"
      });
    }

    const totalPrice = calculateTotalPrice(Number(service.price), service.price_unit, startsAt, endsAt);
    const available = await isSitterAvailable(sitterId, startsAt, endsAt);
    const hasOverlap = await hasAcceptedBookingOverlap({
      id: 0,
      sitter_id: sitterId,
      starts_at: startsAt,
      ends_at: endsAt,
      availability_mode: service.availability_mode
    });

    if (!available || hasOverlap) {
      return res.status(409).json({
        error: "Sitter non disponibile nell'orario selezionato"
      });
    }

    return res.json({
      quote: {
        sitterId,
        serviceId,
        petId,
        petType: service.pet_type,
        serviceName: service.service_name,
        price: Number(service.price),
        priceUnit: service.price_unit,
        totalPrice,
        currency: "EUR"
      }
    });
  } catch (err) {
    return next(err);
  }
}

async function findBookingForSitter(bookingId, sitterUserId) {
  const result = await pool.query(
    `select b.id, b.owner_id, b.sitter_id, b.starts_at, b.ends_at, b.status, s.availability_mode
     from bookings b
     join sitter_profiles sp on sp.id = b.sitter_id
     join services s on s.id = b.service_id
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

    if (hasPastStart(booking.starts_at)) {
      return res.status(400).json({
        error: "Non puoi accettare una prenotazione già iniziata"
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

    await createBookingNotification({
      userId: booking.owner_id,
      bookingId: booking.id,
      type: "payment_required",
      title: "Richiesta accettata",
      body: "Il sitter ha accettato la tua richiesta. Ora puoi procedere con il pagamento."
    });

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

    await createBookingNotification({
      userId: booking.owner_id,
      bookingId: booking.id,
      type: "booking_rejected",
      title: "Richiesta rifiutata",
      body: "Il sitter ha rifiutato la tua richiesta di prenotazione."
    });

    return res.json({
      booking: result.rows[0]
    });
  } catch (err) {
    return next(err);
  }
}

async function cancelBooking(req, res, next) {
  const client = await pool.connect();

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

    await createBookingNotification({
      userId: booking.sitter_user_id,
      bookingId: booking.id,
      type: "booking_cancelled",
      title: "Prenotazione annullata",
      body: "Il proprietario ha annullato una prenotazione."
    });

    if (paymentResult.rows.length > 0) {
      await createBookingNotification({
        userId: booking.owner_id,
        bookingId: booking.id,
        type: "payment_refunded",
        title: "Rimborso avviato",
        body: "Il rimborso demo verrà accreditato sul metodo di pagamento usato per la prenotazione."
      });
    }

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

    await createBookingNotification({
      userId: booking.owner_id,
      bookingId: booking.id,
      type: "booking_cancelled",
      title: "Prenotazione annullata",
      body: "Il sitter ha annullato la prenotazione. Se avevi già pagato, riceverai un rimborso demo."
    });

    if (paymentResult.rows.length > 0) {
      await createBookingNotification({
        userId: booking.owner_id,
        bookingId: booking.id,
        type: "payment_refunded",
        title: "Rimborso avviato",
        body: "Il rimborso demo verrà accreditato sul metodo di pagamento usato per la prenotazione."
      });
    }

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
  quoteBooking,
  rejectBooking
};
