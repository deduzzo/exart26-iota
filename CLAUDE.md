# ExArt26 IOTA - Gestione Liste d'Attesa Decentralizzata

## Descrizione
Applicazione per la gestione delle liste d'attesa per la riabilitazione sanitaria (Ex art. 26) decentralizzata. I dati business sono archiviati **interamente on-chain** su IOTA 2.0 Rebased. Il database locale (better-sqlite3) e una cache su disco ricostruibile dalla blockchain. Arweave fornisce un backup permanente opzionale con modalita Produzione/Test (ArLocal). Frontend moderno con React + Vite + TailwindCSS (dark mode, glassmorphism, neon gradients).

## Stack Tecnologico
- **Frontend**: React 19 + Vite 6 + TailwindCSS 4 + Framer Motion + React Router 7 + Lucide React + react-force-graph-2d
- **Backend**: Sails.js v1.5.0 (Node.js >= 17)
- **Blockchain primaria**: @iota/iota-sdk v1.10+ (IOTA 2.0 Rebased, Ed25519, Programmable TX Blocks)
- **Backup permanente**: Arweave (arweave-js v1.15.5) + ArLocal per test - opzionale, toggle Produzione/Test da UI
- **Cache locale**: better-sqlite3 (SQLite su disco `.tmp/exart26.db`, ricostruibile dalla blockchain). API Waterline-like via `api/utility/db.js`
- **Real-time**: Socket.io via sails-hook-sockets
- **Crittografia**: RSA-2048 + AES-256-CBC + HMAC-SHA256
- **Sicurezza**: CSRF, nessuna autenticazione
- **API Docs**: Swagger (auto-generato)
- **Task Runner**: Grunt con task personalizzati per Node.js >= 20

## Architettura

### Source of Truth = Blockchain
```
React SPA (Vite, porta 5173 in dev)
    |
    | REST API / WebSocket (proxy Vite -> :1337)
    v
Sails.js Backend (porta 1337) + SQLite via better-sqlite3 (CACHE su disco, ricostruibile)
    |
    +---> IOTA 2.0 Rebased (SOURCE OF TRUTH, dati on-chain via u64 encoding)
    |
    +---> Arweave (backup permanente, stesso payload cifrato)
```

Il DB locale NON contiene dati business autoritativi. Puo essere cancellato e ricostruito dalla blockchain in qualsiasi momento tramite `POST /api/v1/fetch-db-from-blockchain`.

### Codifica Dati On-Chain (u64 split-coin)

I dati vengono archiviati interamente on-chain usando i **Programmable Transaction Blocks** di IOTA 2.0. Il payload JSON viene **compresso con gzip**, suddiviso in chunk da 6 byte, ciascuno codificato come amount `u64` di una operazione `splitCoins`:

```
Programmable Transaction Block:
  splitCoins(gas, [amount0, amount1, ..., amountN])  // batch da max 500
  transferObjects([coin0, coin1, ..., coinN], selfAddress)

  amount[0] = 2                              <- Marker (1=legacy JSON, 2=gzip)
  amount[1] = payloadLength (in bytes)       <- Lunghezza del buffer compresso
  amount[2..N] = chunk (2 bytes index + 6 bytes dati = u64)
```

Se il payload compresso supera il limite di una TX (~3KB), viene automaticamente diviso in piu TX collegate con **chain-linking**:
- Ogni parte e un wrapper JSON: `{app, _chain: {tag, entityId, part, total, prev}, _data: base64(bytes)}`
- Alla lettura, `_reassembleChainedTxs` ricostruisce il payload originale seguendo la catena `prev`
- Le publicKey vengono rimosse dal payload prima della cifratura (~60% riduzione)

Funzioni chiave in `iota.js`:
- `_encodePayloadToChunks(payloadStr)` - JSON -> array di BigInt u64
- `_decodeChunksToPayload(u64Values, payloadLength)` - u64 array -> JSON string
- `_decodeTransactionPayload(txDetail)` - Decodifica una transazione completa (verifica marker, estrae payload)
- `_queryTransactionsFromChain(tag, entityId, limit)` - Query `queryTransactionBlocks` per `FromAddress`, decodifica e filtra

