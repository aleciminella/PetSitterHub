# DevOps

## Pipeline CI

La pipeline di integrazione continua è definita nel file `.github/workflows/ci.yml` e viene eseguita da GitHub Actions.

La pipeline parte automaticamente:

- quando viene aperta o aggiornata una pull request verso `main`;
- quando viene eseguito un push su `main`, compreso il merge di una pull request.

Un push su un altro branch non avvia direttamente la pipeline. I test partono quando quel branch viene proposto in una pull request verso `main`.

## Operazioni eseguite

Per ogni esecuzione GitHub crea una macchina virtuale Ubuntu temporanea e svolge questi passaggi:

1. scarica il repository;
2. avvia un container PostgreSQL 17 dedicato ai test;
3. installa Node.js 24 e le dipendenze backend con `npm ci`;
4. crea le tabelle usando `database/schema.sql`;
5. inserisce i dati demo usando `database/seed.sql`;
6. esegue i tre test automatici con `npm test`.

Il database della pipeline è temporaneo e indipendente sia dal PostgreSQL locale sia dal database Docker usato durante lo sviluppo.

## Esito dei controlli

Il job richiesto si chiama `test-backend`:

- verde: tutti i test sono stati superati;
- rosso: almeno un passaggio o un test è fallito;
- giallo: la pipeline è ancora in esecuzione.

I dettagli e i log sono consultabili nella scheda **Actions** del repository oppure nella sezione dei controlli della pull request.

## Protezione di main

Il ruleset `Protezione main` applica queste regole al branch predefinito:

- le modifiche devono passare attraverso una pull request;
- il controllo `test-backend` deve essere superato prima del merge;
- il branch della pull request deve essere aggiornato rispetto a `main`;
- force push ed eliminazione di `main` sono bloccati.

Il flusso di lavoro previsto è quindi:

```text
branch di lavoro -> push -> pull request -> test automatici -> merge in main
```

## Esecuzione locale

Gli stessi test possono essere eseguiti localmente seguendo le istruzioni presenti in `backend/README.md`. L'esecuzione locale è utile per controllare le modifiche prima del push, mentre la pipeline GitHub rappresenta la verifica condivisa prima del merge.

## Distribuzione continua

Il deploy cloud non è ancora configurato. Di conseguenza il progetto dispone attualmente della CI, ma non della CD: un merge in `main` esegue i test senza pubblicare automaticamente l'applicazione.
