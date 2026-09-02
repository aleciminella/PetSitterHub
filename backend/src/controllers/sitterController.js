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

async function findMySitterProfileId(userId) {
  const result = await pool.query(
    `select id
     from sitter_profiles
     where user_id = $1`,
    [userId]
  );

  return result.rows[0] && result.rows[0].id;
}

async function listMyPetTypes(req, res, next) {
  try {
    const sitterId = await findMySitterProfileId(req.user.id);

    if (!sitterId) {
      return res.json({
        petTypes: []
      });
    }

    const result = await pool.query(
      `select pet_type
       from sitter_pet_types
       where sitter_id = $1
       order by pet_type`,
      [sitterId]
    );

    return res.json({
      petTypes: result.rows.map((row) => row.pet_type)
    });
  } catch (err) {
    return next(err);
  }
}

async function updateMyPetTypes(req, res, next) {
  const client = await pool.connect();

  try {
    const { petTypes } = req.body;

    if (!Array.isArray(petTypes)) {
      return res.status(400).json({
        error: "Lista animali non valida"
      });
    }

    const sitterId = await findMySitterProfileId(req.user.id);

    if (!sitterId) {
      return res.status(400).json({
        error: "Profilo sitter non configurato"
      });
    }

    const cleanedPetTypes = petTypes
      .filter((petType) => petType && petType.trim().length > 0)
      .map((petType) => petType.trim());

    await client.query("begin");
    await client.query(
      `delete from sitter_services
       where sitter_id = $1
         and not (pet_type = any($2::varchar[]))`,
      [sitterId, cleanedPetTypes]
    );
    await client.query("delete from sitter_pet_types where sitter_id = $1", [sitterId]);

    for (const petType of cleanedPetTypes) {
      await client.query(
        `insert into sitter_pet_types (sitter_id, pet_type)
         values ($1, $2)
         on conflict (sitter_id, pet_type) do nothing`,
        [sitterId, petType]
      );
    }

    const result = await client.query(
      `select pet_type
       from sitter_pet_types
       where sitter_id = $1
       order by pet_type`,
      [sitterId]
    );

    await client.query("commit");

    return res.json({
      petTypes: result.rows.map((row) => row.pet_type)
    });
  } catch (err) {
    await client.query("rollback");
    return next(err);
  } finally {
    client.release();
  }
}

async function listMyServices(req, res, next) {
  try {
    const sitterId = await findMySitterProfileId(req.user.id);

    if (!sitterId) {
      return res.status(400).json({
        error: "Profilo sitter non configurato"
      });
    }

    const result = await pool.query(
      `select
         s.id as service_id,
         s.name,
         s.description,
         s.price_unit,
         s.availability_mode,
         spt.pet_type,
         ss.price,
         ss.service_id is not null as enabled
       from service_pet_types spt
       join services s on s.id = spt.service_id
       join sitter_pet_types spet on spet.pet_type = spt.pet_type
       left join sitter_services ss on ss.sitter_id = spet.sitter_id
        and ss.service_id = s.id
        and ss.pet_type = spt.pet_type
       where spet.sitter_id = $1
       order by s.name, spt.pet_type`,
      [sitterId]
    );

    return res.json({
      services: result.rows
    });
  } catch (err) {
    return next(err);
  }
}

async function updateMyServices(req, res, next) {
  const client = await pool.connect();

  try {
    const { services } = req.body;

    if (!Array.isArray(services)) {
      return res.status(400).json({
        error: "Lista servizi non valida"
      });
    }

    const sitterId = await findMySitterProfileId(req.user.id);

    if (!sitterId) {
      return res.status(400).json({
        error: "Profilo sitter non configurato"
      });
    }

    await client.query("begin");
    await client.query("delete from sitter_services where sitter_id = $1", [sitterId]);

    for (const service of services) {
      const price = Number(service.price);

      if (!service.serviceId || !service.petType || !Number.isFinite(price) || price < 0) {
        await client.query("rollback");
        return res.status(400).json({
          error: "Servizio o prezzo non valido"
        });
      }

      await client.query(
        `insert into sitter_services (sitter_id, service_id, pet_type, price)
         values ($1, $2, $3, $4)`,
        [sitterId, service.serviceId, service.petType, price]
      );
    }

    await client.query("commit");

    const result = await pool.query(
      `select
         s.id as service_id,
         s.name,
         s.description,
         s.price_unit,
         s.availability_mode,
         ss.pet_type,
         ss.price,
         true as enabled
       from sitter_services ss
       join services s on s.id = ss.service_id
       where ss.sitter_id = $1
       order by s.name, ss.pet_type`,
      [sitterId]
    );

    return res.json({
      services: result.rows
    });
  } catch (err) {
    await client.query("rollback");

    if (err.code === "23503") {
      return res.status(400).json({
        error: "Servizio non compatibile con gli animali accettati"
      });
    }

    return next(err);
  } finally {
    client.release();
  }
}

async function getMyAvailability(req, res, next) {
  try {
    const sitterId = await findMySitterProfileId(req.user.id);

    if (!sitterId) {
      return res.status(400).json({
        error: "Profilo sitter non configurato"
      });
    }

    const weeklyResult = await pool.query(
      `select weekday, is_available, starts_at, ends_at
       from sitter_weekly_availability
       where sitter_id = $1
       order by weekday`,
      [sitterId]
    );

    const exceptionResult = await pool.query(
      `select id, starts_on, ends_on, is_available, starts_at, ends_at, note
       from sitter_availability_exceptions
       where sitter_id = $1
       order by starts_on desc, id desc`,
      [sitterId]
    );

    return res.json({
      weeklyAvailability: weeklyResult.rows,
      exceptions: exceptionResult.rows
    });
  } catch (err) {
    return next(err);
  }
}

