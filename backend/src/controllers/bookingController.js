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

async function listBookings(req, res, next) {
  try {
    let result;

    if (req.user.role === "owner") {
      result = await pool.query(
        `select
           b.id,
           b.starts_at,
           b.ends_at,
           b.status,
           b.total_price,
           b.notes,
           b.created_at,
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
         where b.owner_id = $1
         order by b.starts_at desc`,
        [req.user.id]
      );
    } else if (req.user.role === "sitter") {
      result = await pool.query(
        `select
           b.id,
           b.starts_at,
           b.ends_at,
           b.status,
           b.total_price,
           b.notes,
           b.created_at,
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
         where sp.user_id = $1
         order by b.starts_at desc`,
        [req.user.id]
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

    return res.status(201).json({
      booking: bookingResult.rows[0]
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createBooking,
  listBookings
};
