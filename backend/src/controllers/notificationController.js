const pool = require("../db/pool");

function getPagination(query) {
  const limit = Math.min(Number(query.limit) || 3, 30);
  const offset = Number(query.offset) || 0;

  return {
    limit: Math.max(limit, 1),
    offset: Math.max(offset, 0)
  };
}

async function listNotifications(req, res, next) {
  try {
    const pagination = getPagination(req.query);

    const notificationsResult = await pool.query(
      `select id, booking_id, type, title, body, is_read, created_at
       from notifications
       where user_id = $1
       order by created_at desc, id desc
       limit $2
       offset $3`,
      [req.user.id, pagination.limit, pagination.offset]
    );

    const unreadResult = await pool.query(
      `select count(*)::integer as unread_count
       from notifications
       where user_id = $1
         and is_read = false`,
      [req.user.id]
    );

    return res.json({
      notifications: notificationsResult.rows,
      unreadCount: unreadResult.rows[0].unread_count
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listNotifications
};
