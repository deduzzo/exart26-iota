# SQLite Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire sails-disk (in-memory, causa OOM a 3.8GB) con better-sqlite3 (su disco) ed implementare sync blockchain batch + incrementale.

**Architecture:** Un modulo `db.js` espone API Waterline-like su SQLite. I controller cambiano solo l'import (`db.Assistito.find()` invece di `Assistito.find()`). La sync blockchain scarica TX in batch con cursor paging e scrive direttamente su SQLite senza accumulare in RAM. Sync incrementale per avvii successivi.

**Tech Stack:** better-sqlite3, Sails.js (framework solo per routing/HTTP, ORM bypassato)

**Spec:** `docs/superpowers/specs/2026-03-25-sqlite-migration-design.md`

---

## File Structure

**Nuovo:**
- `api/utility/db.js` — Storage layer SQLite con API Waterline-like (~400 righe)

**Modifiche maggiori:**
- `config/bootstrap.js` — Init db.js, rimuovi SyncCache, sync incrementale
- `api/utility/ListManager.js` — Sync batch + incrementale, usa db.js
- `config/datastores.js` — Disabilita sails-disk
- `config/models.js` — Disabilita migration

**Modifiche meccaniche (17 controller):**
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
- `api/controllers/api-sync-reset.js`
- `api/controllers/fetch-db-from-blockchain.js`
- `api/controllers/recover-from-arweave.js`
- `api/controllers/wallet/reset-wallet.js`
- `api/controllers/arweave/consistency.js`

**Non toccare (Waterline model files):**
- `api/models/*.js` — Restano per evitare errori Sails.js al boot, ma non vengono usati. Sails.js ignora i modelli se `migrate: 'safe'`.

---

### Task 1: Installare better-sqlite3 e creare db.js con schema

**Files:**
- Create: `api/utility/db.js`

- [ ] **Step 1: Installare better-sqlite3**

```bash
npm install better-sqlite3
```

- [ ] **Step 2: Creare db.js con init DB e schema**

Creare `api/utility/db.js` con:
1. Init better-sqlite3 con file `.tmp/exart26.db`
2. `CREATE TABLE IF NOT EXISTS` per tutte le 6 tabelle
3. `CREATE INDEX IF NOT EXISTS` per tutti gli indici
4. Funzione `_buildWhere(where)` che converte oggetti Waterline-like in SQL WHERE clause
5. Tabella `sync_state` per il cursor incrementale

Schema tabelle (da spec):
- `organizzazioni`: id, denominazione, publicKey, privateKey, ultimaVersioneSuBlockchain, createdAt, updatedAt
- `strutture`: id, denominazione, indirizzo, organizzazione (FK), attiva, publicKey, privateKey, ultimaVersioneSuBlockchain, createdAt, updatedAt
- `liste`: id, denominazione, tag, struttura (FK), aperta, publicKey, ultimaVersioneSuBlockchain, createdAt, updatedAt
- `assistiti`: id, anonId, nome, cognome, codiceFiscale, dataNascita, email, telefono, indirizzo, publicKey, privateKey, ultimaVersioneSuBlockchain, createdAt, updatedAt
- `assistiti_liste`: id, assistito (FK), lista (FK), stato, chiuso, dataOraIngresso, dataOraUscita, createdAt, updatedAt
- `blockchain_data`: id, digest (UNIQUE), tag, entityId, version, payload, timestamp, cursor
- `sync_state`: key (PK), value

Booleani: SQLite non ha boolean nativo. Usare INTEGER 0/1. Il layer db.js converte `true→1`, `false→0` in input e `1→true`, `0→false` in output per i campi boolean (`attiva`, `aperta`, `chiuso`).

- [ ] **Step 3: Commit**

```bash
git add api/utility/db.js package.json package-lock.json
git commit -m "feat: db.js con better-sqlite3 schema e init"
```

---

### Task 2: API Waterline-like in db.js (createModel factory)

**Files:**
- Modify: `api/utility/db.js`

- [ ] **Step 1: Implementare createModel(tableName, options)**

Factory function che genera un oggetto con metodi CRUD:

