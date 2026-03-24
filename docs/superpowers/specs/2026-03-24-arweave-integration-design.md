# Design: Integrazione Arweave Produzione/Test

**Data**: 2026-03-24
**Stato**: Approvato

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

**Nuovi metodi:**

| Metodo | Descrizione |
|--------|-------------|
| `switchMode(mode)` | Ferma ArLocal se attivo, riconfigura client, genera wallet se test, persiste in config. Ritorna `{ success, mode, address, balance }` |
| `getMode()` | Ritorna modalità corrente: `'production'`, `'test'`, `'disabled'` |
| `getDetailedStatus()` | Stato completo: mode, enabled, address, balance, arLocalRunning, host, port |
| `testUpload()` | Upload payload JSON dummy, mina blocco se ArLocal, ritorna `{ success, txId }` |
| `testVerify(txId)` | Query GraphQL + download per txId, confronta payload, ritorna `{ success, found, dataMatch }` |
| `getTransactionsForDebug(limit)` | `getAllByTag` per ogni DataType + download dati, ritorna array di TX con payload |
| `getConsistency(iotaTransactions)` | Confronta lista TX IOTA con TX Arweave per entità, ritorna array di `{ entityId, type, onIota, onArweave, versionMatch, payloadMatch }` |

**Modalità Test — ArLocal:**
- ArLocal avviato come processo figlio sulla porta 1984
- Wallet JWK generato con `arweave.wallets.generate()`
- Funding automatico via `GET /mint/{address}/1000000000000`
- Mining automatico dopo ogni upload (`GET /mine`) per rendere TX disponibili a GraphQL
- ArLocal fermato quando si cambia modalità o si spegne il server

**Modalità Produzione:**
- Usa config esistente (`ARWEAVE_HOST`, `ARWEAVE_PORT`, `ARWEAVE_PROTOCOL`, `ARWEAVE_WALLET_JWK`)
- Nessun cambiamento al flusso attuale

**Persistenza modalità:**
- Nuovo campo `ARWEAVE_MODE` in `config/private_arweave_conf.js`
- Valori: `'production'` | `'test'`
- Se il file non esiste o JWK è null e mode non è test → `'disabled'`
- Al bootstrap: se mode=test, avvia ArLocal automaticamente

### 2. Nuovi Endpoint API

| Metodo | Rotta | Body/Params | Risposta |
|--------|-------|-------------|----------|
| GET | `/api/v1/arweave/status` | — | `{ mode, enabled, address, balance, arLocalRunning, host, port }` |
| POST | `/api/v1/arweave/switch-mode` | `{ mode: 'production'\|'test' }` | `{ success, mode, address, balance, arLocalRunning, error? }` |
| GET | `/api/v1/arweave/transactions` | `?limit=50` | `{ transactions: [{ txId, dataType, entityId, version, timestamp, data }] }` |
| POST | `/api/v1/arweave/test-upload` | — | `{ success, txId, error? }` |
| POST | `/api/v1/arweave/test-verify` | `{ txId }` | `{ success, found, dataMatch, uploadedData, downloadedData, error? }` |
| GET | `/api/v1/arweave/consistency` | — | `{ entities: [{ entityId, type, onIota, onArweave, iotaVersion, arweaveVersion, versionMatch }] }` |

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
- Se produzione selezionata ma JWK non configurato → messaggio "Configura wallet JWK in private_arweave_conf.js"

### 4. Frontend — Pagina Debug, Tab "Arweave"

Nuova sezione collapsibile con lo stile delle sezioni esistenti (CollapsibleSection).

**4a. Stato Arweave**
- Modalità (badge colorato)
- Connessione (OK / Errore)
- Indirizzo wallet
- Balance
- Se test: "ArLocal running su porta 1984"

**4b. Transazioni Arweave**
- Lista TX raggruppate per Data-Type (come la sezione Blockchain Transactions)
- Ogni TX mostra: txId (troncato, copiabile), entityId, version, timestamp
- Payload espandibile (JSON decriptato se possibile)
- Caricamento lazy con bottone "Carica transazioni"

**4c. Consistency Check**
- Tabella con colonne: Tipo, EntityId, Su IOTA, Su Arweave, Versione IOTA, Versione Arweave, Match
- Badge: ✅ consistent, ⚠️ version_mismatch, ❌ missing_on_arweave, ❌ missing_on_iota
- Bottone "Verifica Consistency" per lanciare il check

**4d. Test Interattivo**
- Bottone "Test Upload" → carica payload dummy → mostra txId risultante
- Bottone "Verifica" (abilitato dopo upload) → query + download + confronto → risultato pass/fail
- Log area con output delle operazioni in tempo reale (scrollabile)
- Indicatori: ✓ Upload OK, ✓ Query trovata, ✓ Download OK, ✓ Payload verificato

### 5. Flusso cambio modalità

```
1. User su /app/wallet, card Backup Arweave
2. Seleziona "Test (ArLocal)"
3. Clicca "Applica"
4. Frontend: POST /api/v1/arweave/switch-mode { mode: 'test' }
5. Backend ArweaveHelper.switchMode('test'):
   a. Se ArLocal attivo → lo ferma
   b. Avvia ArLocal sulla porta 1984
   c. Genera wallet JWK con arweave.wallets.generate()
   d. Minta 1 AR al wallet
   e. Riconfigura _arweave client → { host: localhost, port: 1984, protocol: http }
   f. Aggiorna _wallet, _enabled=true, _mode='test'
   g. Persiste ARWEAVE_MODE='test' in config/private_arweave_conf.js
6. Response: { success: true, mode: 'test', address: '...', balance: '1.000', arLocalRunning: true }
7. Frontend: aggiorna card con stato test, badge arancione
```

### 6. Bootstrap

Al bootstrap di Sails.js (hook o lifted):
1. Legge `config/private_arweave_conf.js`
2. Se `ARWEAVE_MODE === 'test'`: avvia ArLocal, genera wallet, configura client locale
3. Se `ARWEAVE_MODE === 'production'` e JWK presente: configura client mainnet
4. Altrimenti: `_mode = 'disabled'`

### 7. Shutdown

Quando Sails.js si spegne (SIGTERM/SIGINT):
- Se ArLocal attivo → `arLocal.stop()`
- Cleanup automatico

### 8. Dipendenze

- `arlocal` già installato come devDependency
- Nessuna nuova dipendenza necessaria

### 9. File da creare/modificare

**Backend (modifiche):**
- `api/utility/ArweaveHelper.js` — Aggiungere switchMode, getMode, getDetailedStatus, testUpload, testVerify, getTransactionsForDebug, getConsistency, bootstrap ArLocal
- `config/routes.js` — Aggiungere 6 nuove rotte /api/v1/arweave/*
- `config/sample_private_arweave_conf.js` — Aggiungere campo ARWEAVE_MODE

**Backend (nuovi controller):**
- `api/controllers/arweave/status.js`
- `api/controllers/arweave/switch-mode.js`
- `api/controllers/arweave/transactions.js`
- `api/controllers/arweave/test-upload.js`
- `api/controllers/arweave/test-verify.js`
- `api/controllers/arweave/consistency.js`

**Frontend (modifiche):**
- `frontend/src/pages/Wallet.jsx` — Riscrivere card Arweave con selettore modalità
- `frontend/src/pages/Debug.jsx` — Aggiungere sezione collapsibile "Arweave"
- `frontend/src/api/endpoints.js` — Aggiungere 6 nuove funzioni API

**Cleanup:**
- `test-arweave.js` — Rimuovere (funzionalità integrata nel progetto)
