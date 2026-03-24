# Design: Integrazione Arweave Produzione/Test

**Data**: 2026-03-24
**Stato**: Approvato (rev.2 — fix da spec review)

## Obiettivo

Aggiungere alla pagina Wallet un selettore di modalità Arweave (Produzione/Test) con conferma, e alla pagina Debug un tab Arweave con lista transazioni, verifica consistency IOTA/Arweave, e test interattivo.

## Contesto

ArweaveHelper.js attualmente è configurato staticamente al boot da `config/private_arweave_conf.js` e punta fisso a `arweave.net` (mainnet). Non esiste modo di testare Arweave senza un wallet mainnet. ArLocal (nodo locale in-memory) permette test gratuiti e istantanei.

## Architettura

### 1. Backend — ArweaveHelper riconfigurabile a runtime

**Stato interno aggiornato:**
- `_mode`: `'production'` | `'test'` | `'disabled'`
- `_arLocalInstance`: riferimento al processo ArLocal (solo in modalità test)
- `_arweave`: client Arweave (riconfigurabile)
- `_wallet`: JWK wallet (da config in production, generato al volo in test)
- `_enabled`: boolean derivato
- `_inflightUploads`: contatore atomico di upload in corso (per safe switch)

**Nuovi metodi:**

| Metodo | Descrizione |
|--------|-------------|
| `switchMode(mode)` | Attende drain upload in-flight (max 10s), ferma ArLocal se attivo, riconfigura client, genera wallet se test, persiste stato runtime. Ritorna `{ success, mode, address, balance }` |
| `getMode()` | Ritorna modalità corrente: `'production'`, `'test'`, `'disabled'` |
| `getDetailedStatus()` | Stato completo: mode, enabled, address, balance, arLocalRunning, host, port |
| `testUpload()` | Upload payload JSON dummy, mina blocco se ArLocal, ritorna `{ success, txId }` |
| `testVerify(txId)` | Query GraphQL + download per txId, confronta payload, ritorna `{ success, found, dataMatch }` |
| `getTransactionsForDebug(dataType, limit)` | Query per singolo DataType + download dati. Richiede `dataType` param. Ritorna array di TX con payload |
| `getConsistency(iotaTransactions)` | Confronta metadata (entityId, version) IOTA vs Arweave per entità. Ritorna array di `{ entityId, type, onIota, onArweave, iotaVersion, arweaveVersion, versionMatch }` |

**Safe mode switch — gestione upload in-flight:**
- `uploadData()` cattura `_arweave` e `_wallet` in variabili locali all'inizio della chiamata (snapshot), così un switch mid-flight non corrompe l'upload corrente
- `_inflightUploads` incrementato all'inizio di `uploadData()`, decrementato al completamento
- `switchMode()` controlla `_inflightUploads > 0`: se sì, attende drain (polling 500ms, timeout 10s). Se timeout, ritorna `{ success: false, error: 'Upload in corso, riprovare tra qualche secondo' }`

**Modalità Test — ArLocal:**
- ArLocal avviato come processo figlio sulla porta configurabile (`ARWEAVE_LOCAL_PORT`, default 1984)
- Bootstrap con try/catch su `arLocal.start()`: se `EADDRINUSE`, tenta HTTP `GET localhost:{port}` per verificare se è un'istanza ArLocal nostra → se sì, la riusa; se no, logga warning e `_mode = 'disabled'`
- Wallet JWK generato con `arweave.wallets.generate()`
- Funding automatico via `GET /mint/{address}/1000000000000`
- Mining automatico dopo ogni upload (`GET /mine`) per rendere TX disponibili a GraphQL
- ArLocal fermato quando si cambia modalità o si spegne il server
- ArLocal avviato con `detached: false` per evitare processi orfani

**Modalità Produzione:**
- Usa config esistente (`ARWEAVE_HOST`, `ARWEAVE_PORT`, `ARWEAVE_PROTOCOL`, `ARWEAVE_WALLET_JWK`)
- Nessun cambiamento al flusso attuale