```javascript
function createModel(tableName, opts = {}) {
  const booleanFields = opts.booleanFields || [];
  const omitFromJSON = opts.omitFromJSON || [];

  function toRow(data) {
    // Converte: true→1, false→0, Date→timestamp
    // Aggiunge createdAt/updatedAt se non presenti
  }

  function fromRow(row) {
    // Converte: 1→true, 0→false per booleanFields
    // Omette campi in omitFromJSON (per customToJSON)
  }

  return {
    find(where = {}, options = {}) {
      // SELECT * FROM tableName WHERE ... LIMIT ... ORDER BY ...
      const { sql, params } = buildSelect(tableName, where, options);
      const rows = database.prepare(sql).all(...params);
      return rows.map(fromRow);
    },

    findOne(where) {
      const { sql, params } = buildSelect(tableName, where, { limit: 1 });
      const row = database.prepare(sql).get(...params);
      return row ? fromRow(row) : null;
    },

    create(data) {
      const row = toRow(data);
      const cols = Object.keys(row);
      const placeholders = cols.map(() => '?').join(', ');
      const stmt = database.prepare(
        `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders})`
      );
      const result = stmt.run(...cols.map(c => row[c]));
      return { ...row, id: result.lastInsertRowid };
    },

    update(where, data) {
      const row = toRow({ ...data, updatedAt: Date.now() });
      const setClauses = Object.keys(row).map(k => `${k} = ?`);
      const { whereClause, whereParams } = buildWhere(where);
      const stmt = database.prepare(
        `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE ${whereClause}`
      );
      stmt.run(...Object.values(row), ...whereParams);
      return this.find(where);
    },

    updateOne(where) {
      // Ritorna oggetto con .set(data) per compatibilita Waterline
      return {
        set: (data) => {
          const rows = this.update(where, data);
          return rows[0] || null;
        }
      };
    },

    destroy(where) {
      const { whereClause, whereParams } = buildWhere(where);
      database.prepare(`DELETE FROM ${tableName} WHERE ${whereClause}`).run(...whereParams);
    },

    count(where = {}) {
      const { whereClause, whereParams } = buildWhere(where);
      const row = database.prepare(
        `SELECT COUNT(*) as cnt FROM ${tableName} WHERE ${whereClause}`
      ).get(...whereParams);
      return row.cnt;
    },
  };
}
```

- [ ] **Step 2: Implementare buildWhere(where)**

```javascript
function buildWhere(where) {
  if (!where || Object.keys(where).length === 0) {
    return { whereClause: '1=1', whereParams: [] };
  }
  const clauses = [];
  const params = [];
  for (const [key, value] of Object.entries(where)) {
    if (Array.isArray(value)) {
      clauses.push(`${key} IN (${value.map(() => '?').join(', ')})`);
      params.push(...value);
    } else if (value === null) {
      clauses.push(`${key} IS NULL`);
    } else if (typeof value === 'boolean') {
      clauses.push(`${key} = ?`);
      params.push(value ? 1 : 0);
    } else {
      clauses.push(`${key} = ?`);
      params.push(value);
    }
  }
  return { whereClause: clauses.join(' AND '), whereParams: params };
}
```

- [ ] **Step 3: Implementare buildSelect(tableName, where, options)**

```javascript
function buildSelect(tableName, where, options = {}) {
  const { whereClause, whereParams } = buildWhere(where);
  let sql = `SELECT * FROM ${tableName} WHERE ${whereClause}`;
  if (options.sort) {
    // options.sort = 'createdAt DESC' o [{ createdAt: 'DESC' }]
    sql += ` ORDER BY ${options.sort}`;
  }
  if (options.limit) {
    sql += ` LIMIT ${parseInt(options.limit)}`;
  }
  return { sql, params: whereParams };
}
```

- [ ] **Step 4: Esportare i modelli**

```javascript
const db = {
  Organizzazione: createModel('organizzazioni', {
    omitFromJSON: ['privateKey']
  }),
  Struttura: createModel('strutture', {
    booleanFields: ['attiva'],
    omitFromJSON: ['privateKey']
  }),
  Lista: createModel('liste', {
    booleanFields: ['aperta']
  }),
  Assistito: createModel('assistiti', {
    omitFromJSON: ['privateKey']
  }),
  AssistitiListe: createModel('assistiti_liste', {
    booleanFields: ['chiuso']
  }),
  BlockchainData: createModel('blockchain_data'),
  SyncState: createModel('sync_state'),

  // Utility
  raw: database,          // accesso diretto per query custom
  transaction: (fn) => {  // wrapper per transazioni atomiche
    const trx = database.transaction(fn);
    return trx();
  },
  close: () => database.close(),
};

module.exports = db;
```

- [ ] **Step 5: Aggiungere metodi join per populate()**

