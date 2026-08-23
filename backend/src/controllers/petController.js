const pool = require("../db/pool");

async function createPet(req, res, next) {
  try {
    const { name, species, breed, age, notes } = req.body;

    if (!name || !species) {
      return res.status(400).json({
        error: "Nome e specie sono obbligatori"
      });
    }

    const result = await pool.query(
      `insert into pets (owner_id, name, species, breed, age, notes)
       values ($1, $2, $3, $4, $5, $6)
       returning id, name, species, breed, age, notes, created_at`,
      [req.user.id, name, species, breed || null, age || null, notes || null]
    );

    return res.status(201).json({
      pet: result.rows[0]
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({
        error: "Hai già inserito un animale con questo nome"
      });
    }

    return next(err);
  }
}

async function deletePet(req, res, next) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `delete from pets
       where id = $1 and owner_id = $2
       returning id`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Animale non trovato"
      });
    }

    return res.sendStatus(204);
  } catch (err) {
    return next(err);
  }
}

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

async function updatePet(req, res, next) {
  try {
    const { id } = req.params;
    const { name, species, breed, age, notes } = req.body;

    if (!name || !species) {
      return res.status(400).json({
        error: "Nome e specie sono obbligatori"
      });
    }

    const result = await pool.query(
      `update pets
       set name = $1,
           species = $2,
           breed = $3,
           age = $4,
           notes = $5
       where id = $6 and owner_id = $7
       returning id, name, species, breed, age, notes, created_at`,
      [name, species, breed || null, age || null, notes || null, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Animale non trovato"
      });
    }

    return res.json({
      pet: result.rows[0]
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({
        error: "Hai già inserito un animale con questo nome"
      });
    }

    return next(err);
  }
}

module.exports = {
  createPet,
  deletePet,
  listPets,
  updatePet
};
