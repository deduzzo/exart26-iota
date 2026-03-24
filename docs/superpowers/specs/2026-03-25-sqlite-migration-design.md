# Design: Migrazione da sails-disk a better-sqlite3

**Data**: 2026-03-25
**Stato**: Approvato

## Obiettivo

Sostituire sails-disk (in-memory) con better-sqlite3 (su disco) come cache locale per eliminare definitivamente l'OOM. Implementare sync blockchain batch + incrementale.

## Problema

sails-disk carica TUTTI i record in RAM. Con 10K+ assistiti (ognuno con chiavi RSA ~2.2KB), la sync dalla blockchain accumula ~3.8GB di heap e crasha. I fix incrementali (SyncCache dirty-tracking, N+1 query, strip keys) non risolvono il problema di fondo: i dati devono stare su disco, non in RAM.

## Architettura

### 1. Storage Layer — `api/utility/db.js`

Modulo singolo che espone un'API Waterline-like su better-sqlite3.

**API pubblica:**
```javascript
const db = require('./db');

// Stessa sintassi di Waterline
db.Assistito.find({ codiceFiscale: 'ABC123' })
db.Assistito.findOne({ id: 5 })
db.Assistito.create({ nome: 'Marco', cognome: 'Rossi', ... })
db.Assistito.update({ id: 5 }, { nome: 'Luca' })
db.Assistito.destroy({ id: 5 })
db.Assistito.count({ chiuso: false })
db.Assistito.find({ lista: 3 }).limit(100)
```

**Dettagli implementativi:**
- File DB: `.tmp/exart26.db`
- Schema creato con `CREATE TABLE IF NOT EXISTS` al primo `require()`
- better-sqlite3 e sincrono nativamente — i metodi vengono wrappati in Promise per compatibilita con i controller async esistenti
- Le operazioni bulk usano transazioni SQLite (`BEGIN`/`COMMIT`) per performance
- `.populate()` di Waterline sostituito con metodi join espliciti in db.js (es. `db.Struttura.findWithOrganizzazione(id)`)

**Schema tabelle:**

