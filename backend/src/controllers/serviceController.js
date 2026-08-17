const pool = require("../db/pool");

async function listServices(req, res, next) {
  try {
    const result = await pool.query(
      `select id, name, description
       from services
       order by name`
    );

    return res.json({
      services: result.rows
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listServices
};
