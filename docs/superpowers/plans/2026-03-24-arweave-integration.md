# Arweave Produzione/Test Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere toggle Produzione/Test per Arweave (con ArLocal), nuovi endpoint API, e tab Arweave nella pagina Debug.

**Architecture:** ArweaveHelper.js diventa riconfigurabile a runtime con switchMode(). Stato runtime in `.tmp/arweave-runtime-state.json`. ArLocal avviato come processo figlio in modalità test. 6 nuovi controller API + aggiornamento Wallet.jsx e Debug.jsx.

**Tech Stack:** Sails.js, arweave-js, arlocal, React 19, TailwindCSS 4, Framer Motion

**Spec:** `docs/superpowers/specs/2026-03-24-arweave-integration-design.md`

---

## File Structure

**Backend — nuovi:**
- `api/controllers/arweave/status.js` — GET /api/v1/arweave/status
- `api/controllers/arweave/switch-mode.js` — POST /api/v1/arweave/switch-mode
- `api/controllers/arweave/transactions.js` — GET /api/v1/arweave/transactions
- `api/controllers/arweave/test-upload.js` — POST /api/v1/arweave/test-upload
- `api/controllers/arweave/test-verify.js` — POST /api/v1/arweave/test-verify
- `api/controllers/arweave/consistency.js` — GET /api/v1/arweave/consistency

**Backend — modifiche:**
- `api/utility/ArweaveHelper.js` — Core: switchMode, bootstrap ArLocal, inflight counter, nuovi metodi
- `config/routes.js` — 6 nuove rotte
- `config/sample_private_arweave_conf.js` — Campo ARWEAVE_LOCAL_PORT

**Frontend — modifiche:**
- `frontend/src/api/endpoints.js` — 6 nuove funzioni API
- `frontend/src/pages/Wallet.jsx` — Card Arweave con selettore modalità
- `frontend/src/pages/Debug.jsx` — Sezione collapsibile Arweave

**Cleanup:**
- `test-arweave.js` — Rimuovere

---

### Task 1: ArweaveHelper.js — Riscrittura con modalità runtime

Il cuore dell'implementazione. ArweaveHelper diventa riconfigurabile con switchMode(), bootstrap ArLocal, inflight counter.

**Files:**
- Modify: `api/utility/ArweaveHelper.js`

- [ ] **Step 1: Aggiungere nuovi campi di stato e init da runtime state file**

Sostituire l'inizializzazione statica (righe 1-22) con un'inizializzazione che:
1. Legge `config/private_arweave_conf.js` (config statica, opzionale)
2. Legge `.tmp/arweave-runtime-state.json` (stato runtime, opzionale)
3. Determina `_mode` iniziale: se runtime dice test → prepara per ArLocal (sarà avviato al bootstrap). Se produzione e JWK presente → configura mainnet. Altrimenti → disabled.

```javascript
const Arweave = require('arweave');
const fs = require('fs');
const path = require('path');

const APP_NAME = 'exart26-iota';
const RUNTIME_STATE_PATH = path.resolve(__dirname, '../../.tmp/arweave-runtime-state.json');
const DEFAULT_LOCAL_PORT = 1984;

let _arweave = null;
let _wallet = null;
let _enabled = false;
let _mode = 'disabled'; // 'production' | 'test' | 'disabled'
let _arLocalInstance = null;
let _inflightUploads = 0;
let _productionConfig = null; // cached production config

// Load production config (read-only)
try {
  _productionConfig = require('../../config/private_arweave_conf');
} catch (e) { /* config non presente */ }

// Load runtime state
function _loadRuntimeState() {
  try {
    if (fs.existsSync(RUNTIME_STATE_PATH)) {
      return JSON.parse(fs.readFileSync(RUNTIME_STATE_PATH, 'utf8'));
    }
  } catch (e) { /* ignore */ }
  return null;
}

function _saveRuntimeState(state) {
  try {
    const dir = path.dirname(RUNTIME_STATE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(RUNTIME_STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    if (typeof sails !== 'undefined') sails.log.warn('[ArweaveHelper] Errore salvataggio runtime state:', e.message);
  }
}

function _getLocalPort() {
  return (_productionConfig && _productionConfig.ARWEAVE_LOCAL_PORT) || DEFAULT_LOCAL_PORT;
}
```