```sql
CREATE TABLE IF NOT EXISTS organizzazioni (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  denominazione TEXT NOT NULL,
  publicKey TEXT,
  privateKey TEXT,
  ultimaVersioneSuBlockchain INTEGER DEFAULT 0,
  createdAt INTEGER,
  updatedAt INTEGER
);

CREATE TABLE IF NOT EXISTS strutture (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  denominazione TEXT NOT NULL,
  indirizzo TEXT,
  organizzazione INTEGER REFERENCES organizzazioni(id),
  attiva INTEGER DEFAULT 1,
  publicKey TEXT,
  privateKey TEXT,
  ultimaVersioneSuBlockchain INTEGER DEFAULT 0,
  createdAt INTEGER,
  updatedAt INTEGER
);

CREATE TABLE IF NOT EXISTS liste (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  denominazione TEXT NOT NULL,
  struttura INTEGER REFERENCES strutture(id),
  aperta INTEGER DEFAULT 1,
  tag TEXT,
  publicKey TEXT,
  ultimaVersioneSuBlockchain INTEGER DEFAULT 0,
  createdAt INTEGER,
  updatedAt INTEGER
);

CREATE TABLE IF NOT EXISTS assistiti (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anonId TEXT NOT NULL,
  nome TEXT NOT NULL,
  cognome TEXT NOT NULL,
  codiceFiscale TEXT NOT NULL,
  dataNascita TEXT,
  email TEXT,
  telefono TEXT,
  indirizzo TEXT,
  publicKey TEXT,
  privateKey TEXT,
  ultimaVersioneSuBlockchain INTEGER DEFAULT 0,
  createdAt INTEGER,
  updatedAt INTEGER
);

CREATE TABLE IF NOT EXISTS assistiti_liste (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assistito INTEGER REFERENCES assistiti(id),
  lista INTEGER REFERENCES liste(id),
  stato INTEGER DEFAULT 1,
  chiuso INTEGER DEFAULT 0,
  dataOraIngresso INTEGER,
  dataOraUscita INTEGER,
  createdAt INTEGER,
  updatedAt INTEGER
);

CREATE TABLE IF NOT EXISTS blockchain_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  digest TEXT UNIQUE,
  tag TEXT NOT NULL,
  entityId TEXT,
  version INTEGER,
  payload TEXT,
  timestamp INTEGER,
  cursor TEXT
);

CREATE TABLE IF NOT EXISTS sync_state (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

**Indici:**
```sql
CREATE INDEX IF NOT EXISTS idx_strutture_org ON strutture(organizzazione);
CREATE INDEX IF NOT EXISTS idx_liste_str ON liste(struttura);
CREATE INDEX IF NOT EXISTS idx_assistiti_cf ON assistiti(codiceFiscale);
CREATE INDEX IF NOT EXISTS idx_assistiti_anon ON assistiti(anonId);
CREATE INDEX IF NOT EXISTS idx_al_assistito ON assistiti_liste(assistito);
CREATE INDEX IF NOT EXISTS idx_al_lista ON assistiti_liste(lista);
CREATE INDEX IF NOT EXISTS idx_al_stato ON assistiti_liste(stato, chiuso);
CREATE INDEX IF NOT EXISTS idx_bc_tag ON blockchain_data(tag);
CREATE INDEX IF NOT EXISTS idx_bc_entity ON blockchain_data(tag, entityId);
CREATE INDEX IF NOT EXISTS idx_bc_digest ON blockchain_data(digest);
```

### 2. API db.js — Implementazione Model

Ogni modello e un oggetto con metodi standard:

```javascript
function createModel(tableName, columns) {
  return {
    find(where = {}, options = {}) {
      // Costruisce SELECT ... WHERE ... LIMIT ... ORDER BY
      // Ritorna Promise<Array>
    },
    findOne(where) {
      // SELECT ... WHERE ... LIMIT 1
      // Ritorna Promise<Object|null>
    },
    create(data) {
      // INSERT INTO ... VALUES ...
      // Ritorna Promise<Object> (con id generato)
    },
    update(where, data) {
      // UPDATE ... SET ... WHERE ...
      // Ritorna Promise<Array> (record aggiornati)
    },
    destroy(where) {
      // DELETE FROM ... WHERE ...
      // Ritorna Promise<void>
    },
    count(where = {}) {
      // SELECT COUNT(*) ...
      // Ritorna Promise<Number>
    },
  };
}
```

**Gestione WHERE clause:**
- Oggetto semplice: `{ stato: 1, chiuso: false }` → `WHERE stato = 1 AND chiuso = 0`
- Boolean: `false` → `0`, `true` → `1`
- Array (IN): `{ id: [1, 2, 3] }` → `WHERE id IN (1, 2, 3)`
- Nessun supporto per operatori avanzati Waterline (lessThan, etc.) — non usati nel progetto

**Metodi extra per join (sostituiscono .populate()):**
```javascript
db.Struttura.findWithOrganizzazione(id)
// SELECT s.*, o.denominazione as orgDenominazione FROM strutture s
// LEFT JOIN organizzazioni o ON s.organizzazione = o.id WHERE s.id = ?

db.AssistitiListe.findWithDetails(where)
// SELECT al.*, a.nome, a.cognome, a.codiceFiscale, a.anonId,
//   l.denominazione as listaDenominazione
// FROM assistiti_liste al
// LEFT JOIN assistiti a ON al.assistito = a.id
// LEFT JOIN liste l ON al.lista = l.id
// WHERE ...
```

### 3. Blockchain Sync — Batch + Incrementale

**Batch download (primo avvio o reset):**

```
1. queryTransactionBlocks({ filter: { FromAddress }, options: { limit: 50 } })
   → pagina di 50 TX
2. Per ogni TX: decodifica payload u64, scrivi in blockchain_data
3. Prossima pagina (cursor) fino a esaurimento
4. Tutto in una transazione SQLite atomica (BEGIN/COMMIT)
5. Nessun array in RAM — ogni TX processata e scritta immediatamente
6. Ricostruisci tabelle entita da blockchain_data
7. Salva ultimo cursor in sync_state
```

**Sync incrementale (avvii successivi):**

```
1. Leggi ultimo cursor da sync_state
2. queryTransactionBlocks({ filter: { FromAddress }, cursor: lastCursor })
   → solo TX nuove
