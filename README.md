# PetSitterHub
Piattaforma web per la ricerca, prenotazione e gestione di servizi di pet-sitting e dog-walking.

## Avvio con Docker

Docker avvia PostgreSQL, backend Express e frontend statico.

```bash
docker compose up --build
```

Indirizzi locali:

```text
Frontend: http://localhost:5500
Backend:  http://localhost:4000/api/health
Database: localhost:5433
```

Credenziali database Docker:

```text
Database: petsitterhub
Utente: petsitterhub
Password: petsitterhub
```

Al primo avvio Docker crea il database usando `database/schema.sql` e `database/seed.sql`.
Se bisogna ricreare il database da zero:

```bash
docker compose down -v
docker compose up --build
```
