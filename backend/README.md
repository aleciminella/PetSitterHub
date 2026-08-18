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

Login utente:

```text
POST http://localhost:3000/api/auth/login
```

Body JSON:

```json
{
  "email": "mario.rossi@example.com",
  "password": "password123"
}
```

Risposte principali:

```text
200 login riuscito
400 email o password mancanti
401 credenziali non valide
```

## Servizi

Elenco servizi disponibili:

```text
GET http://localhost:3000/api/services
```

Risposta:

```json
{
  "services": [
    {
      "id": "1",
      "name": "Passeggiata",
      "description": "Passeggiata per cani di durata concordata."
    }
  ]
}
```

## Sitter

Elenco sitter:

```text
GET http://localhost:3000/api/sitters
```

Filtri disponibili:

```text
GET http://localhost:3000/api/sitters?city=Roma
GET http://localhost:3000/api/sitters?service=Passeggiata
```

Risposta:

```json
{
  "sitters": [
    {
      "id": "1",
      "bio": "Mi occupo di cani e gatti con esperienza e attenzione.",
      "base_city": "Roma",
      "verified": true,
      "first_name": "Giulia",
      "last_name": "Bianchi",
      "services": [
        {
          "id": 1,
          "name": "Passeggiata",
          "price": 12
        }
      ]
    }
  ]
}
```

## Test manuali catalogo

Se nel file `.env` viene usata una porta diversa da `3000`, sostituire la porta negli esempi.

Servizi:

```bash
curl http://localhost:3000/api/services
```

Elenco sitter:

```bash
curl http://localhost:3000/api/sitters
```

Filtro per città:

```bash
curl "http://localhost:3000/api/sitters?city=Roma"
```

Filtro per servizio:

```bash
curl "http://localhost:3000/api/sitters?service=Passeggiata"
```

Account sitter demo:

```text
giulia.sitter@example.com / password123
luca.sitter@example.com / password123
```