### MAIN_DATA come Indice Leggero

MAIN_DATA non contiene l'intero dataset. E un **indice certificato** che elenca gli entityId per tipo:

```json
{
  "entities": [
    { "type": "ORGANIZZAZIONE_DATA", "entityId": 1, "digest": "..." },
    { "type": "STRUTTURE_LISTE_DATA", "entityId": 1, "digest": "..." },
    { "type": "ASSISTITI_DATA", "entityId": "ASS#1", "digest": "..." }
  ],
  "version": 5,
  "updatedAt": 1711234567890
}
```

Ogni entita ha la propria transazione dedicata sulla chain. MAIN_DATA serve come start-point per il recovery:
1. Leggi MAIN_DATA (indice) dalla chain
2. Per ogni entityId nell'indice, recupera la transazione dedicata
3. Se MAIN_DATA non esiste, fallback: discovery scansionando tutte le TX per tag

### Controller Non-Bloccanti

Tutti i controller CRUD (add-organizzazione, add-struttura, add-lista, add-assistito, add-assistito-in-lista, rimuovi-assistito-da-lista) seguono questo pattern:
1. Validazione input
2. Salvataggio nella cache locale (DB)
3. **Risposta immediata al client** (HTTP 200)
4. `setImmediate(async () => { ... })` per pubblicazione blockchain in background
5. Aggiornamento MAIN_DATA index
6. Backup su Arweave (non-bloccante)

### Modelli (api/models/)
- **Organizzazione** -> ha molte Strutture
- **Struttura** -> appartiene a Organizzazione, ha molte Liste
- **Lista** -> appartiene a Struttura, ha molti Assistiti (M2M)
- **Assistito** -> ha molte Liste (M2M via AssistitiListe)
- **AssistitiListe** -> tabella di giunzione con stato e timestamp
- **BlockchainData** -> cache locale transazioni blockchain (digest, tag, entityId, version, payload, timestamp)

### Gerarchia Entita
```
Organizzazione
  +-- Struttura (1:N)
       +-- Lista (1:N)
            +-- Assistito (M:N via AssistitiListe)
```

### Componenti Core (api/utility/)
- **iota.js** - IOTA 2.0 Rebased: keypair Ed25519 da mnemonic BIP39, codifica u64 split-coin, publishData via Programmable TX Blocks, lettura diretta dalla chain (zero DB locale), faucet testnet/devnet. Dynamic import() ESM per compatibilita CommonJS Sails.js
- **ListManager.js** - Logica business: gestione indice MAIN_DATA, sync blockchain->cache, CRUD con crittografia, backup Arweave automatico, recovery con fallback discovery
- **CryptHelper.js** - Crittografia ibrida RSA+AES, firma digitale, HMAC
- **ArweaveHelper.js** - Client Arweave riconfigurabile runtime: modalita Produzione (arweave.net) o Test (ArLocal locale). switchMode(), bootstrap ArLocal, upload con inflight counter, query GraphQL, download e recovery. Stato runtime in `.tmp/arweave-runtime-state.json`
- **db.js** - Storage layer SQLite con API Waterline-like. File DB: `.tmp/exart26.db`. Metodi: find, findOne, create, update, destroy, count. Metodi join: findWithOrg, findWithDetails, findWithStruttura. Transazioni atomiche via `db.transaction()`. Query raw via `db.raw`

