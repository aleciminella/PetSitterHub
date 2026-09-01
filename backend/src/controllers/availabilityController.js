const pool = require("../db/pool");

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

async function hasAcceptedBookingOverlap(sitterId, startsAt, endsAt) {
  const result = await pool.query(
    `select id
     from bookings
     where sitter_id = $1
       and status = 'accepted'
       and starts_at < $3
       and ends_at > $2
     limit 1`,
    [sitterId, startsAt, endsAt]
  );

  return result.rows.length > 0;
}

async function checkSitterAvailability(req, res, next) {
  try {
    const { startsAt, endsAt } = req.query;
    const sitterId = req.params.sitterId;

    if (!startsAt || !endsAt || hasInvalidDates(startsAt, endsAt)) {
      return res.status(400).json({
        error: "Date disponibilità non valide"
      });
    }

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

    const matchesSchedule = eachBookingDate(start, end).every((date) => {
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

    const hasOverlap = await hasAcceptedBookingOverlap(sitterId, startsAt, endsAt);

    return res.json({
      available: matchesSchedule && !hasOverlap,
      matchesSchedule,
      hasAcceptedBookingOverlap: hasOverlap
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  checkSitterAvailability
};
