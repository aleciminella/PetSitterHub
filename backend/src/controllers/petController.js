const pool = require("../db/pool");

async function listPets(req, res, next) {
  try {
    const result = await pool.query(
      `select id, name, species, breed, age, notes, created_at
       from pets
       where owner_id = $1
       order by created_at desc, name`,
      [req.user.id]
    );

    return res.json({
      pets: result.rows
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listPets
};
