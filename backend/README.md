# Backend

Backend Express per PetSitterHub.

## Requisiti

- Node.js
- PostgreSQL attivo in locale

## Installazione

Installare le dipendenze:

```bash
npm install
```

Creare il file di configurazione locale:

```bash
cp .env.example .env
```

Aggiornare `.env` con i dati del proprio database PostgreSQL.

Esempio:

```env
PORT=3000
DATABASE_URL=postgres://utente:password@localhost:5432/petsitterhub
```

## Avvio

```bash
npm start
```

## Verifiche

Controllo server:

```text
GET http://localhost:3000/api/health
```

Controllo connessione database:

```text
GET http://localhost:3000/api/health/db
```
