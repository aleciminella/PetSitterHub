const pool = require("../db/pool");

function getPagination(query) {
  const limit = Math.min(Number(query.limit) || 5, 30);
  const offset = Number(query.offset) || 0;

  return {
    limit: Math.max(limit, 1),
    offset: Math.max(offset, 0)
  };
}

function getUserOrder(sort) {
  const orders = {
    role: "u.role asc, u.first_name asc, u.last_name asc",
    name: "u.first_name asc, u.last_name asc",
    city: "u.city asc nulls last, u.first_name asc, u.last_name asc",
    created_at: "u.created_at desc"
  };

  return orders[sort] || orders.created_at;
}

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

async function listUsers(req, res, next) {
  try {
    const pagination = getPagination(req.query);
    const values = [];
    const conditions = [];

    if (req.query.search) {
      values.push(`%${req.query.search}%`);
      conditions.push(`(
        u.email ilike $${values.length}
        or u.first_name ilike $${values.length}
        or u.last_name ilike $${values.length}
        or u.city ilike $${values.length}
      )`);
    }

    values.push(pagination.limit, pagination.offset);

    const whereClause = conditions.length ? `where ${conditions.join(" and ")}` : "";

    const result = await pool.query(
      `select
         u.id,
         u.email,
         u.first_name,
         u.last_name,
         u.role,
         u.phone,
         u.city,
         u.created_at,
         sp.id as sitter_profile_id,
         sp.verified as sitter_verified
       from users u
       left join sitter_profiles sp on sp.user_id = u.id
       ${whereClause}
       order by ${getUserOrder(req.query.sort)}
       limit $${values.length - 1}
       offset $${values.length}`,
      values
    );

    return res.json({
      users: result.rows
    });
  } catch (err) {
    return next(err);
  }
}

async function deleteUser(req, res, next) {
  try {
    if (Number(req.params.id) === Number(req.user.id)) {
      return res.status(400).json({
        error: "Non puoi eliminare il tuo account admin"
      });
    }

    const result = await pool.query(
      `delete from users
       where id = $1
       returning id`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Utente non trovato"
      });
    }

    return res.sendStatus(204);
  } catch (err) {
    return next(err);
  }
}

async function promoteUserToAdmin(req, res, next) {
  try {
    const result = await pool.query(
      `update users
       set role = 'admin'
       where id = $1
       returning id, email, first_name, last_name, role, phone, city, created_at`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Utente non trovato"
      });
    }

    return res.json({
      user: result.rows[0]
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  deleteUser,
  getOverview,
  listUsers,
  promoteUserToAdmin
};