```javascript
// Aggiunti direttamente sui modelli:
db.Struttura.findWithOrg = function(where = {}) {
  const { whereClause, whereParams } = buildWhere(where);
  return database.prepare(`
    SELECT s.*, o.denominazione as orgDenominazione
    FROM strutture s
    LEFT JOIN organizzazioni o ON s.organizzazione = o.id
    WHERE ${whereClause.replace(/^/, 's.')}
  `).all(...whereParams);
};

db.AssistitiListe.findWithDetails = function(where = {}, options = {}) {
  // Join con assistiti e liste
  const { whereClause, whereParams } = buildWhere(where);
  let sql = `
    SELECT al.*, a.nome, a.cognome, a.codiceFiscale, a.anonId,
           l.denominazione as listaDenominazione
    FROM assistiti_liste al
    LEFT JOIN assistiti a ON al.assistito = a.id
    LEFT JOIN liste l ON al.lista = l.id
    WHERE ${whereClause}
  `;
  if (options.sort) sql += ` ORDER BY ${options.sort}`;
  if (options.limit) sql += ` LIMIT ${parseInt(options.limit)}`;
  return database.prepare(sql).all(...whereParams);
};
```

- [ ] **Step 6: Commit**

```bash
git add api/utility/db.js
git commit -m "feat: db.js API Waterline-like completa (CRUD, where, join)"
```

---

### Task 3: Disabilitare Waterline ORM e aggiornare bootstrap

**Files:**
- Modify: `config/datastores.js`
- Modify: `config/models.js`
- Modify: `config/bootstrap.js`

- [ ] **Step 1: config/datastores.js — lasciare sails-disk ma con migrate safe**

Non possiamo rimuovere completamente sails-disk perche Sails.js lo richiede al boot. Mettiamo `inMemoryOnly: true` e `migrate: 'safe'` per evitare che crei tabelle:

```javascript
module.exports.datastores = {
  default: {
    adapter: 'sails-disk',
    inMemoryOnly: true,
  },
};
```

- [ ] **Step 2: config/models.js — impostare migrate: 'safe'**

Cambiare `migrate: 'alter'` a `migrate: 'safe'` per evitare che Waterline tenti di migrare:

```javascript
migrate: 'safe',
```

- [ ] **Step 3: config/bootstrap.js — rimuovere SyncCache e usare db.js**

Riscrivere il bootstrap:
1. Rimuovere `require SyncCache`
2. Aggiungere `require db.js`
3. Il DB SQLite si inizializza automaticamente al `require()` (le tabelle vengono create)
4. La sync blockchain usa db.js direttamente
5. Rimuovere `SyncCache.load()`, `SyncCache.importToDB()`, `SyncCache.exportFromDB()`

```javascript
const db = require('../api/utility/db');
// ...
// La sync usa db.js — nessun SyncCache necessario
setImmediate(async () => {
  const manager = new ListManager();
  const result = await manager.updateDBfromBlockchain((progress) => {
    sails.config.custom._syncProgress = progress;
  });
  // Nessun SyncCache.exportFromDB() — i dati sono gia su disco
});
```

- [ ] **Step 4: Commit**

```bash
git add config/datastores.js config/models.js config/bootstrap.js
git commit -m "feat: disabilita Waterline migration, bootstrap usa db.js"
```

---

### Task 4: Migrare controller CRUD (6 file)

**Files:**
- Modify: `api/controllers/add-organizzazione.js`
- Modify: `api/controllers/add-struttura.js`
- Modify: `api/controllers/add-lista.js`
- Modify: `api/controllers/add-assistito.js`
- Modify: `api/controllers/add-assistito-in-lista.js`
- Modify: `api/controllers/rimuovi-assistito-da-lista.js`

- [ ] **Step 1: Pattern di migrazione per ogni controller**

In ogni controller:
1. Aggiungere `const db = require('../utility/db');` (o `../../utility/db` se in sottocartella)
2. Sostituire `Organizzazione.create(...)` → `db.Organizzazione.create(...)`
3. Sostituire `Struttura.findOne(...)` → `db.Struttura.findOne(...)`
4. Sostituire `.fetch()` → niente (db.js ritorna sempre il record creato)
5. Rimuovere `SyncCache.markDirty(...)` — non serve piu
6. Rimuovere `require SyncCache`

Esempio per add-organizzazione.js:
```javascript
// PRIMA:
const org = await Organizzazione.create({...}).fetch();
SyncCache.markDirty('Organizzazione');

// DOPO:
const db = require('../utility/db');
const org = db.Organizzazione.create({...});
// Nessun SyncCache
```

Nota: `db.Organizzazione.create()` e sincrono (better-sqlite3 e sincrono) ma wrappato per compatibilita. I controller possono usarlo con o senza `await`.

Per add-assistito.js: implementare la logica `beforeCreate` di `Assistito.js` (generazione anonId) direttamente nel controller o in db.js come hook.

- [ ] **Step 2: Commit**

