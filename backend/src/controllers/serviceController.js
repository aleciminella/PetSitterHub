const pool = require("../db/pool");

async function listServices(req, res, next) {
  try {
    const result = await pool.query(
      `select
         s.id,
         s.name,
         s.description,
         s.price_unit,
         s.availability_mode,
         coalesce(
           json_agg(spt.pet_type order by spt.pet_type) filter (where spt.pet_type is not null),
           '[]'
         ) as pet_types
       from services s
       left join service_pet_types spt on spt.service_id = s.id
       group by s.id
       order by s.name`
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
