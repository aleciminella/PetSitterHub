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
JWT_SECRET=dev-secret
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

La risposta contiene anche un token da usare nelle API protette.

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

La risposta contiene anche un token da usare nelle API protette.

## Servizi

Elenco servizi disponibili:

```text
GET http://localhost:3000/api/services
```

Ogni servizio include descrizione, tipo tariffa, modalità disponibilità e animali supportati.

## Animali proprietario

Elenco animali del proprietario autenticato:

```text
GET http://localhost:3000/api/pets
Authorization: Bearer token
```

Risposte principali:

```text
200 elenco animali
401 token mancante o non valido
403 ruolo non autorizzato
```

Aggiunta animale:

```text
POST http://localhost:3000/api/pets
Authorization: Bearer token
```

Body JSON:

```json
{
  "name": "Luna",
  "species": "cane",
  "breed": "Labrador",
  "age": 4,
  "notes": "Ama le passeggiate lunghe."
}
```

Risposte principali:

```text
201 animale creato
400 nome o specie mancanti
401 token mancante o non valido
403 ruolo non autorizzato
409 animale già presente per il proprietario
```

Modifica animale:

```text
PUT http://localhost:3000/api/pets/:id
Authorization: Bearer token
```

Body JSON:

```json
{
  "name": "Luna",
  "species": "cane",
  "breed": "Labrador",
  "age": 5,
  "notes": "Ama le passeggiate lunghe."
}
```

Risposte principali:

```text
200 animale modificato
400 nome o specie mancanti
401 token mancante o non valido
403 ruolo non autorizzato
404 animale non trovato
409 animale già presente per il proprietario
```

Eliminazione animale:

```text
DELETE http://localhost:3000/api/pets/:id
Authorization: Bearer token
```

Risposte principali:

```text
204 animale eliminato
401 token mancante o non valido
403 ruolo non autorizzato
404 animale non trovato
```

Risposta:

```json
{
  "services": [
    {
      "id": "1",
      "name": "Passeggiata",
      "description": "Uscita con il cane per una durata concordata.",
      "price_unit": "hourly",
      "availability_mode": "hourly_slot",
      "pet_types": ["cane"]
    }
  ]
}
```

## Prenotazioni

Elenco prenotazioni:

```text
GET http://localhost:3000/api/bookings
Authorization: Bearer token
```

Se l'utente è proprietario vede le proprie prenotazioni. Se l'utente è sitter vede le richieste ricevute.
Ogni prenotazione include anche i dati del pagamento, se già registrato.

Filtri disponibili:

```text
GET http://localhost:3000/api/bookings?period=future
GET http://localhost:3000/api/bookings?period=past
GET http://localhost:3000/api/bookings?period=all
GET http://localhost:3000/api/bookings?limit=5&offset=0
```

`period` permette di filtrare prenotazioni future, passate o tutte. `limit` e `offset` servono per mostrare le prenotazioni a blocchi, ad esempio 5 alla volta.

Risposte principali:

```text
200 elenco prenotazioni
401 token mancante o non valido
403 ruolo non autorizzato
```

Creazione richiesta prenotazione:

```text
POST http://localhost:3000/api/bookings
Authorization: Bearer token
```

Body JSON:

```json
{
  "sitterId": 1,
  "serviceId": 1,
  "petId": 1,
  "startsAt": "2026-09-23T08:00:00.000Z",
  "endsAt": "2026-09-23T09:00:00.000Z",
  "notes": "Prima passeggiata di prova."
}
```

Risposte principali:

```text
201 richiesta creata
400 campi mancanti, date non valide o servizio non compatibile
401 token mancante o non valido
403 ruolo non autorizzato
```

Il prezzo totale viene calcolato in base alla tariffa configurata per sitter, servizio e animale.

### Messaggi prenotazione

Proprietario e sitter possono leggere e inviare messaggi solo sulle prenotazioni in cui sono coinvolti.

```text
GET http://localhost:3000/api/bookings/:bookingId/messages
Authorization: Bearer token
```

```text
POST http://localhost:3000/api/bookings/:bookingId/messages
Authorization: Bearer token
Content-Type: application/json
```

Body JSON:

```json
{
  "body": "Ciao, possiamo concordare i dettagli del servizio?"
}
```

Risposte principali:

```text
200 elenco messaggi
201 messaggio creato
400 messaggio mancante
401 token mancante o non valido
404 prenotazione non trovata
```

### Recensioni

Le recensioni pubbliche di un sitter sono consultabili senza login.

```text
GET http://localhost:3000/api/sitters/:sitterId/reviews
```

Il proprietario può recensire una prenotazione solo quando è completata.

```text
POST http://localhost:3000/api/bookings/:bookingId/reviews
Authorization: Bearer token_owner
Content-Type: application/json
```

Body JSON:

```json
{
  "rating": 5,
  "comment": "Servizio puntuale e molto curato."
}
```

Risposte principali:

```text
200 elenco recensioni
201 recensione creata
400 valutazione non valida o prenotazione non completata
401 token mancante o non valido
403 ruolo non autorizzato
409 recensione già inserita
```

### Pagamenti demo

Il proprietario può registrare un pagamento demo solo dopo che il sitter ha accettato la richiesta.

```text
POST http://localhost:3000/api/bookings/:bookingId/payments
Authorization: Bearer token_owner
Content-Type: application/json
```

Body JSON:

```json
{
  "method": "demo_card"
}
```

Metodi disponibili:

```text
demo_card
bank_transfer
```

Risposte principali:

```text
201 pagamento registrato
400 metodo non valido o prenotazione non ancora accettata
401 token mancante o non valido
403 ruolo non autorizzato
404 prenotazione non trovata
409 pagamento già registrato
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
GET http://localhost:3000/api/sitters?petType=cane
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
          "pet_type": "cane",
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

Filtro per animale:

```bash
curl "http://localhost:3000/api/sitters?petType=cane"
```

Account sitter demo:

```text
giulia.sitter@example.com / password123
luca.sitter@example.com / password123
```


### Aggiornamento stato prenotazione

Il sitter può accettare o rifiutare una richiesta ancora in attesa. Una richiesta può essere accettata solo se il sitter non ha già un'altra prenotazione accettata nello stesso intervallo.

```http
PATCH http://localhost:3000/api/bookings/:id/accept
Authorization: Bearer <token_sitter>
```

```http
PATCH http://localhost:3000/api/bookings/:id/reject
Authorization: Bearer <token_sitter>
```

Il proprietario può annullare una propria prenotazione se non è già chiusa.

```http
PATCH http://localhost:3000/api/bookings/:id/cancel
Authorization: Bearer <token_owner>
```