- [ ] **Step 2: Implementare `initProduction()` e `initTest()`**

```javascript
function _initProduction() {
  if (!_productionConfig || !_productionConfig.ARWEAVE_WALLET_JWK) {
    _mode = 'disabled';
    _enabled = false;
    return false;
  }
  _arweave = Arweave.init({
    host: _productionConfig.ARWEAVE_HOST || 'arweave.net',
    port: _productionConfig.ARWEAVE_PORT || 443,
    protocol: _productionConfig.ARWEAVE_PROTOCOL || 'https',
  });
  _wallet = _productionConfig.ARWEAVE_WALLET_JWK;
  _mode = 'production';
  _enabled = true;
  return true;
}

async function _initTest() {
  const port = _getLocalPort();
  try {
    const ArLocal = require('arlocal').default;
    _arLocalInstance = new ArLocal(port, false);
    await _arLocalInstance.start();
  } catch (e) {
    if (e.code === 'EADDRINUSE') {
      // Tentare di riusare istanza esistente
      try {
        const resp = await fetch(`http://localhost:${port}/info`);
        if (resp.ok) {
          // ArLocal già in esecuzione, riusare
        } else { throw e; }
      } catch (e2) {
        if (typeof sails !== 'undefined') sails.log.warn(`[ArweaveHelper] Porta ${port} occupata, ArLocal disabilitato`);
        _mode = 'disabled';
        _enabled = false;
        return false;
      }
    } else { throw e; }
  }

  _arweave = Arweave.init({ host: 'localhost', port, protocol: 'http' });

  // Generare o riusare wallet da runtime state
  const state = _loadRuntimeState();
  if (state && state.testWalletJwk) {
    _wallet = state.testWalletJwk;
  } else {
    _wallet = await _arweave.wallets.generate();
  }

  // Funding
  const addr = await _arweave.wallets.jwkToAddress(_wallet);
  try { await _arweave.api.get(`mint/${addr}/1000000000000`); } catch (e) { /* ignore */ }
  try { await _arweave.api.get('mine'); } catch (e) { /* ignore */ }

  _mode = 'test';
  _enabled = true;

  _saveRuntimeState({ mode: 'test', testWalletJwk: _wallet });
  return true;
}
```

- [ ] **Step 3: Aggiungere inflight counter a uploadData()**

Modificare il metodo `uploadData()` esistente (riga 50-98) per:
1. Catturare `_arweave` e `_wallet` in variabili locali (snapshot)
2. Incrementare `_inflightUploads` all'inizio
3. Decrementare al completamento (in finally)
4. Se mode=test, minare blocco dopo upload

```javascript
// All'inizio di uploadData:
_inflightUploads++;
const arweave = _arweave;  // snapshot
const wallet = _wallet;     // snapshot
try {
  // ... existing upload logic usando arweave e wallet locali ...

  // Se test mode, minare blocco per rendere TX disponibile a GraphQL
  if (_mode === 'test') {
    try { await _arweave.api.get('mine'); } catch (e) { /* ignore */ }
  }

  return { success: true, txId: transaction.id, error: null };
} catch (e) {
  return { success: false, txId: null, error: e.message };
} finally {
  _inflightUploads--;
}
```

- [ ] **Step 4: Implementare switchMode()**

```javascript
static async switchMode(mode) {
  // Validazione
  if (mode !== 'production' && mode !== 'test') {
    return { success: false, error: `Modalità non valida: ${mode}` };
  }

  // Attendere drain upload in-flight
  if (_inflightUploads > 0) {
    const start = Date.now();
    while (_inflightUploads > 0 && Date.now() - start < 10000) {
      await new Promise(r => setTimeout(r, 500));
    }
    if (_inflightUploads > 0) {
      return { success: false, error: 'Upload in corso, riprovare tra qualche secondo' };
    }
  }

  // Fermare ArLocal se attivo
  if (_arLocalInstance) {
    try { await _arLocalInstance.stop(); } catch (e) { /* ignore */ }
    _arLocalInstance = null;
  }

  // Switch
  let success;
  if (mode === 'test') {
    success = await _initTest();
  } else {
    success = _initProduction();
    if (success) {
      _saveRuntimeState({ mode: 'production', testWalletJwk: null });
    } else {
      return { success: false, error: 'JWK non configurato in private_arweave_conf.js' };
    }
  }

  if (!success) {
    return { success: false, error: `Impossibile attivare modalità ${mode}` };
  }

  return {
    success: true,
    mode: _mode,
    ...(await ArweaveHelper.getDetailedStatus()),
  };
}
```

- [ ] **Step 5: Implementare getMode(), getDetailedStatus(), testUpload(), testVerify()**

```javascript
static getMode() { return _mode; }

