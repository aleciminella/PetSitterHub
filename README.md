# PetSitterHub
Piattaforma web per la ricerca, prenotazione e gestione di servizi di pet-sitting e dog-walking.

## Avvio con Docker

Docker avvia PostgreSQL, backend Express e frontend statico.

Prima del primo avvio creare il file di configurazione Docker:

```bash
cp .env.docker.example .env.docker
```

```bash
docker compose up --build
```

Le porte e le credenziali locali si possono cambiare nel file `.env.docker`.

Al primo avvio Docker crea il database usando `database/schema.sql` e `database/seed.sql`.
Se bisogna ricreare il database da zero:

```bash
docker compose down -v
docker compose up --build
```

## Avvio manuale

L'avvio manuale usa PostgreSQL installato sul computer, non il database Docker.

Configurare il backend:

```bash
cd backend
cp .env.example .env
npm install
```

Nel file `backend/.env` il backend deve ascoltare sulla porta `4000`, perché il frontend chiama le API su `http://localhost:4000/api`.

```env
PORT=4000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/petsitterhub
JWT_SECRET=dev-secret
FRONTEND_ORIGIN=http://localhost:5500
```

Creare il database locale `petsitterhub` e caricare schema e dati demo:

```bash
psql -d petsitterhub -f ../database/schema.sql
psql -d petsitterhub -f ../database/seed.sql
```

Avviare il backend:

```bash
npm start
```

In un secondo terminale avviare il frontend statico dalla cartella `frontend`:

```bash
cd /percorso/PetSitterHub/frontend
python3 -m http.server 5500
```

Indirizzi locali manuali:

```text
Frontend: http://localhost:5500/index.html
Backend:  http://localhost:4000/api/health
Database: localhost:5432
```

Se le API non caricano in manuale, controllare prima `http://localhost:4000/api/health/db`: se fallisce, PostgreSQL locale non è acceso o `DATABASE_URL` non corrisponde al proprio database.

