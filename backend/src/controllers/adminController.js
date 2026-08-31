const pool = require("../db/pool");

async function getOverview(req, res, next) {
  try {
    const result = await pool.query(
      `select
         (select count(*)::integer from users) as total_users,
         (select count(*)::integer from users where role = 'owner') as total_owners,
         (select count(*)::integer from users where role = 'sitter') as total_sitters,
         (select count(*)::integer from users where role = 'admin') as total_admins,
         (select count(*)::integer from bookings) as total_bookings,
         (select count(*)::integer from bookings where status = 'pending') as pending_bookings,
         (select count(*)::integer from bookings where status = 'accepted') as accepted_bookings,
         (select count(*)::integer from bookings where status = 'completed') as completed_bookings,
         (select count(*)::integer from reviews) as total_reviews`
    );

    return res.json({
      overview: result.rows[0]
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getOverview
};
