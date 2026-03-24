# ExArt26 IOTA - Gestione Liste d'Attesa Decentralizzata

## Descrizione
Applicazione per la gestione delle liste d'attesa per la riabilitazione sanitaria (Ex art. 26) decentralizzata. I dati business sono archiviati **interamente on-chain** su IOTA 2.0 Rebased. Il database locale (sails-disk) e una cache ricostruibile dalla blockchain. Arweave fornisce un backup permanente opzionale. Frontend moderno con React + Vite + TailwindCSS (dark mode, glassmorphism, neon gradients).

## Stack Tecnologico
- **Frontend**: React 19 + Vite 6 + TailwindCSS 4 + Framer Motion + React Router 7 + Lucide React + react-force-graph-2d
- **Backend**: Sails.js v1.5.0 (Node.js >= 17)
- **Blockchain primaria**: @iota/iota-sdk v1.10+ (IOTA 2.0 Rebased, Ed25519, Programmable TX Blocks)
- **Backup permanente**: Arweave (arweave-js v1.15.5) - opzionale, configurabile
- **Cache locale**: sails-disk (persistenza su disco, ricostruibile dalla blockchain)
- **Real-time**: Socket.io via sails-hook-sockets
- **Crittografia**: RSA-2048 + AES-256-CBC + HMAC-SHA256
- **Sicurezza**: CSRF, rate limiting (express-rate-limit), nessuna autenticazione
- **API Docs**: Swagger (auto-generato)
- **Task Runner**: Grunt con task personalizzati per Node.js >= 20

## Architettura

### Source of Truth = Blockchain
```
React SPA (Vite, porta 5173 in dev)
    |
    | REST API / WebSocket (proxy Vite -> :1337)
    v
Sails.js Backend (porta 1337) + sails-disk (CACHE, ricostruibile)
    |
    +---> IOTA 2.0 Rebased (SOURCE OF TRUTH, dati on-chain via u64 encoding)
    |
    +---> Arweave (backup permanente, stesso payload cifrato)
```

Il DB locale NON contiene dati business autoritativi. Puo essere cancellato e ricostruito dalla blockchain in qualsiasi momento tramite `POST /api/v1/fetch-db-from-blockchain`.

### Codifica Dati On-Chain (u64 split-coin)

I dati vengono archiviati interamente on-chain usando i **Programmable Transaction Blocks** di IOTA 2.0. Il payload JSON viene suddiviso in chunk da 7 byte, ciascuno codificato come amount `u64` di una operazione `splitCoins`:

```
Programmable Transaction Block:
  splitCoins(gas, [amount0, amount1, ..., amountN])
  transferObjects([coin0, coin1, ..., coinN], selfAddress)

  amount[0] = 1                              <- Marker "exart26"
  amount[1] = payloadLength (in bytes)       <- Lunghezza totale del JSON
  amount[2..N] = chunk (1 byte index + 7 bytes dati = u64)
```

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

Tutti i controller CRUD (add-organizzazione, add-struttura, add-lista, add-assistito) seguono questo pattern:
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
- **ArweaveHelper.js** - Client Arweave: upload dati cifrati, query GraphQL per tag, download e recovery

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
2. Chiave AES cifrata con RSA-2048 (chiave pubblica destinatario)
3. HMAC-SHA256 per integrita dei dati
4. Payload codificato come u64 split-coin amounts nel Programmable TX Block su IOTA 2.0
5. Stesso payload duplicato su Arweave (backup non-bloccante)

### Flusso Recupero Dati (Bootstrap Sync)
1. Leggi indice MAIN_DATA dalla blockchain (start-point certificato)
2. Per ogni entityId nell'indice, recupera la transazione dedicata per tag
3. Se MAIN_DATA non esiste -> fallback: discovery scansionando tutte le TX per tag
4. Ulteriore fallback -> recovery da Arweave via GraphQL
5. Endpoint manuale `/api/v1/recover-from-arweave`

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
- Pagine: Dashboard, Organizzazioni, Strutture, Assistiti, Wallet, **Grafo**
- **WalletInitModal**: componente globale in `Layout.jsx`, modale che appare su ogni pagina se il wallet non e inizializzato. Mostra pulsante init, poi mnemonic con copia, poi "continua"
- Build di produzione: `cd frontend && npm run build` (output in `.tmp/public/`)
- SPA catch-all: `GET /app/*` serve `index.html` dal backend