```bash
git add api/controllers/add-*.js api/controllers/rimuovi-*.js
git commit -m "feat: migrare 6 controller CRUD da Waterline a db.js"
```

---

### Task 5: Migrare controller API lettura (8 file)

**Files:**
- Modify: `api/controllers/api-dashboard.js`
- Modify: `api/controllers/api-organizzazioni.js`
- Modify: `api/controllers/api-strutture.js`
- Modify: `api/controllers/api-assistiti.js`
- Modify: `api/controllers/api-liste-dettaglio.js`
- Modify: `api/controllers/api-graph-data.js`
- Modify: `api/controllers/api-debug.js`
- Modify: `api/controllers/api-public.js`

- [ ] **Step 1: Pattern di migrazione per ogni controller API**

In ogni controller:
1. Aggiungere `const db = require('../utility/db');`
2. Sostituire `Model.find(...)` → `db.Model.find(...)`
3. Sostituire `.populate('relazione')` → usare i metodi join di db.js o query esplicite
4. Sostituire `.count(...)` → `db.Model.count(...)`
5. Sostituire `.limit(N)` → `db.Model.find({...}, { limit: N })`

Per `.populate()` — le sostituzioni specifiche:
- `Organizzazione.find().populate('strutture')` → `db.Organizzazione.find()` + per ogni org: `db.Struttura.find({ organizzazione: org.id })`
- `Struttura.find().populate('organizzazione').populate('liste')` → `db.Struttura.findWithOrg()` + join liste
- `AssistitiListe.find().populate('assistito').populate('lista')` → `db.AssistitiListe.findWithDetails()`

Per api-strutture.js: usare la pre-aggregazione gia implementata (singola `db.AssistitiListe.find()` + loop).

Per api-debug.js: usare `db.raw` per query complesse se necessario.

- [ ] **Step 2: Commit**

```bash
git add api/controllers/api-*.js
git commit -m "feat: migrare 8 controller API lettura da Waterline a db.js"
```

---

### Task 6: Migrare controller admin + inizializza-dati-di-prova

**Files:**
- Modify: `api/controllers/inizializza-dati-di-prova.js`
- Modify: `api/controllers/fetch-db-from-blockchain.js`
- Modify: `api/controllers/api-sync-reset.js`
- Modify: `api/controllers/recover-from-arweave.js`
- Modify: `api/controllers/wallet/reset-wallet.js`

- [ ] **Step 1: inizializza-dati-di-prova.js**

1. `const db = require('../utility/db');`
2. Sostituire tutti `Model.create/destroy` con `db.Model.create/destroy`
3. Il `destroy({})` iniziale diventa: `db.raw.exec('DELETE FROM assistiti_liste; DELETE FROM assistiti; DELETE FROM liste; DELETE FROM strutture; DELETE FROM organizzazioni;')`
4. Usare `db.transaction()` per bulk insert (molto piu veloce):
```javascript
db.transaction(() => {
  for (let i = 0; i < NUM_ORG; i++) {
    db.Organizzazione.create({...});
  }
});
```
5. Rimuovere `SyncCache.markDirty()`

- [ ] **Step 2: Altri controller admin**

- `fetch-db-from-blockchain.js`: usa `ListManager` (che verra migrato nel task 7)
- `api-sync-reset.js`: sostituire `SyncCache.reset()` con `db.raw.exec('DELETE FROM ...')` per tutte le tabelle
- `recover-from-arweave.js`: usa `ListManager`
- `wallet/reset-wallet.js`: sostituire i `Model.destroy({})` con `db.raw.exec('DELETE FROM ...')`

- [ ] **Step 3: Commit**

```bash
git add api/controllers/inizializza-dati-di-prova.js api/controllers/fetch-db-from-blockchain.js api/controllers/api-sync-reset.js api/controllers/recover-from-arweave.js api/controllers/wallet/reset-wallet.js
git commit -m "feat: migrare controller admin + load-test a db.js"
```

---

### Task 7: Migrare ListManager.js — sync batch + incrementale

Questo e il task piu complesso. ListManager.js gestisce tutta la logica di sync blockchain.

**Files:**
- Modify: `api/utility/ListManager.js`

- [ ] **Step 1: Sostituire tutti gli accessi Waterline con db.js**

In tutto il file, sostituire:
- `Organizzazione.create/find/update/destroy` → `db.Organizzazione.*`
- `Struttura.create/find/update/destroy` → `db.Struttura.*`
- Etc. per tutti i modelli
- Rimuovere `require SyncCache` e tutte le chiamate a SyncCache

- [ ] **Step 2: Implementare sync batch**