static async getDetailedStatus() {
  const result = {
    mode: _mode,
    enabled: _enabled,
    address: null,
    balance: null,
    arLocalRunning: _arLocalInstance !== null,
    host: _arweave ? (_mode === 'test' ? 'localhost' : (_productionConfig?.ARWEAVE_HOST || 'arweave.net')) : null,
    port: _arweave ? (_mode === 'test' ? _getLocalPort() : (_productionConfig?.ARWEAVE_PORT || 443)) : null,
  };
  if (_enabled && _wallet) {
    try {
      result.address = await _arweave.wallets.jwkToAddress(_wallet);
      const winstonBal = await _arweave.wallets.getBalance(result.address);
      result.balance = { winston: winstonBal, ar: _arweave.ar.winstonToAr(winstonBal) };
    } catch (e) { /* ignore */ }
  }
  return result;
}

static async testUpload() {
  if (!_enabled) return { success: false, error: 'Arweave non abilitato' };
  const dummyPayload = { test: true, timestamp: Date.now(), message: 'Test upload from ExArt26' };
  const result = await ArweaveHelper.uploadData('TEST_DATA', dummyPayload, 'test-entity', 1);
  return result;
}

static async testVerify(txId) {
  if (!_enabled) return { success: false, error: 'Arweave non abilitato' };
  try {
    const data = await _arweave.transactions.getData(txId, { decode: true, string: true });
    const parsed = JSON.parse(data);
    return {
      success: true,
      found: true,
      dataMatch: parsed.test === true,
      downloadedData: parsed,
    };
  } catch (e) {
    return { success: false, found: false, error: e.message };
  }
}
```

- [ ] **Step 6: Implementare getTransactionsForDebug() e getConsistency()**

```javascript
static async getTransactionsForDebug(dataType, limit = 20) {
  if (!_enabled) return [];
  const txList = await ArweaveHelper.getAllByTag(dataType, Math.min(limit, 50));
  const results = [];
  for (const tx of txList) {
    try {
      const data = await _arweave.transactions.getData(tx.txId, { decode: true, string: true });
      const versionTag = tx.tags.find(t => t.name === 'Version');
      const entityIdTag = tx.tags.find(t => t.name === 'Entity-Id');
      const timestampTag = tx.tags.find(t => t.name === 'Timestamp');
      results.push({
        txId: tx.txId,
        dataType,
        entityId: entityIdTag?.value || null,
        version: versionTag?.value || null,
        timestamp: timestampTag?.value || null,
        data: JSON.parse(data),
      });
    } catch (e) { /* skip failed downloads */ }
  }
  return results;
}

static async getConsistency(iotaTransactions) {
  if (!_enabled) return [];
  const results = [];
  // Group IOTA transactions by type+entityId
  for (const iotaTx of iotaTransactions) {
    const arweaveTx = await ArweaveHelper.downloadByTag(iotaTx.dataType, iotaTx.entityId);
    const arVersion = arweaveTx?.tags?.find(t => t.name === 'Version')?.value || null;
    results.push({
      entityId: iotaTx.entityId,
      type: iotaTx.dataType,
      onIota: true,
      onArweave: arweaveTx !== null,
      iotaVersion: iotaTx.version,
      arweaveVersion: arVersion,
      versionMatch: arVersion === String(iotaTx.version),
    });
  }
  return results;
}
```

- [ ] **Step 7: Aggiungere bootstrap() e shutdown()**

```javascript
static async bootstrap() {
  const runtimeState = _loadRuntimeState();
  if (runtimeState && runtimeState.mode === 'test') {
    try {
      await _initTest();
      if (typeof sails !== 'undefined') sails.log.info('[ArweaveHelper] Modalità test avviata (ArLocal)');
    } catch (e) {
      if (typeof sails !== 'undefined') sails.log.warn('[ArweaveHelper] Bootstrap test fallito:', e.message);
      _mode = 'disabled'; _enabled = false;
    }
  } else if (_productionConfig && _productionConfig.ARWEAVE_WALLET_JWK) {
    _initProduction();
    if (typeof sails !== 'undefined') sails.log.info('[ArweaveHelper] Modalità produzione attiva');
  } else {
    if (typeof sails !== 'undefined') sails.log.info('[ArweaveHelper] Arweave disabilitato (nessuna configurazione)');
  }
}