### Interfaccia iota.js (funzioni esportate)
- `loadSdk()` - Carica moduli ESM @iota/iota-sdk via dynamic import
- `getClient()` - Ottieni IotaClient (lazy-loaded)
- `getKeypair()` - Ottieni Ed25519Keypair dal mnemonic
- `getAddress()` - Ottieni indirizzo IOTA del wallet
- `isWalletInitialized()` - Verifica se il mnemonic e presente e il wallet funziona
- `getOrInitWallet()` - Inizializza wallet: genera mnemonic, salva in config, richiede faucet. Ritorna `{ init, mnemonic, address }`
- `getStatusAndBalance()` - Status, balance (nanos), address, network, explorerUrl
- `publishData(tag, dataObject, entityId?, version?)` - Codifica payload come u64 split-coin amounts e pubblica su blockchain
- `getLastDataByTag(tag, entityId?)` - Ultimo dato per tag (query diretta dalla chain)
- `getAllDataByTag(tag, entityId?)` - Tutti i dati per tag (query diretta dalla chain)
- `requestFaucet()` - Richiedi fondi dal faucet testnet/devnet
- `GET_MAIN_KEYS()` - Ritorna le chiavi RSA master dalla configurazione
- `setSocketId(socketId)` - Imposta socket per feedback real-time
- `stringToHex(text)` / `hexToString(hex)` - Conversioni hex utility

### Funzioni interne iota.js (non esportate)
- `_encodePayloadToChunks(payloadStr)` - Converte JSON string in array di BigInt u64 (chunk da 7 byte + 1 byte indice)
- `_decodeChunksToPayload(u64Values, payloadLength)` - Ricostruisce JSON string da array u64
- `_decodeTransactionPayload(txDetail)` - Decodifica una transazione IOTA: verifica marker (amount[0]=1), estrae lunghezza e chunk, ricostruisce payload JSON
- `_queryTransactionsFromChain(tag, entityId, limit)` - Interroga la chain con `queryTransactionBlocks({ filter: { FromAddress } })`, decodifica e filtra per tag/entityId

### Flusso Crittografico
1. Dati cifrati con AES-256-CBC (chiave random per ogni transazione)
2. Chiave AES cifrata con RSA-2048 OAEP SHA-256 (chiave pubblica destinatario)
3. HMAC-SHA256 per integrita dei dati
4. Payload codificato come u64 split-coin amounts nel Programmable TX Block su IOTA 2.0
5. Stesso payload duplicato su Arweave (backup non-bloccante)

### Flusso Recupero Dati (Bootstrap Sync con SQLite)
1. **Step 1**: Server lifta immediatamente con i dati gia in SQLite su disco (istantaneo se non e il primo avvio)
2. **Step 2**: Sync blockchain in background (non bloccante)
   - Leggi indice MAIN_DATA dalla blockchain (start-point certificato)
   - Per ogni entityId nell'indice, recupera la transazione dedicata per tag
   - Se MAIN_DATA non esiste -> fallback: discovery scansionando tutte le TX per tag
   - Ulteriore fallback -> recovery da Arweave via GraphQL
3. **Step 3**: I dati decrittati vengono scritti direttamente su SQLite (zero accumulo RAM)
4. Endpoint manuale `/api/v1/recover-from-arweave`
5. `POST /api/v1/sync-reset` per cancellare DB SQLite e riforzare sync da blockchain
6. `GET /api/v1/sync-status` per stato sync in tempo reale (syncing, progress)

### Enums (api/enums/)
- **TransactionDataType**: MAIN_DATA, ORGANIZZAZIONE_DATA, STRUTTURE_LISTE_DATA, ASSISTITI_DATA, PRIVATE_KEY, LISTE_IN_CODA, ASSISTITI_IN_LISTA, MOVIMENTI_ASSISTITI_LISTA
- **StatoLista**: INSERITO_IN_CODA(1), RIMOSSO_IN_ASSISTENZA(2), RIMOSSO_COMPLETATO(3), RIMOSSO_CAMBIO_LISTA(4), RIMOSSO_RINUNCIA(5), RIMOSSO_ANNULLATO(6)