**Persistenza stato runtime:**
- Lo stato mutabile viene salvato in `.tmp/arweave-runtime-state.json` (coerente con SyncCache che usa `.tmp/sync-cache.json`)
- Contenuto: `{ mode: 'test'|'production', testWalletJwk: {...}|null }`
- Il file `config/private_arweave_conf.js` resta read-only dopo il deploy (contiene solo la config di produzione)
- Al bootstrap: legge `.tmp/arweave-runtime-state.json`, se `mode=test` avvia ArLocal

### 2. Nuovi Endpoint API

| Metodo | Rotta | Body/Params | Risposta |
|--------|-------|-------------|----------|
| GET | `/api/v1/arweave/status` | — | `{ mode, enabled, address, balance: { winston, ar }, arLocalRunning, host, port }` |
| POST | `/api/v1/arweave/switch-mode` | `{ mode: 'production'\|'test' }` | `{ success, mode, address, balance: { winston, ar }, arLocalRunning, error? }`. Se mode=production e JWK assente: `{ success: false, error: 'JWK non configurato in private_arweave_conf.js' }` |
| GET | `/api/v1/arweave/transactions` | `?dataType=X&limit=20` | `{ transactions: [{ txId, dataType, entityId, version, timestamp, data }] }`. Richiede `dataType` param. Max 50 per request |
| POST | `/api/v1/arweave/test-upload` | — | `{ success, txId, error? }` |
| POST | `/api/v1/arweave/test-verify` | `{ txId }` | `{ success, found, dataMatch, uploadedData, downloadedData, error? }` |
| GET | `/api/v1/arweave/consistency` | — | `{ entities: [{ entityId, type, onIota, onArweave, iotaVersion, arweaveVersion, versionMatch }] }` |

**Note sugli endpoint:**
- `balance` ritornato come oggetto `{ winston, ar }` (formato consistente con `ArweaveHelper.getBalance()`)
- `transactions` richiede filtro `dataType` obbligatorio per evitare query massive (8 DataType × limit = troppi round-trip). Il frontend carica per-type on-demand
- `test-upload` e `test-verify` funzionano in qualsiasi modalità (non solo test) — il payload è dummy e non interferisce con dati reali
- `consistency` confronta solo metadata (entityId, version), non il payload cifrato (AES-CBC con IV random produce ciphertext diverso per lo stesso plaintext)

### 3. Frontend — Pagina Wallet (card Backup Arweave)

**Layout aggiornato della card esistente:**

```
┌─ Backup Arweave ──────────────────────────────┐
│                                                │
│  Modalità:  [● Produzione]  [○ Test (ArLocal)] │
│                                                │
│  Stato: 🟢 Produzione attiva                   │
│  Indirizzo: ar1x...7fk2                        │
│  Balance: 0.045 AR                             │
│                                                │
│  [Applica]  (visibile solo se cambiata)        │
│                                                │
└────────────────────────────────────────────────┘
```

**In modalità Test attiva:**
```
│  Stato: 🟠 Test (ArLocal) attivo               │
│  Server: localhost:1984                         │
│  Wallet: generato automaticamente              │
│  Balance: 1.000 AR (test)                      │
```

**Comportamento:**
- Due radio button stilizzati (Produzione / Test)
- Badge stato colorato: verde=produzione, arancione=test, grigio=disabilitato
- Bottone "Applica" appare solo se la selezione differisce dalla modalità attiva
- Click su Applica → loading spinner → POST switch-mode → aggiorna UI
- Se produzione selezionata ma JWK non configurato → il backend ritorna errore, frontend mostra toast "Configura wallet JWK in private_arweave_conf.js"
- Se switch fallisce per upload in-flight → toast "Upload in corso, riprovare tra qualche secondo"

### 4. Frontend — Pagina Debug, Tab "Arweave"

Nuova sezione collapsibile con lo stile delle sezioni esistenti (CollapsibleSection).

**4a. Stato Arweave**
- Modalità (badge colorato)
- Connessione (OK / Errore)
- Indirizzo wallet
- Balance (formato: "0.045 AR")
- Se test: "ArLocal running su porta 1984"

**4b. Transazioni Arweave**
- Selettore Data-Type (dropdown) per caricare TX per tipo
- Bottone "Carica" per fetch lazy
- Lista TX con TxCard: txId (troncato, copiabile), entityId, version, timestamp
- Payload espandibile (JSON)
- Paginazione: mostra fino a 20, bottone "Carica altri"