static async shutdown() {
  if (_arLocalInstance) {
    try { await _arLocalInstance.stop(); } catch (e) { /* ignore */ }
    _arLocalInstance = null;
  }
}
```

- [ ] **Step 8: Commit**

```bash
git add api/utility/ArweaveHelper.js
git commit -m "feat: ArweaveHelper riconfigurabile runtime con switchMode e ArLocal"
```

---

### Task 2: Routes + 6 Controller API

**Files:**
- Modify: `config/routes.js`
- Create: `api/controllers/arweave/status.js`
- Create: `api/controllers/arweave/switch-mode.js`
- Create: `api/controllers/arweave/transactions.js`
- Create: `api/controllers/arweave/test-upload.js`
- Create: `api/controllers/arweave/test-verify.js`
- Create: `api/controllers/arweave/consistency.js`

- [ ] **Step 1: Aggiungere rotte in config/routes.js**

Aggiungere prima della riga `// SPA catch-all`:

```javascript
// --- Arweave ---
'GET    /api/v1/arweave/status':        { action: 'arweave/status' },
'POST   /api/v1/arweave/switch-mode':   { action: 'arweave/switch-mode' },
'GET    /api/v1/arweave/transactions':  { action: 'arweave/transactions' },
'POST   /api/v1/arweave/test-upload':   { action: 'arweave/test-upload' },
'POST   /api/v1/arweave/test-verify':   { action: 'arweave/test-verify' },
'GET    /api/v1/arweave/consistency':   { action: 'arweave/consistency' },
```

- [ ] **Step 2: Creare api/controllers/arweave/status.js**

```javascript
const ArweaveHelper = require('../../utility/ArweaveHelper');

module.exports = {
  friendlyName: 'Arweave status',
  description: 'Stato completo Arweave: mode, enabled, address, balance, arLocalRunning',
  inputs: {},
  exits: { success: {} },
  fn: async function (inputs, exits) {
    const status = await ArweaveHelper.getDetailedStatus();
    return exits.success(status);
  }
};
```

- [ ] **Step 3: Creare api/controllers/arweave/switch-mode.js**

```javascript
const ArweaveHelper = require('../../utility/ArweaveHelper');

module.exports = {
  friendlyName: 'Switch Arweave mode',
  description: 'Cambia modalità Arweave: production o test (ArLocal)',
  inputs: {
    mode: { type: 'string', required: true, isIn: ['production', 'test'] }
  },
  exits: { success: {} },
  fn: async function (inputs, exits) {
    const result = await ArweaveHelper.switchMode(inputs.mode);
    return exits.success(result);
  }
};
```

- [ ] **Step 4: Creare gli altri 4 controller**

`api/controllers/arweave/transactions.js`:
```javascript
const ArweaveHelper = require('../../utility/ArweaveHelper');
module.exports = {
  friendlyName: 'Arweave transactions',
  inputs: {
    dataType: { type: 'string', required: true },
    limit: { type: 'number', defaultsTo: 20 }
  },
  exits: { success: {} },
  fn: async function (inputs, exits) {
    const transactions = await ArweaveHelper.getTransactionsForDebug(inputs.dataType, inputs.limit);
    return exits.success({ transactions });
  }
};
```

`api/controllers/arweave/test-upload.js`:
```javascript
const ArweaveHelper = require('../../utility/ArweaveHelper');
module.exports = {
  friendlyName: 'Arweave test upload',
  inputs: {},
  exits: { success: {} },
  fn: async function (inputs, exits) {
    const result = await ArweaveHelper.testUpload();
    return exits.success(result);
  }
};
```

