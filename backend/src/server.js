// server.js è il file indicato nel package.json come punto di partenza
// si occupa di accendere il server e metterlo in ascolto

require("dotenv").config(); // carica le variabili segrete

const app = require("./app"); // importa app.js

const port = process.env.PORT || 3000;

app.listen(port, () => { // si mette in ascolto sulla porta
  console.log(`PetSitterHub API listening on port ${port}`);
});
