const pool = require("../db/pool");
const { hasInvalidDates, matchesSitterAvailabilitySchedule } = require("../services/bookingService");

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

    const matchesSchedule = await matchesSitterAvailabilitySchedule(sitterId, startsAt, endsAt);
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