`api/controllers/arweave/test-verify.js`:
```javascript
const ArweaveHelper = require('../../utility/ArweaveHelper');
module.exports = {
  friendlyName: 'Arweave test verify',
  inputs: { txId: { type: 'string', required: true } },
  exits: { success: {} },
  fn: async function (inputs, exits) {
    const result = await ArweaveHelper.testVerify(inputs.txId);
    return exits.success(result);
  }
};
```

`api/controllers/arweave/consistency.js`:
```javascript
const ArweaveHelper = require('../../utility/ArweaveHelper');
const iota = require('../../utility/iota');
const { TransactionDataType } = require('../../enums/TransactionDataType');
module.exports = {
  friendlyName: 'Arweave consistency check',
  inputs: {},
  exits: { success: {} },
  fn: async function (inputs, exits) {
    // Raccogliere TX IOTA per i tipi principali
    const types = ['ORGANIZZAZIONE_DATA', 'STRUTTURE_LISTE_DATA', 'ASSISTITI_DATA'];
    const iotaTxs = [];
    for (const type of types) {
      const txs = await iota.getAllDataByTag(type);
      for (const tx of txs) {
        iotaTxs.push({ dataType: type, entityId: tx.entityId, version: tx.version });
      }
    }
    const entities = await ArweaveHelper.getConsistency(iotaTxs);
    return exits.success({ entities });
  }
};
```

- [ ] **Step 5: Commit**

```bash
git add config/routes.js api/controllers/arweave/
git commit -m "feat: 6 endpoint API Arweave (status, switch-mode, transactions, test, consistency)"
```

---

### Task 3: Bootstrap Arweave nel lifecycle Sails.js