3. Processa e scrivi solo le nuove
4. Aggiorna tabelle entita interessate
5. Aggiorna cursor in sync_state
```

**Risultati attesi:**
- Primo avvio: ~30 sec (download batch completo)
- Avvii successivi: ~1-2 sec (solo TX nuove)
- Zero accumulo RAM — ogni TX va su disco

### 4. Impatto sui file del progetto

**Nuovi:**
- `api/utility/db.js` — Storage layer SQLite (~300 righe)

**Modifiche maggiori:**
- `api/utility/ListManager.js` — Sync batch + incrementale, usa db.js
- `api/utility/iota.js` — `_queryTransactionsFromChain()` con cursor paging, early exit per `getLastDataByTag`
- `config/bootstrap.js` — Init db.js, sync incrementale

**Modifiche meccaniche (s/Model.method/db.Model.method/):**
- `api/controllers/add-organizzazione.js`
- `api/controllers/add-struttura.js`
- `api/controllers/add-lista.js`
- `api/controllers/add-assistito.js`
- `api/controllers/add-assistito-in-lista.js`
- `api/controllers/rimuovi-assistito-da-lista.js`
- `api/controllers/inizializza-dati-di-prova.js`
- `api/controllers/api-dashboard.js`
- `api/controllers/api-organizzazioni.js`
- `api/controllers/api-strutture.js`
- `api/controllers/api-assistiti.js`
- `api/controllers/api-liste-dettaglio.js`
- `api/controllers/api-graph-data.js`
- `api/controllers/api-debug.js`
- `api/controllers/api-public.js`
- `api/controllers/recover-from-arweave.js`
- `api/controllers/arweave/consistency.js`

**Rimossi:**
- `api/utility/SyncCache.js` — Sostituito da SQLite
- `api/models/Organizzazione.js` — Schema in db.js
- `api/models/Struttura.js` — Schema in db.js
- `api/models/Lista.js` — Schema in db.js
- `api/models/Assistito.js` — Schema in db.js
- `api/models/AssistitiListe.js` — Schema in db.js
- `api/models/BlockchainData.js` — Schema in db.js

**Nota:** I file `api/models/*.js` NON vengono eliminati fisicamente — vengono svuotati (modello vuoto) per evitare che Sails.js cerchi di creare tabelle sails-disk. In alternativa, si disabilita l'ORM Waterline in `config/models.js`.

**Config:**
- `config/datastores.js` — Rimuovere configurazione sails-disk (o lasciare vuota)
- `config/models.js` — Disabilitare migrate: 'alter'
- `.tmp/sync-cache.json` — Non piu usato (sostituito da `.tmp/exart26.db`)

### 5. Strategia di migrazione

L'ordine di implementazione garantisce che il sistema funzioni ad ogni step:

1. **db.js** — Creare il modulo con schema e API. Testabile standalone.
2. **Bootstrap** — Init db.js, importare dati da sync-cache.json esistente (migrazione una-tantum)
3. **Controller CRUD** — Migrare uno alla volta: add-organizzazione, add-struttura, etc.
4. **Controller API** — Migrare: api-strutture, api-debug, api-graph-data, etc.
5. **ListManager** — Riscrivere sync con batch download + incrementale
6. **iota.js** — Ottimizzare _queryTransactionsFromChain con cursor paging
7. **Cleanup** — Rimuovere SyncCache, svuotare models, aggiornare config

### 6. Dipendenze

- `better-sqlite3` — Da installare: `npm install better-sqlite3`
- Nessun'altra dipendenza nuova

### 7. Rischi e mitigazioni

| Rischio | Mitigazione |
|---------|-------------|
| better-sqlite3 richiede compilazione nativa | Prebuilt binaries disponibili per macOS/Linux/Windows |
| I controller usano .populate() di Waterline | Sostituire con metodi join espliciti in db.js |
| customToJSON() nei modelli omette privateKey | Implementare la stessa logica nel serializer di db.js |
| La sync incrementale potrebbe perdere TX | Fallback: se cursor non valido, risync completa |
| Concurrent writes durante la sync | better-sqlite3 e sincrono, nessun problema di concorrenza |