### Pagina Grafo (/app/grafo)
- Visualizzazione interattiva **force-directed** di tutte le entita
- Nodi colorati per tipo: organizzazioni (viola), strutture (cyan), liste (verde), assistiti (arancione)
- Pannello dettagli al hover con chiavi, indirizzi, timestamp
- Dati caricati da `GET /api/v1/graph-data`

## Comandi
```bash
# Backend - Sviluppo
node app.js                       # Avvia il server Sails.js (porta 1337)
NODE_ENV=production node app.js   # Produzione

# Frontend - Sviluppo
cd frontend && npm run dev        # Vite dev server (porta 5173)
cd frontend && npm run build      # Build produzione (output: .tmp/public/)

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
- `config/datastores.js` - Connessione DB (sails-disk come cache, ricostruibile dalla blockchain)
- `config/security.js` - CSRF abilitato
- `config/policies.js` - Tutte le rotte pubbliche (`'*': true`), rotte admin richiedono wallet inizializzato
- `config/http.js` - Rate limiting (100 req/15min per IP su /api/)
- `config/routes.js` - Tutte le rotte API + SPA catch-all `GET /app/*`
- `frontend/vite.config.js` - Proxy dev server, build output

## API Routes
| Metodo | Rotta | Descrizione |
|--------|-------|-------------|
| GET | / | Homepage/redirect |
| GET | /api/v1/dashboard | Statistiche dashboard (JSON) |
| GET | /api/v1/organizzazioni/:id? | Lista/dettaglio organizzazioni (JSON) |
| GET | /api/v1/strutture?organizzazione=X | Lista strutture per organizzazione (JSON) |
| GET | /api/v1/assistiti/:id? | Lista/dettaglio assistiti (JSON) |
| GET | /api/v1/graph-data | Dati per grafo interattivo (tutte le entita con relazioni) |
| POST | /api/v1/add-organizzazione | Crea organizzazione (risposta immediata, blockchain in background) |
| POST | /api/v1/add-struttura | Crea struttura (risposta immediata, blockchain in background) |
| POST | /api/v1/add-lista | Crea lista (risposta immediata, blockchain in background) |
| POST | /api/v1/add-assistito | Crea assistito (risposta immediata, blockchain in background) |
| POST | /api/v1/add-assistito-in-lista | Aggiunge assistito a lista (blockchain) |
| POST | /api/v1/fetch-db-from-blockchain | Ricostruisce cache dalla blockchain (legge MAIN_DATA index) |
| POST | /api/v1/recover-from-arweave | Recupera dati da Arweave (richiede wallet) |
| POST | /api/v1/wallet/init | Inizializza wallet: genera mnemonic, ritorna { success, mnemonic, address } |
| GET | /api/v1/wallet/get-info | Info wallet IOTA 2.0 (status, balance, address, network) |
| GET | /api/v1/get-transaction | Recupera transazione specifica |
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
- **Controller non-bloccanti**: tutti i CRUD rispondono immediatamente, blockchain publishing in background via `setImmediate()`
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
- Rate limiting: 100 richieste per 15 minuti per IP sulle rotte /api/
- @iota/iota-sdk e ESM-only: iota.js usa dynamic import() per compatibilita con CommonJS Sails.js
- Task Grunt personalizzati per compatibilita Node.js >= 20 (clean, copy, sails-linker fix)
- **WalletInitModal**: modale globale nel Layout che appare su ogni pagina se wallet non inizializzato
- **Wallet init via API**: `POST /api/v1/wallet/init` sostituisce il vecchio init EJS-based
- Faucet testnet/devnet richiesto automaticamente alla creazione del wallet
- **Pagina Grafo**: `/app/grafo` con react-force-graph-2d, dati da `GET /api/v1/graph-data`
- sails-disk configurato con persistenza su disco (non inMemoryOnly) come cache locale
