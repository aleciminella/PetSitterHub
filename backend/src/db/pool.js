// il backend si collega con il database PostgreSQL
const { Pool } = require("pg");

const pool = new Pool({ // pg permette di creare un pool (ovvero una connessione sempre pronta)
  connectionString: process.env.DATABASE_URL
});

module.exports = pool; // viene esportato in modo tale che qualsiasi controller possa usarlo per fare query