**Files:**
- Modify: `config/bootstrap.js` o `api/hooks/custom/index.js` (dove c'è il bootstrap attuale)

- [ ] **Step 1: Leggere il bootstrap attuale e aggiungere ArweaveHelper.bootstrap()**

Trovare dove viene chiamato il bootstrap (probabilmente `config/bootstrap.js` o l'hook custom). Aggiungere:

```javascript
const ArweaveHelper = require('../api/utility/ArweaveHelper');
// ... nel bootstrap, dopo l'init del wallet:
await ArweaveHelper.bootstrap();
```

- [ ] **Step 2: Aggiungere shutdown handler**

Nel bootstrap o nell'hook custom, registrare lo shutdown:

```javascript
// Registrare cleanup ArLocal su shutdown
process.on('SIGTERM', async () => { await ArweaveHelper.shutdown(); });
process.on('SIGINT', async () => { await ArweaveHelper.shutdown(); });
```

- [ ] **Step 3: Commit**

```bash
git add config/bootstrap.js api/hooks/
git commit -m "feat: bootstrap e shutdown ArweaveHelper nel lifecycle Sails.js"
```

---

### Task 4: Frontend — API endpoints

**Files:**
- Modify: `frontend/src/api/endpoints.js`

- [ ] **Step 1: Aggiungere 6 funzioni API**

```javascript
// --- Arweave ---
export const getArweaveStatus = () => api.get('/api/v1/arweave/status');
export const switchArweaveMode = (mode) => api.post('/api/v1/arweave/switch-mode', { mode });
export const getArweaveTransactions = (dataType, limit = 20) => api.get(`/api/v1/arweave/transactions?dataType=${dataType}&limit=${limit}`);
export const arweaveTestUpload = () => api.post('/api/v1/arweave/test-upload', {});
export const arweaveTestVerify = (txId) => api.post('/api/v1/arweave/test-verify', { txId });
export const getArweaveConsistency = () => api.get('/api/v1/arweave/consistency');
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/endpoints.js
git commit -m "feat: 6 API endpoint functions per Arweave"
```

---

### Task 5: Frontend — Wallet.jsx card Arweave con toggle modalità

**Files:**
- Modify: `frontend/src/pages/Wallet.jsx`

- [ ] **Step 1: Aggiungere stato e fetch per Arweave**

Nel componente Wallet, aggiungere:
- `arweaveStatus` state (caricato da `getArweaveStatus()`)
- `selectedMode` state (per il radio toggle)
- `switching` state (loading durante switch)
- `useEffect` per caricare lo status Arweave al mount

- [ ] **Step 2: Sostituire la card Arweave esistente**

La card attuale mostra solo enabled/address. Sostituirla con:
- Due radio button stilizzati (Produzione / Test)
- Badge stato colorato (verde/arancione/grigio)
- Info dinamiche basate sulla modalità
- Bottone "Applica" visibile solo se `selectedMode !== arweaveStatus.mode`
- Handler che chiama `switchArweaveMode(selectedMode)` e aggiorna UI

Design: glassmorphism card con stile coerente al resto del progetto. Radio buttons come segmented control con glow neon.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Wallet.jsx
git commit -m "feat: Wallet card Arweave con toggle Produzione/Test"
```

---

### Task 6: Frontend — Debug.jsx sezione Arweave

**Files:**
- Modify: `frontend/src/pages/Debug.jsx`

- [ ] **Step 1: Aggiungere sezione Arweave con 4 sotto-sezioni**

Aggiungere una nuova `CollapsibleSection` per Arweave (dopo le sezioni esistenti) con:

**6a. Stato Arweave** — badge modalità, connessione, address, balance, ArLocal status. Caricato da `getArweaveStatus()`.

**6b. Transazioni Arweave** — dropdown per selezionare DataType, bottone "Carica", lista TxCard con payload espandibile. Caricato lazy da `getArweaveTransactions(dataType, limit)`.

**6c. Consistency Check** — tabella con colonne Tipo/EntityId/IOTA/Arweave/Match + badge. Bottone "Verifica" che chiama `getArweaveConsistency()`.

**6d. Test Interattivo** — bottone "Test Upload" → mostra txId → bottone "Verifica" → mostra risultato. Log area scrollabile con step-by-step output.

Stile: coerente con le sezioni esistenti (CollapsibleSection, TxCard, StatusBadge, JsonBlock).

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Debug.jsx
git commit -m "feat: Debug sezione Arweave con transazioni, consistency e test interattivo"
```

---

### Task 7: Cleanup e sample config

**Files:**
- Delete: `test-arweave.js`
- Modify: `config/sample_private_arweave_conf.js`

- [ ] **Step 1: Rimuovere test-arweave.js**

```bash
rm test-arweave.js
```

- [ ] **Step 2: Aggiornare sample config**

Aggiungere `ARWEAVE_LOCAL_PORT` al sample:

```javascript
module.exports = {
  ARWEAVE_HOST: 'arweave.net',
  ARWEAVE_PORT: 443,
  ARWEAVE_PROTOCOL: 'https',
  ARWEAVE_WALLET_JWK: null,
  ARWEAVE_LOCAL_PORT: 1984, // Porta per ArLocal in modalità test (opzionale, default 1984)
};
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: cleanup test-arweave.js + aggiorna sample config Arweave"
```

---

### Task 8: Verifica finale

- [ ] **Step 1: Avviare server e verificare endpoint**

```bash
node app.js
# In altro terminale:
curl http://localhost:1337/api/v1/arweave/status
# Deve ritornare { mode: 'disabled', enabled: false, ... }
```

- [ ] **Step 2: Switch a modalità test**

```bash
# Con CSRF valido:
curl -X POST http://localhost:1337/api/v1/arweave/switch-mode -d '{"mode":"test"}'
# Deve ritornare { success: true, mode: 'test', arLocalRunning: true, ... }
```

- [ ] **Step 3: Test upload + verify**

```bash
curl -X POST http://localhost:1337/api/v1/arweave/test-upload
# Deve ritornare { success: true, txId: '...' }

curl -X POST http://localhost:1337/api/v1/arweave/test-verify -d '{"txId":"..."}'
# Deve ritornare { success: true, found: true, dataMatch: true }
```

- [ ] **Step 4: Verificare frontend**

Aprire `http://localhost:5173/app/wallet` — la card Arweave deve mostrare toggle Test attivo.
Aprire `http://localhost:5173/app/debug` — la sezione Arweave deve mostrare stato + test interattivo funzionante.

- [ ] **Step 5: Commit finale se necessario**