function isValidTime(value) {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function cleanWeeklyAvailabilityItem(item) {
  const weekday = Number(item.weekday);
  const isAvailable = item.isAvailable;

  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || typeof isAvailable !== "boolean") {
    return null;
  }

  if (!isAvailable) {
    return {
      weekday,
      isAvailable: false,
      startsAt: null,
      endsAt: null
    };
  }

  if (!isValidTime(item.startsAt) || !isValidTime(item.endsAt) || item.endsAt <= item.startsAt) {
    return null;
  }

  return {
    weekday,
    isAvailable: true,
    startsAt: item.startsAt,
    endsAt: item.endsAt
  };
}

function isValidDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function cleanAvailabilityExceptionItem(item) {
  const isAvailable = item.isAvailable;

  if (!isValidDate(item.startsOn) || !isValidDate(item.endsOn) || item.endsOn < item.startsOn || typeof isAvailable !== "boolean") {
    return null;
  }

  if (!isAvailable) {
    return {
      startsOn: item.startsOn,
      endsOn: item.endsOn,
      isAvailable: false,
      startsAt: null,
      endsAt: null,
      note: item.note || null
    };
  }

  if (!isValidTime(item.startsAt) || !isValidTime(item.endsAt) || item.endsAt <= item.startsAt) {
    return null;
  }

  return {
    startsOn: item.startsOn,
    endsOn: item.endsOn,
    isAvailable: true,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    note: item.note || null
  };
}

async function updateMyWeeklyAvailability(req, res, next) {
  const client = await pool.connect();

  try {
    const { weeklyAvailability } = req.body;

    if (!Array.isArray(weeklyAvailability)) {
      return res.status(400).json({
        error: "Disponibilità settimanale non valida"
      });
    }

    const sitterId = await findMySitterProfileId(req.user.id);

    if (!sitterId) {
      return res.status(400).json({
        error: "Profilo sitter non configurato"
      });
    }

    const cleanedAvailability = weeklyAvailability.map(cleanWeeklyAvailabilityItem);
    const uniqueWeekdays = new Set(cleanedAvailability.map((item) => item && item.weekday));

    if (cleanedAvailability.some((item) => item === null)) {
      return res.status(400).json({
        error: "Giorno o orario non valido"
      });
    }

    if (uniqueWeekdays.size !== cleanedAvailability.length) {
      return res.status(400).json({
        error: "Giorni duplicati nella disponibilità"
      });
    }

    await client.query("begin");
    await client.query("delete from sitter_weekly_availability where sitter_id = $1", [sitterId]);

    for (const item of cleanedAvailability) {
      await client.query(
        `insert into sitter_weekly_availability (sitter_id, weekday, is_available, starts_at, ends_at)
         values ($1, $2, $3, $4, $5)`,
        [sitterId, item.weekday, item.isAvailable, item.startsAt, item.endsAt]
      );
    }

    const result = await client.query(
      `select weekday, is_available, starts_at, ends_at
       from sitter_weekly_availability
       where sitter_id = $1
       order by weekday`,
      [sitterId]
    );

    await client.query("commit");

    return res.json({
      weeklyAvailability: result.rows
    });
  } catch (err) {
    await client.query("rollback");
    return next(err);
  } finally {
    client.release();
  }
}

async function updateMyAvailabilityExceptions(req, res, next) {
  const client = await pool.connect();

  try {
    const { exceptions } = req.body;

    if (!Array.isArray(exceptions)) {
      return res.status(400).json({
        error: "Eccezioni disponibilità non valide"
      });
    }

    const sitterId = await findMySitterProfileId(req.user.id);

    if (!sitterId) {
      return res.status(400).json({
        error: "Profilo sitter non configurato"
      });
    }

    const cleanedExceptions = exceptions.map(cleanAvailabilityExceptionItem);

    if (cleanedExceptions.some((item) => item === null)) {
      return res.status(400).json({
        error: "Data o orario speciale non valido"
      });
    }

    await client.query("begin");
    await client.query("delete from sitter_availability_exceptions where sitter_id = $1", [sitterId]);

    for (const exception of cleanedExceptions) {
      await client.query(
        `insert into sitter_availability_exceptions (sitter_id, starts_on, ends_on, is_available, starts_at, ends_at, note)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [
          sitterId,
          exception.startsOn,
          exception.endsOn,
          exception.isAvailable,
          exception.startsAt,
          exception.endsAt,
          exception.note
        ]
      );
    }

    const result = await client.query(
      `select id, starts_on, ends_on, is_available, starts_at, ends_at, note
       from sitter_availability_exceptions
       where sitter_id = $1
       order by starts_on desc, id desc`,
      [sitterId]
    );

    await client.query("commit");

    return res.json({
      exceptions: result.rows
    });
  } catch (err) {
    await client.query("rollback");
    return next(err);
  } finally {
    client.release();
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
         coalesce((
           select round(avg(r.rating)::numeric, 1)
           from reviews r
           where r.sitter_id = sp.id
         ), 0) as average_rating,
         (
           select count(*)::integer
           from reviews r
           where r.sitter_id = sp.id
         ) as review_count,
         coalesce((
           select json_agg(spt.pet_type order by spt.pet_type)
           from sitter_pet_types spt
           where spt.sitter_id = sp.id
         ), '[]') as pet_types,
         coalesce(
           json_agg(
             json_build_object(
               'id', s.id,
               'name', s.name,
               'price_unit', s.price_unit,
               'availability_mode', s.availability_mode,
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
  getMyAvailability,
  getMySitterProfile,
  listMyPetTypes,
  listMyServices,
  updateMyAvailabilityExceptions,
  updateMyPetTypes,
  updateMyWeeklyAvailability,
  updateMyServices,
  updateMySitterProfile,
  listSitters
};
