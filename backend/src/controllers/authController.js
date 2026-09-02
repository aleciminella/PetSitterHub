const bcrypt = require("bcrypt");
const pool = require("../db/pool");
const { createToken } = require("../middleware/authMiddleware");

const allowedRegistrationRoles = ["owner", "sitter"];

async function register(req, res, next) {
  try {
    const { email, password, firstName, lastName, role, phone, city } = req.body;

    if (!email || !password || !firstName || !lastName || !role) {
      return res.status(400).json({
        error: "Mancano campi richiesti"
      });
    }

    if (!allowedRegistrationRoles.includes(role)) {
      return res.status(400).json({
        error: "Ruolo invalido"
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `insert into users (email, password_hash, first_name, last_name, role, phone, city)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id, email, first_name, last_name, role, phone, city, created_at`,
      [email, passwordHash, firstName, lastName, role, phone || null, city || null]
    );

    const user = result.rows[0];

    return res.status(201).json({
      user,
      token: createToken(user)
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({
        error: "Email già registrata"
      });
    }

    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Mancano email o password"
      });
    }

    const result = await pool.query(
      `select id, email, password_hash, first_name, last_name, role, phone, city, created_at
       from users
       where email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "Credenziali non valide"
      });
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({
        error: "Credenziali non valide"
      });
    }

    delete user.password_hash;

    return res.json({
      user,
      token: createToken(user)
    });
  } catch (err) {
    return next(err);
  }
}

async function getProfile(req, res, next) {
  try {
    const result = await pool.query(
      `select id, email, first_name, last_name, role, phone, city, created_at
       from users
       where id = $1`,
      [req.user.id]
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
  getProfile,
  login,
  register
};
