const {
  getServiceAvailabilityMode,
  hasAcceptedBookingOverlap,
  hasInvalidDates,
  listAvailableSlots,
  matchesSitterAvailabilitySchedule
} = require("../services/bookingService");

const MAX_SLOT_RANGE_DAYS = 31;

function parseDateParam(value) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

async function checkSitterAvailability(req, res, next) {
  try {
    const { startsAt, endsAt, serviceId } = req.query;
    const sitterId = req.params.sitterId;

    if (!startsAt || !endsAt || hasInvalidDates(startsAt, endsAt)) {
      return res.status(400).json({
        error: "Date disponibilità non valide"
      });
    }

    const availabilityMode = await getServiceAvailabilityMode(serviceId);
    const matchesSchedule = await matchesSitterAvailabilitySchedule(sitterId, startsAt, endsAt);
    const hasOverlap = await hasAcceptedBookingOverlap({
      id: 0,
      sitter_id: sitterId,
      starts_at: startsAt,
      ends_at: endsAt,
      availability_mode: availabilityMode
    });

    return res.json({
      available: matchesSchedule && !hasOverlap,
      matchesSchedule,
      hasAcceptedBookingOverlap: hasOverlap
    });
  } catch (err) {
    return next(err);
  }
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

    const rangeDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (rangeDays > MAX_SLOT_RANGE_DAYS) {
      return res.status(400).json({
        error: "Intervallo date troppo ampio"
      });
    }

    const availabilityMode = await getServiceAvailabilityMode(req.query.serviceId);
    const days = await listAvailableSlots(sitterId, from, endOfDay(to), availabilityMode);

    return res.json({
      days
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  checkSitterAvailability,
  listSitterAvailabilitySlots
};
