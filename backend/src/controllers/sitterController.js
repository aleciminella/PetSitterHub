const pool = require("../db/pool");

async function listSitters(req, res, next) {
  try {
    const { city, service } = req.query;

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
               'price', ss.price
             )
             order by s.name
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
  listSitters
};