**4c. Consistency Check**
- Tabella con colonne: Tipo, EntityId, Su IOTA, Su Arweave, Versione IOTA, Versione Arweave, Match
- Badge: consistent, version_mismatch, missing_on_arweave, missing_on_iota
- Bottone "Verifica Consistency" per lanciare il check

**4d. Test Interattivo**
- Bottone "Test Upload" → carica payload dummy → mostra txId risultante
- Bottone "Verifica" (abilitato dopo upload) → query + download + confronto → risultato pass/fail
- Log area con output delle operazioni in tempo reale (scrollabile)
- Indicatori: Upload OK, Query trovata, Download OK, Payload verificato

### 5. Flusso cambio modalità

```
1. User su /app/wallet, card Backup Arweave
2. Seleziona "Test (ArLocal)"
3. Clicca "Applica"
4. Frontend: POST /api/v1/arweave/switch-mode { mode: 'test' }
5. Backend ArweaveHelper.switchMode('test'):
   a. Controlla _inflightUploads: se > 0, attende drain (max 10s) o ritorna errore
   b. Se ArLocal attivo → lo ferma
   c. Avvia ArLocal sulla porta configurata (default 1984), con try/catch per EADDRINUSE
   d. Genera wallet JWK con arweave.wallets.generate()
   e. Minta 1 AR al wallet
   f. Riconfigura _arweave client → { host: localhost, port: {port}, protocol: http }
   g. Aggiorna _wallet, _enabled=true, _mode='test'
   h. Persiste stato in .tmp/arweave-runtime-state.json
6. Response: { success: true, mode: 'test', address: '...', balance: { winston: '...', ar: '1.000' }, arLocalRunning: true }
7. Frontend: aggiorna card con stato test, badge arancione
```

### 6. Bootstrap

Al bootstrap di Sails.js (hook o lifted):
1. Legge `config/private_arweave_conf.js` (config statica produzione)
2. Legge `.tmp/arweave-runtime-state.json` (stato runtime mutabile)
3. Se stato runtime `mode === 'test'`:
   - Try: avvia ArLocal, genera wallet, configura client locale
   - Catch EADDRINUSE: tenta riuso istanza esistente, oppure `_mode = 'disabled'` con warning
4. Se `mode === 'production'` e JWK presente in config statica: configura client mainnet
5. Altrimenti: `_mode = 'disabled'`

### 7. Shutdown

Quando Sails.js si spegne (SIGTERM/SIGINT):
- Se ArLocal attivo → `arLocal.stop()`
- ArLocal avviato con `detached: false` (non crea processi orfani)
- Nota: su SIGKILL il child process può restare orfano → gestito al prossimo bootstrap dal check EADDRINUSE (sezione 6.3)

### 8. Dipendenze

- `arlocal` già installato come devDependency
- Nessuna nuova dipendenza necessaria

### 9. File da creare/modificare

**Backend (modifiche):**
- `api/utility/ArweaveHelper.js` — Aggiungere switchMode, getMode, getDetailedStatus, testUpload, testVerify, getTransactionsForDebug, getConsistency, bootstrap ArLocal, safe mode switch con inflight counter
- `config/routes.js` — Aggiungere 6 nuove rotte /api/v1/arweave/*
- `config/sample_private_arweave_conf.js` — Aggiungere campo ARWEAVE_LOCAL_PORT (opzionale)

**Backend (nuovi controller):**
- `api/controllers/arweave/status.js`
- `api/controllers/arweave/switch-mode.js`
- `api/controllers/arweave/transactions.js`
- `api/controllers/arweave/test-upload.js`
- `api/controllers/arweave/test-verify.js`
- `api/controllers/arweave/consistency.js`

**Backend (nuovi file):**
- `.tmp/arweave-runtime-state.json` — Stato runtime mutabile (creato automaticamente)

**Frontend (modifiche):**
- `frontend/src/pages/Wallet.jsx` — Riscrivere card Arweave con selettore modalità
- `frontend/src/pages/Debug.jsx` — Aggiungere sezione collapsibile "Arweave"
- `frontend/src/api/endpoints.js` — Aggiungere 6 nuove funzioni API

**Cleanup:**
- `test-arweave.js` — Rimuovere (funzionalità integrata nel progetto)
