const pool = require("../db/pool");

async function getMySitterProfile(req, res, next) {
  try {
    const result = await pool.query(
      `select
         u.id as user_id,
         u.first_name,
         u.last_name,
         u.email,
         u.phone,
         u.city,
         sp.id as sitter_id,
         sp.bio,
         sp.base_city,
         sp.verified,
         sp.created_at
       from users u
       left join sitter_profiles sp on sp.user_id = u.id
       where u.id = $1`,
      [req.user.id]
    );

    return res.json({
      profile: result.rows[0]
    });
  } catch (err) {
    return next(err);
  }
}

async function updateMySitterProfile(req, res, next) {
  try {
    const { bio, baseCity } = req.body;

    if (!baseCity || baseCity.trim().length === 0) {
      return res.status(400).json({
        error: "Città base obbligatoria"
      });
    }

    const result = await pool.query(
      `insert into sitter_profiles (user_id, bio, base_city)
       values ($1, $2, $3)
       on conflict (user_id) do update set
         bio = excluded.bio,
         base_city = excluded.base_city
       returning id, user_id, bio, base_city, verified, created_at`,
      [req.user.id, bio || null, baseCity.trim()]
    );

    return res.json({
      profile: result.rows[0]
    });
  } catch (err) {
    return next(err);
  }
}

async function listSitters(req, res, next) {
  try {
    const { city, petType, service } = req.query;

    const values = [];
    const conditions = ["u.role = 'sitter'"];

    if (city) {
      values.push(`%${city}%`);
      conditions.push(`sp.base_city ilike $${values.length}`);
    }

    if (service) {
      values.push(service);
      conditions.push(`s.name = $${values.length}`);
    }

    if (petType) {
      values.push(petType);
      conditions.push(`ss.pet_type = $${values.length}`);
    }

    const result = await pool.query(
      `select
         sp.id,
         sp.bio,
         sp.base_city,
         sp.verified,
         u.first_name,
         u.last_name,
         coalesce(
           json_agg(
             json_build_object(
               'id', s.id,
               'name', s.name,
               'pet_type', ss.pet_type,
               'price', ss.price
             )
             order by s.name, ss.pet_type
           ) filter (where s.id is not null),
           '[]'
         ) as services
       from sitter_profiles sp
       join users u on u.id = sp.user_id
       left join sitter_services ss on ss.sitter_id = sp.id
       left join services s on s.id = ss.service_id
       where ${conditions.join(" and ")}
       group by sp.id, u.first_name, u.last_name
       order by sp.verified desc, u.first_name, u.last_name`,
      values
    );

    return res.json({
      sitters: result.rows
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getMySitterProfile,
  updateMySitterProfile,
  listSitters
};
