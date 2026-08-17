const bcrypt = require("bcrypt");
const pool = require("../db/pool");

const allowedRoles = ["owner", "sitter", "admin"];

async function register(req, res, next) {
  try {
    const { email, password, firstName, lastName, role, phone, city } = req.body;

    if (!email || !password || !firstName || !lastName || !role) {
      return res.status(400).json({
        error: "Mancano campi richiesti"
      });
    }

    if (!allowedRoles.includes(role)) {
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

    return res.status(201).json({
      user: result.rows[0]
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

module.exports = {
  register
};