Riscrivere `updateDBfromBlockchain()` per:
1. Scaricare tutte le TX dalla chain in un batch (cursor paging)
2. Scrivere ogni TX in `blockchain_data` via `db.BlockchainData.create()` dentro una transazione SQLite
3. Non accumulare TX in array — processare e scrivere una alla volta
4. Ricostruire le tabelle entita da `blockchain_data`

```javascript
async updateDBfromBlockchain(progressCallback) {
  const db = require('./db');

  // Leggi ultimo cursor per sync incrementale
  const lastSync = db.SyncState.findOne({ key: 'lastCursor' });
  const cursor = lastSync?.value || null;

  // Batch download dalla chain
  let hasMore = true;
  let currentCursor = cursor;
  let totalProcessed = 0;

  while (hasMore) {
    const page = await iota.queryTransactionBlocksPage(currentCursor, 50);
    if (page.transactions.length === 0) { hasMore = false; break; }

    // Scrivi su SQLite in transazione atomica
    db.transaction(() => {
      for (const tx of page.transactions) {
        const decoded = iota._decodeTransactionPayload(tx);
        if (!decoded) continue;
        // Upsert in blockchain_data
        const existing = db.BlockchainData.findOne({ digest: tx.digest });
        if (!existing) {
          db.BlockchainData.create({
            digest: tx.digest,
            tag: decoded.tag,
            entityId: decoded.entityId,
            version: decoded.version,
            payload: JSON.stringify(decoded.payload),
            timestamp: decoded.timestamp,
            cursor: page.nextCursor,
          });
        }
        totalProcessed++;
      }
    });

    currentCursor = page.nextCursor;
    hasMore = page.hasMore;

    if (progressCallback) {
      progressCallback({ status: 'Scaricamento blockchain...', processed: totalProcessed });
    }
  }

  // Salva cursor per prossima sync
  db.raw.prepare('INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)')
    .run('lastCursor', currentCursor);

  // Ricostruisci tabelle entita da blockchain_data
  await this._rebuildEntitiesFromBlockchainData(progressCallback);
}
```

- [ ] **Step 3: Implementare _rebuildEntitiesFromBlockchainData()**

Legge da `blockchain_data` (gia su disco) e popola le tabelle entita:

```javascript
async _rebuildEntitiesFromBlockchainData(progressCallback) {
  const db = require('./db');
  // Per ogni tipo di dato, leggi le TX piu recenti e decripta
  const types = ['ORGANIZZAZIONE_DATA', 'STRUTTURE_LISTE_DATA', 'ASSISTITI_DATA'];

  for (const type of types) {
    // Raggruppa per entityId, prendi la versione piu alta
    const txs = db.raw.prepare(`
      SELECT * FROM blockchain_data
      WHERE tag = ?
      ORDER BY version DESC
    `).all(type);

    // Processa per entityId (prendi solo la piu recente)
    const seen = new Set();
    for (const tx of txs) {
      if (seen.has(tx.entityId)) continue;
      seen.add(tx.entityId);

      // Decripta e upsert nella tabella entita appropriata
      // ... (logica di decrittazione esistente)
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add api/utility/ListManager.js
git commit -m "feat: ListManager sync batch + incrementale su SQLite"
```

---

### Task 8: Cleanup e verifica

**Files:**
- Delete: `api/utility/SyncCache.js`
- Modify: `api/utility/db.js` (eventuali fix)

- [ ] **Step 1: Rimuovere SyncCache.js**

```bash
rm api/utility/SyncCache.js
```

Verificare che nessun file lo importi ancora:
```bash
grep -r "SyncCache" api/ config/ --include="*.js"
```

- [ ] **Step 2: Verificare che il server parte**

```bash
rm -rf .tmp/localDiskDb/ .tmp/sync-cache.json .tmp/exart26.db
node app.js
```

Il server deve partire senza errori. Il file `.tmp/exart26.db` deve essere creato.

- [ ] **Step 3: Testare load-test**

```bash
# Con CSRF valido:
curl -X POST http://localhost:1337/api/v1/load-test
# Deve creare 10K record senza OOM
# Verificare: ls -lh .tmp/exart26.db (deve essere < 50MB)
```

- [ ] **Step 4: Testare endpoint pesanti**

```bash
curl http://localhost:1337/api/v1/strutture?organizzazione=1
curl http://localhost:1337/api/v1/debug
curl http://localhost:1337/api/v1/graph-data
curl http://localhost:1337/api/v1/liste-dettaglio?idLista=1
```

Tutti devono rispondere senza OOM.

- [ ] **Step 5: Commit finale**

```bash
git add -A
git commit -m "feat: migrazione completa a better-sqlite3, rimosso SyncCache"
```
