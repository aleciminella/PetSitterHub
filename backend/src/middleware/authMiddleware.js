const jwt = require("jsonwebtoken");

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET non configurato");
  }

  return process.env.JWT_SECRET;
}

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role
    },
    getJwtSecret(),
    {
      expiresIn: "2h"
    }
  );
}

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Token mancante"
    });
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    req.user = jwt.verify(token, getJwtSecret());
    return next();
  } catch (err) {
    return res.status(401).json({
      error: "Token non valido"
    });
  }
}

function requireRole(role) {
  return function checkRole(req, res, next) {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({
        error: "Operazione non autorizzata"
      });
    }

    return next();
  };
}

module.exports = {
  createToken,
  requireRole,
  verifyToken
};
