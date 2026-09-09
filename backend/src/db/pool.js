// il backend si collega con il database PostgreSQL
const { Pool, types } = require("pg");

// Le colonne PostgreSQL DATE non rappresentano un istante e non devono subire
// conversioni di fuso orario quando vengono inviate al frontend.
types.setTypeParser(1082, (value) => value);

const pool = new Pool({ // pg permette di creare un pool (ovvero una connessione sempre pronta)
  connectionString: process.env.DATABASE_URL
});

module.exports = pool; // viene esportato in modo tale che qualsiasi controller possa usarlo per fare query
