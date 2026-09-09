const bcrypt = require("bcrypt"); // libreria che trasforma le password in una sequenza indecifrabile di caratteri (hash).
const pool = require("../db/pool"); // collegamento al database PostgreSQL
const { createToken } = require("../middleware/authMiddleware");

const allowedRegistrationRoles = ["owner", "sitter"]; // un utente che si iscrive può essere solo owner o sitter

async function register(req, res, next) {
  let client;
  let transactionStarted = false;

  try {
    const { email, password, firstName, lastName, role, city } = req.body; // Estrae i dati dal corpo della richiesta inviata dal browser (req.body)

    if (!email || !password || !firstName || !lastName || !role || !city || city.trim().length === 0) { // Se manca anche solo uno dei campi obbligatori, blocca subito tutto con codice 400 Bad Request (Richiesta errata)
      return res.status(400).json({
        error: "Mancano campi richiesti"
      });
    }

    if (!allowedRegistrationRoles.includes(role)) {
      return res.status(400).json({
        error: "Ruolo invalido"
      });
    }

    const passwordHash = await bcrypt.hash(password, 10); // crittografia della password prima di inserirla nel db

    // per evitare SQL Injection (prende dati dall'array e li mette con $)
    client = await pool.connect();
    await client.query("begin");
    transactionStarted = true;

    const result = await client.query(
      `insert into users (email, password_hash, first_name, last_name, role, city)
       values ($1, $2, $3, $4, $5, $6)
       returning id, email, first_name, last_name, role, phone, city, created_at`,
      [email, passwordHash, firstName, lastName, role, city.trim()]
    );

    const user = result.rows[0]; // scheda utente

    if (role === "sitter") {
      await client.query(
        `insert into sitter_profiles (user_id, base_city)
         values ($1, $2)`,
        [user.id, user.city]
      );
    }

    await client.query("commit");
    transactionStarted = false;

    return res.status(201).json({ // trasforma i dati (scheda utente e token) in formato json e li spedisce al browser
      user,
      token: createToken(user)
    });
  } catch (err) {
    if (transactionStarted) {
      await client.query("rollback");
    }

    if (err.code === "23505") { // codice PostgreSQL che indica doppione
      return res.status(409).json({
        error: "Email già registrata"
      });
    }

    return next(err);
  } finally {
    if (client) {
      client.release();
    }
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) { // controllo sui campi vuoti
      return res.status(400).json({
        error: "Mancano email o password"
      });
    }

    const result = await pool.query(
      `select id, email, password_hash, first_name, last_name, role, phone, city, created_at
       from users
       where email = $1
         and is_active = true`,
      [email]
    );

    if (result.rows.length === 0) { // Se la ricerca non trova nessun utente con quell'email, l'array rows sarà completamente vuoto (lunghezza = 0).
      return res.status(401).json({
        error: "Credenziali non valide"
      });
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash); // paragono la password inserita con quella salvata

    if (!passwordMatches) { // se non corrispondono restituisco errore
      return res.status(401).json({
        error: "Credenziali non valide"
      });
    }

    delete user.password_hash; // cancella password cifrata dalla memoria prima di inviare dati al browser

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
       where id = $1
         and is_active = true`,
      [req.user.id] // dal token
    );

    if (result.rows.length === 0) { // messo per sicurezza (es. un amministratore ha cancellato un utente)
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
