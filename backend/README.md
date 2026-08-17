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

## Autenticazione

Registrazione utente:

```text
POST http://localhost:3000/api/auth/register
```

Body JSON:

```json
{
  "email": "mario.rossi@example.com",
  "password": "password123",
  "firstName": "Mario",
  "lastName": "Rossi",
  "role": "owner",
  "phone": "3331234567",
  "city": "Roma"
}
```

Ruoli ammessi:

```text
owner
sitter
admin
```

Risposte principali:

```text
201 utente creato
400 campi mancanti o ruolo non valido
409 email già registrata
```
