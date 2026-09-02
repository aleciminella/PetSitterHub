const pool = require("../db/pool");
const SLOT_MINUTES = 60;
const ACTIVE_BOOKING_STATUSES = ["accepted"];

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

  return Number.isNaN(start.getTime())
    || Number.isNaN(end.getTime())
    || end <= start
    || !hasValidSlot(start)
    || !hasValidSlot(end);
}

function hasValidSlot(date) {
  return date.getSeconds() === 0
    && date.getMilliseconds() === 0
    && date.getMinutes() % SLOT_MINUTES === 0;
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

async function matchesSitterAvailabilitySchedule(sitterId, startsAt, endsAt) {
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

async function isSitterAvailable(sitterId, startsAt, endsAt) {
  return matchesSitterAvailabilitySchedule(sitterId, startsAt, endsAt);
}

async function findCompatibleSitterService(ownerId, petId, sitterId, serviceId) {
  const result = await pool.query(
    `select p.species as pet_type, ss.price, s.name as service_name, s.price_unit
     from pets p
     join sitter_services ss on ss.pet_type = p.species
     join services s on s.id = ss.service_id
     where p.id = $1
       and p.owner_id = $2
       and ss.sitter_id = $3
       and ss.service_id = $4`,
    [petId, ownerId, sitterId, serviceId]
  );

  return result.rows[0] || null;
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
  ACTIVE_BOOKING_STATUSES,
  calculateTotalPrice,
  findCompatibleSitterService,
  hasAcceptedBookingOverlap,
  hasInvalidDates,
  isSitterAvailable,
  matchesSitterAvailabilitySchedule
};
