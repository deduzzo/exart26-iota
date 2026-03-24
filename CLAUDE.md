# ExArt26 IOTA - Gestione Liste d'Attesa Decentralizzata

## Descrizione
Applicazione per la gestione delle liste d'attesa per la riabilitazione sanitaria (Ex art. 26) decentralizzata, che utilizza la rete IOTA 2.0 Rebased come blockchain primaria e Arweave come backup permanente. Frontend moderno con React + Vite + TailwindCSS (dark mode, glassmorphism, neon gradients).

## Stack Tecnologico
- **Frontend**: React 19 + Vite 6 + TailwindCSS 4 + Framer Motion + React Router 7 + Lucide React
- **Backend**: Sails.js v1.5.0 (Node.js >= 17)
- **Blockchain primaria**: @iota/iota-sdk v1.10+ (IOTA 2.0 Rebased, Ed25519, Programmable TX Blocks)
- **Backup permanente**: Arweave (arweave-js v1.15.5) - opzionale, configurabile
- **Database**: sails-disk (dev) / MySQL (produzione)
- **Real-time**: Socket.io via sails-hook-sockets
- **Crittografia**: RSA-2048 + AES-256-CBC + HMAC-SHA256
- **Sicurezza**: CSRF, rate limiting (express-rate-limit), nessuna autenticazione
- **API Docs**: Swagger (auto-generato)
- **Task Runner**: Grunt con task personalizzati per Node.js >= 20

## Architettura

### Architettura 3-Tier
```
React SPA (Vite, porta 5173 in dev)
    |
    | REST API / WebSocket (proxy Vite -> :1337)
    v
Sails.js Backend (porta 1337) + DB locale (MySQL/sails-disk) + BlockchainData cache
    |
    +---> IOTA 2.0 Rebased (blockchain primaria, Programmable TX Blocks)
    |
    +---> Arweave (backup permanente, stesso payload cifrato)
```

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
- **iota.js** - IOTA 2.0 Rebased: keypair Ed25519 da mnemonic BIP39, publishData via Programmable TX Blocks, cache locale BlockchainData, faucet testnet/devnet. Dynamic import() ESM per compatibilita CommonJS Sails.js
- **ListManager.js** - Logica business: sync DB<->blockchain, CRUD con crittografia, backup Arweave automatico, fallback recovery
- **CryptHelper.js** - Crittografia ibrida RSA+AES, firma digitale, HMAC
- **ArweaveHelper.js** - Client Arweave: upload dati cifrati, query GraphQL per tag, download e recovery

### Interfaccia iota.js (funzioni esportate)
- `loadSdk()` - Carica moduli ESM @iota/iota-sdk via dynamic import
- `getClient()` - Ottieni IotaClient (lazy-loaded)
- `getKeypair()` - Ottieni Ed25519Keypair dal mnemonic
- `getAddress()` - Ottieni indirizzo IOTA del wallet
- `isWalletInitialized()` - Verifica se il mnemonic e presente e il wallet funziona
- `getOrInitWallet()` - Inizializza wallet: genera mnemonic, salva in config, richiede faucet
- `getStatusAndBalance()` - Status, balance (nanos), address, network, explorerUrl
- `publishData(tag, dataObject, entityId?, version?)` - Pubblica dati cifrati su blockchain + cache BlockchainData
- `getLastDataByTag(tag, entityId?)` - Ultimo dato per tag (da cache locale)
- `getAllDataByTag(tag, entityId?)` - Tutti i dati per tag (da cache locale)
- `requestFaucet()` - Richiedi fondi dal faucet testnet/devnet
- `GET_MAIN_KEYS()` - Ritorna le chiavi RSA master dalla configurazione
- `setSocketId(socketId)` - Imposta socket per feedback real-time
- `stringToHex(text)` / `hexToString(hex)` - Conversioni hex utility

### Flusso Crittografico
1. Dati cifrati con AES-256-CBC (chiave random per ogni transazione)
2. Chiave AES cifrata con RSA-2048 (chiave pubblica destinatario)
3. HMAC-SHA256 per integrita dei dati
4. Payload pubblicato come Programmable TX Block su IOTA 2.0 + salvato in BlockchainData
5. Stesso payload duplicato su Arweave (backup non-bloccante)

### Flusso Recupero Dati
1. Cerca in cache locale BlockchainData (primario)
2. Se non trovato -> fallback automatico su Arweave via GraphQL
3. Endpoint manuale `/api/v1/recover-from-arweave`

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
- Pagine: Dashboard, Organizzazioni, Strutture, Assistiti, Wallet
- Build di produzione: `cd frontend && npm run build` (output in `.tmp/public/`)
- SPA catch-all: `GET /app/*` serve `index.html` dal backend

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
- `config/datastores.js` - Connessione DB
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
| POST | /api/v1/add-organizzazione | Crea organizzazione (blockchain) |
| POST | /api/v1/add-struttura | Crea struttura (blockchain) |
| POST | /api/v1/add-lista | Crea lista (blockchain) |
| POST | /api/v1/add-assistito | Crea assistito (blockchain + WebSocket) |
| POST | /api/v1/add-assistito-in-lista | Aggiunge assistito a lista (blockchain) |
| POST | /api/v1/fetch-db-from-blockchain | Sync DB dalla blockchain (richiede wallet) |
| POST | /api/v1/recover-from-arweave | Recupera dati da Arweave (richiede wallet) |
| GET | /api/v1/wallet/get-info | Info wallet IOTA 2.0 |
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
- Nessuna autenticazione: tutte le rotte sono pubbliche
- Ogni entita (Organizzazione, Struttura, Lista, Assistito) ha una coppia RSA generata alla creazione
- Le chiavi private vengono memorizzate sia nel DB locale che nella blockchain (cifrate con la chiave pubblica MAIN)
- Il `customToJSON()` nei modelli omette le privateKey dalle risposte JSON
- Il bootstrap carica i dati dalla blockchain all'avvio (sync incrementale, non distruttivo)
- Se la sync al bootstrap fallisce, l'app parte comunque (graceful degradation)
- WebSocket usati per feedback real-time durante le operazioni blockchain
- Arweave e opzionale: se non configurato, il sistema funziona solo con IOTA
- Il backup Arweave e non-bloccante: se fallisce, l'operazione IOTA non viene interrotta
- I modelli usano auto-increment DB nativo per gli ID (no race condition)
- Validazione input: codice fiscale con regex, email con isEmail, minLength su denominazioni
- Rate limiting: 100 richieste per 15 minuti per IP sulle rotte /api/
- @iota/iota-sdk e ESM-only: iota.js usa dynamic import() per compatibilita con CommonJS Sails.js
- Task Grunt personalizzati per compatibilita Node.js >= 20 (clean, copy, sails-linker fix)
- Il mnemonic viene generato automaticamente e salvato nel file di configurazione al primo avvio
- Faucet testnet/devnet richiesto automaticamente alla creazione del wallet