## Frontend (frontend/)
- **React 19** SPA con design futuristico dark mode
- **Vite 6** dev server (porta 5173) con proxy verso backend Sails.js (porta 1337)
- **TailwindCSS 4** per styling (glassmorphism, neon gradients)
- **Framer Motion** per animazioni e transizioni
- **React Router 7** per navigazione
- **socket.io-client** per feedback real-time WebSocket
- **Lucide React** per icone
- **react-force-graph-2d** per visualizzazione grafo
- Pagine: Dashboard, Organizzazioni, Strutture, Assistiti, **Liste**, Wallet, **Grafo**, **Pubblico**, **Debug**, **Load Test**
- **WalletInitModal**: componente globale in `Layout.jsx`, modale che appare su ogni pagina se il wallet non e inizializzato. Mostra pulsante init, poi mnemonic con copia, poi "continua"
- **Banner sync**: barra progresso animata durante la sincronizzazione blockchain, con status, percentuale, contatori org/str/ass. Polling ogni 2 secondi, scompare automaticamente. Visibile su ogni pagina
- Build di produzione: `cd frontend && npm run build` (output in `.tmp/public/`)
- SPA catch-all: `GET /app/*` serve `index.html` dal backend

### Pagina Liste (/app/liste)
- **Layout a 2 colonne** con filtro testuale per ricerca rapida
- Cards per ogni lista con **statistiche** (in coda, usciti, media attesa giorni)
- Vista **coda** con posizioni numerate (#1, #2...)
- Bottone **"Chiama"** per il primo in coda (rimozione con stato IN_ASSISTENZA)
- Toggle **Coda/Storico** per ogni lista
- Rimozione assistiti con selezione stato (in assistenza, completato, rinuncia, annullato)
- Dati caricati da `GET /api/v1/liste-dettaglio?idLista=X`

### Pagina Pubblico (/app/pubblico)
- Frontend **pubblico anonimizzato** per verifica posizione in lista
- Ogni assistito mostrato come **ID anonimo** (primi 8 caratteri SHA-256 del codice fiscale)
- L'utente inserisce il proprio CF, viene **hashato lato client**, e la sua posizione viene evidenziata
- Toggle Coda/Storico per ogni lista
- **Zero dati personali esposti**
- Dati caricati da `GET /api/v1/public/liste`

### Pagina Grafo (/app/grafo)
- Visualizzazione interattiva **force-directed** di tutte le entita
- Nodi colorati per tipo: organizzazioni (viola), strutture (cyan), liste (verde), assistiti (arancione), **trattati (rosso)**
- **Nodi Trattati**: pazienti usciti dalla lista, aggregati per lista
- Pannello dettagli al hover con chiavi, indirizzi, timestamp
- Dati caricati da `GET /api/v1/graph-data`

### Pagina Load Test (/app/load-test)
- Generazione dati di prova direttamente dall'UI
- Log in tempo reale delle operazioni eseguite
- Utile per test e demo del sistema

### Pagina Debug (/app/debug)
- Mostra stato **wallet** (indirizzo, balance, rete)
- Visualizza **transazioni blockchain** con decrypt del payload
- Mostra contenuto **DB locale** (cache)
- **Cross-references** con verifica consistency tra DB e blockchain

## Comandi
```bash
# Backend - Sviluppo
node app.js                       # Avvia il server Sails.js (porta 1337)
NODE_ENV=production node app.js   # Produzione

# Frontend - Sviluppo
cd frontend && npm run dev        # Vite dev server (porta 5173)
cd frontend && npm run build      # Build produzione (output: .tmp/public/)

# Simulazione dati
npm run simulate                  # Simulazione continua infinita con crescita proporzionale

# Dipendenze
npm install                       # Backend
cd frontend && npm install        # Frontend

# Lint
npx eslint api/
```

## Configurazione
- `config/private_iota_conf.js` - Configurazione IOTA 2.0 (NON committare, vedi sample): IOTA_NETWORK, IOTA_NODE_URL, IOTA_MNEMONIC, MAIN_PRIVATE_KEY, MAIN_PUBLIC_KEY, IOTA_EXPLORER_URL
- `config/private_arweave_conf.js` - Wallet Arweave JWK (NON committare, vedi sample)
- `config/custom.js` - URL base, email, token TTL
- `config/datastores.js` - sails-disk stub (migrate: safe, non usato per storage reale)
- `.tmp/exart26.db` - Database SQLite (cache locale, ricostruibile dalla blockchain)
- `.tmp/arweave-runtime-state.json` - Stato runtime Arweave (mode, test wallet JWK)
- `config/security.js` - CSRF abilitato
- `config/policies.js` - Tutte le rotte pubbliche (`'*': true`), rotte admin richiedono wallet inizializzato
- `config/http.js` - Middleware HTTP (rate limiting disabilitato per compatibilita SPA)
- `config/routes.js` - Tutte le rotte API + SPA catch-all `GET /app/*`
- `frontend/vite.config.js` - Proxy dev server, build output

## API Routes
| Metodo | Rotta | Descrizione |
|--------|-------|-------------|
| GET | / | Homepage/redirect |
| GET | /api/v1/dashboard | Statistiche dashboard (JSON) |
| GET | /api/v1/organizzazioni/:id? | Lista/dettaglio organizzazioni (JSON) |
| GET | /api/v1/strutture?organizzazione=X | Lista strutture per organizzazione con stats liste (JSON) |
| GET | /api/v1/assistiti/:id? | Lista/dettaglio assistiti con liste assegnate e posizione in coda (JSON) |
| GET | /api/v1/liste-dettaglio?idLista=X | Dettaglio lista: coda con posizione + storico movimenti (JSON) |
| GET | /api/v1/graph-data | Dati per grafo interattivo (tutte le entita con relazioni) |
| GET | /api/v1/debug | Dati debug: wallet, transazioni blockchain con decrypt, DB locale, cross-references |
| GET | /api/v1/public/liste | **API pubblica**: liste anonimizzate (ID = hash SHA-256 del CF, 8 char) |
| POST | /api/v1/add-organizzazione | Crea organizzazione (risposta immediata, blockchain in background) |
| POST | /api/v1/add-struttura | Crea struttura (risposta immediata, blockchain in background) |
| POST | /api/v1/add-lista | Crea lista (risposta immediata, blockchain in background) |
| POST | /api/v1/add-assistito | Crea assistito (risposta immediata, blockchain in background) |
| POST | /api/v1/add-assistito-in-lista | Aggiunge assistito a lista (risposta immediata, blockchain in background) |
| POST | /api/v1/rimuovi-assistito-da-lista | Rimuove assistito da lista con stato: body `{ idAssistitoListe, stato }` (2=assistenza, 3=completato, 5=rinuncia, 6=annullato) |
| POST | /api/v1/fetch-db-from-blockchain | Ricostruisce cache dalla blockchain (legge MAIN_DATA index) |
| POST | /api/v1/recover-from-arweave | Recupera dati da Arweave (richiede wallet) |
| POST | /api/v1/sync-reset | Cancella cache locale e riforza sync da blockchain |
| GET | /api/v1/sync-status | Stato sync in tempo reale (syncing, progress, contatori) |
| POST | /api/v1/wallet/init | Inizializza wallet: genera mnemonic, ritorna { success, mnemonic, address } |
| POST | /api/v1/wallet/reset | Reset wallet: distrugge e ricrea wallet (doppia conferma UI) |
| GET | /api/v1/wallet/get-info | Info wallet IOTA 2.0 (status, balance, address, network) |
| GET | /api/v1/arweave/status | Stato Arweave: mode, enabled, address, balance, arLocalRunning |
| POST | /api/v1/arweave/switch-mode | Cambia modalita Arweave: `{ mode: 'production'\|'test' }` |
| GET | /api/v1/arweave/transactions | Transazioni Arweave per dataType: `?dataType=X&limit=20` |
| POST | /api/v1/arweave/test-upload | Test upload payload dummy su Arweave |
| POST | /api/v1/arweave/test-verify | Verifica transazione Arweave: `{ txId }` |
| GET | /api/v1/arweave/consistency | Consistency check IOTA vs Arweave per entita |
| GET | /api/v1/get-transaction | Recupera transazione specifica |
| GET | /api/v1/export-data | Esporta snapshot JSON completo di tutti i dati (download) |
| POST | /api/v1/verify-snapshot | Confronta snapshot JSON con stato attuale del DB (body: `{ snapshot }`) |
| GET | /api/v1/pending-tx | Numero TX blockchain in coda (pending) |
| GET | /swagger.json | Schema OpenAPI |
| GET | /docs | Swagger UI |
| GET | /csrfToken | Token CSRF |
| GET | /app/* | SPA catch-all (frontend React compilato) |

## File Sensibili (mai committare)
- `config/private_iota_conf.js` - Mnemonic BIP39, chiavi RSA master
- `config/private_arweave_conf.js` - Wallet Arweave JWK
- `.tmp/` - File temporanei e build frontend

## Note Sviluppo
- **Dati interamente on-chain**: il DB locale e solo una cache. Source of truth = blockchain IOTA 2.0
- **Controller sincroni**: tutti i CRUD attendono la conferma blockchain prima di rispondere (zero TX perse). I controller `add-assistito-in-lista` e `rimuovi-assistito-da-lista` pubblicano in modo sincrono con retry automatico
- **MAIN_DATA e un indice leggero**: contiene solo entityId per tipo (~50 byte per entita), non l'intero dataset
- Nessuna autenticazione: tutte le rotte sono pubbliche
- Ogni entita (Organizzazione, Struttura, Lista, Assistito) ha una coppia RSA generata alla creazione
- Le chiavi private vengono salvate on-chain come transazioni PRIVATE_KEY (cifrate con la chiave pubblica MAIN)
- Il `customToJSON()` nei modelli omette le privateKey dalle risposte JSON
- Il bootstrap legge l'indice MAIN_DATA dalla chain e ricostruisce la cache locale (sync incrementale)
- Se la sync al bootstrap fallisce, l'app parte comunque (graceful degradation)
- WebSocket usati per feedback real-time durante le operazioni blockchain
- Arweave e opzionale: se non configurato, il sistema funziona solo con IOTA
- Il backup Arweave e non-bloccante: se fallisce, l'operazione IOTA non viene interrotta
- I modelli usano auto-increment DB nativo per gli ID (no race condition)
- Validazione input: codice fiscale con regex, email con isEmail, minLength su denominazioni
- Rate limiting disabilitato per compatibilita SPA (commentato in config/http.js)
- @iota/iota-sdk e ESM-only: iota.js usa dynamic import() per compatibilita con CommonJS Sails.js
- **RSA OAEP SHA-256**: padding aggiornato da PKCS1 a OAEP per compatibilita Node.js 22
- Task Grunt personalizzati per compatibilita Node.js >= 20 (clean, copy, sails-linker fix)
- **WalletInitModal**: modale globale nel Layout che appare su ogni pagina se wallet non inizializzato
- **Wallet init via API**: `POST /api/v1/wallet/init` sostituisce il vecchio init EJS-based
- Faucet testnet/devnet richiesto automaticamente alla creazione del wallet
- **Pagina Liste**: `/app/liste` con cards statistiche, vista coda con posizioni, bottone "Chiama", toggle Coda/Storico, rimozione con selezione stato
- **Pagina Pubblico**: `/app/pubblico` frontend anonimizzato per verifica posizione (hash SHA-256 del CF, zero dati personali)
- **Pagina Grafo**: `/app/grafo` con react-force-graph-2d, dati da `GET /api/v1/graph-data`
- **Pagina Debug**: `/app/debug` mostra wallet, transazioni blockchain con decrypt, DB locale, cross-references consistency
- **Pagina Load Test**: `/app/load-test` per generazione dati di prova dall'UI con log in tempo reale
- **`npm run simulate`**: script CLI per simulazione continua infinita con crescita proporzionale
- **better-sqlite3**: cache locale su disco `.tmp/exart26.db`, il server lifta subito con dati gia su disco senza caricare nulla in RAM. API Waterline-like via `db.js`. Zero OOM anche con 100K+ record
- **Banner sync UI**: barra progresso animata durante sincronizzazione blockchain, visibile su ogni pagina, polling ogni 2 secondi
- **Pagina Liste a 2 colonne**: con filtro testuale per ricerca rapida
- **Nodi Trattati nel grafo**: pazienti usciti aggregati per lista, visualizzati come nodi dedicati
- **Wallet Reset**: `POST /api/v1/wallet/reset` per distruggere e ricreare il wallet (doppia conferma UI)
- **Statistiche liste**: API strutture arricchita con stats per lista (inCoda, usciti, totale, tempoMedioGiorni)
- **Assistiti con liste**: la tabella assistiti mostra le liste assegnate con posizione in coda (#1, #2...)
- sails-disk ancora presente come stub (Sails.js lo richiede al boot) ma migrate: 'safe', non usato per storage
- I controller usano `db.js` (better-sqlite3) per tutti gli accessi dati: `const db = require('../utility/db'); db.Assistito.find({...})`
- **Arweave Produzione/Test**: toggle da UI nella pagina Wallet. Test usa ArLocal (nodo locale in-memory su porta 1984). Stato runtime in `.tmp/arweave-runtime-state.json`
- **Pagina Debug sezione Arweave**: transazioni per DataType, consistency check IOTA vs Arweave, test interattivo (upload + verify)
- **6 endpoint API Arweave**: status, switch-mode, transactions, test-upload, test-verify, consistency
- **Compressione gzip**: tutti i payload on-chain vengono compressi con gzip (marker 2, backward-compatible con marker 1 legacy). Riduzione ~20% su dati cifrati
- **Rimozione publicKey dai payload**: le chiavi RSA non vengono incluse nei dati on-chain (gia salvate come TX PRIVATE_KEY). Riduzione ~60% dimensione payload
- **Chain-linking**: payload troppo grandi per una singola TX vengono automaticamente divisi in piu TX collegate con `prev`. Riassemblaggio trasparente alla lettura. Nessun limite pratico sulla dimensione dei dati
- **Coda TX sequenziale**: `_enqueueTx()` in iota.js serializza tutte le pubblicazioni per evitare conflitti IOTA (no TX parallele dallo stesso wallet)
- **Retry automatico**: `_publishDataWithRetry()` riprova fino a 3 volte per errori di equivocation/conflict
- **Export/Verifica Snapshot**: `GET /api/v1/export-data` scarica JSON completo, `POST /api/v1/verify-snapshot` confronta record-per-record con stato attuale
- **Dashboard export**: pulsante "Esporta Snapshot JSON" e sezione "Verifica Integrita Dati" con upload file e confronto visuale
- **WebSocket real-time**: `sails.sockets.blast('dataChanged', {...})` in tutti i controller CRUD. Frontend auto-refresh via `useRealtimeRefresh` hook (debounce 300ms). Ogni pagina si aggiorna automaticamente quando un utente fa un'operazione
- **Sync Logger**: file dettagliati in `logs/` con snapshot `process.memoryUsage()` nei punti chiave della sync (INIT, POST_INDEX, POST_BULK_CACHE, POST_ENTITIES, POST_MOVIMENTI, END). Delta e peak memory nel riepilogo
- **Bulk cache sync**: `getAllTransactionsCached()` scarica tutte le TX dalla chain in un'unica passata, partiziona per tag, evita query multiple. `clearBulkCache()` libera memoria a fine sync
- **`ListManager.getWalletIdOrganizzazione/Struttura/Lista`**: helper statici esportati per i controller, usano `db.js` invece di Waterline (che e vuoto)
- **`stripKeysForBlockchain(obj)`**: rimuove publicKey/privateKey prima della cifratura on-chain
- **Documentazione**: documento completo per NotebookLM (`docs/ExArt26_IOTA_Documentazione_Completa.md`) e presentazione HTML interattiva 17 slide (`docs/presentazione-exart26.html`)
