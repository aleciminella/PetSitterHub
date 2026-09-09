const jwt = require("jsonwebtoken");
const pool = require("../db/pool");

function getJwtSecret() { // ritorna chiave segreta del token, se non c'è nel file env blocca tutto con un errore
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET non configurato");
  }

  return process.env.JWT_SECRET;
}

function createToken(user) { // viene usata quando un utente fa login/registrazione
  return jwt.sign( // prende i dati dell'utente e li impacchetta in una stringa crittografata
    {
      id: user.id,
      role: user.role
    },
    getJwtSecret(),
    {
      expiresIn: "2h" // tempo dopo il quale bisogna rifare il login
    }
  );
}


// middleware che si mette davanti alle rotte private
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  // Guarda se nella richiesta inviata dal browser c'è l'intestazione Authorization e se inizia con la dicitura Bearer (usata per convenzione)
  if (!authHeader || !authHeader.startsWith("Bearer ")) { // se non c'è rimbalza utente con errore 401
    return res.status(401).json({
      error: "Token mancante"
    });
  }

  const token = authHeader.replace("Bearer ", ""); // toglie Bearer per tenere solo il codice del token

  let tokenUser;

  try {
    tokenUser = jwt.verify(token, getJwtSecret());
  } catch (err) {
    return res.status(401).json({
      error: "Token non valido"
    });
  }

  try {
    const result = await pool.query(
      `select id, role
       from users
       where id = $1
         and is_active = true`,
      [tokenUser.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "Account non attivo"
      });
    }

    req.user = result.rows[0];
    return next();
  } catch (err) {
    return next(err);
  }
}


// Serve a distinguere chi può fare cosa
function requireRole(role) {
  return function checkRole(req, res, next) {
    if (!req.user || req.user.role !== role) { // la prima condizione serve ad evitare errore
      return res.status(403).json({
        error: "Operazione non autorizzata"
      });
    }

    return next();
  };
}

module.exports = { // rende disponibili queste 3 funzioni a tutti gli altri file del backend
  createToken,
  requireRole,
  verifyToken
};
