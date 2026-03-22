# ExArt26 IOTA - Gestione Liste d'Attesa Decentralizzata

## Descrizione
Applicazione per la gestione delle liste d'attesa per la riabilitazione sanitaria (Ex art. 26) decentralizzata, che utilizza la rete IOTA/Shimmer come blockchain primaria e Arweave come backup permanente.

## Stack Tecnologico
- **Backend**: Sails.js v1.5.0 (Node.js >= 17)
- **Blockchain primaria**: @iota/sdk v1.1.5 (supporto IOTA e Shimmer)
- **Backup permanente**: Arweave (arweave-js v1.15.5) - opzionale, configurabile
- **Database**: sails-disk (dev) / MySQL (produzione)
- **Frontend**: EJS templates + Bootstrap 5.3.3
- **Crittografia**: RSA-2048 + AES-256-CBC + HMAC-SHA256
- **Real-time**: Socket.io via sails-hook-sockets
- **Sicurezza**: CSRF, rate limiting (express-rate-limit), autenticazione session-based
- **API Docs**: Swagger (auto-generato)

## Architettura

### Architettura Multi-Layer
```
Client (Browser)
    |
Sails.js Backend (Node.js) + DB locale (MySQL/sails-disk)
    |
    +---> IOTA/Shimmer (blockchain primaria, transazioni cifrate)
    |
    +---> Arweave (backup permanente, stesso payload cifrato)
```

### Modelli (api/models/)
- **Organizzazione** -> ha molte Strutture
- **Struttura** -> appartiene a Organizzazione, ha molte Liste
- **Lista** -> appartiene a Struttura, ha molti Assistiti (M2M)
- **Assistito** -> ha molte Liste (M2M via AssistitiListe)
- **AssistitiListe** -> tabella di giunzione con stato e timestamp

### Gerarchia Entita
```
Organizzazione
  +-- Struttura (1:N)
       +-- Lista (1:N)
            +-- Assistito (M:N via AssistitiListe)
```

### Componenti Core (api/utility/)
- **iota.js** - Gestione wallet IOTA, account, transazioni con payload cifrati
- **ListManager.js** - Logica business: sync DB<->blockchain, CRUD con crittografia, backup Arweave automatico, fallback recovery
- **CryptHelper.js** - Crittografia ibrida RSA+AES, firma digitale, HMAC
- **ArweaveHelper.js** - Client Arweave: upload dati cifrati, query GraphQL per tag, download e recovery

### Flusso Crittografico
1. Dati cifrati con AES-256-CBC (chiave random per ogni transazione)
2. Chiave AES cifrata con RSA-2048 (chiave pubblica destinatario)
3. HMAC-SHA256 per integrita dei dati
4. Payload inviato come tagged data su IOTA
5. Stesso payload duplicato su Arweave (backup non-bloccante)

### Flusso Recupero Dati
1. Cerca transazione su IOTA (primario)
2. Se non trovata -> fallback automatico su Arweave via GraphQL
3. Endpoint manuale `/api/v1/recover-from-arweave` per admin

### Enums (api/enums/)
- **TransactionDataType**: MAIN_DATA, ORGANIZZAZIONE_DATA, STRUTTURE_LISTE_DATA, ASSISTITI_DATA, PRIVATE_KEY, LISTE_IN_CODA, ASSISTITI_IN_LISTA, MOVIMENTI_ASSISTITI_LISTA
- **StatoLista**: INSERITO_IN_CODA(1), RIMOSSO_IN_ASSISTENZA(2), RIMOSSO_COMPLETATO(3), RIMOSSO_CAMBIO_LISTA(4), RIMOSSO_RINUNCIA(5), RIMOSSO_ANNULLATO(6)

## Comandi
```bash
# Sviluppo
sails lift                    # Avvia il server (dev)
node app.js                   # Avvia direttamente
NODE_ENV=production node app.js  # Produzione

# Dipendenze
npm install --ignore-scripts  # Se @iota/sdk ha problemi di build nativo
npm install

# Lint
npx eslint api/
```

## Configurazione
- `config/private_iota_conf.js` - Configurazione IOTA (NON committare, vedi sample)
- `config/private_arweave_conf.js` - Wallet Arweave JWK (NON committare, vedi sample)
- `config/custom.js` - URL base, email, token TTL
- `config/datastores.js` - Connessione DB
- `config/security.js` - CSRF abilitato
- `config/policies.js` - Autenticazione e autorizzazione rotte
- `config/http.js` - Rate limiting (100 req/15min per IP su /api/)
- `config/routes.js` - Tutte le rotte API

## API Routes
| Metodo | Rotta | Descrizione | Auth |
|--------|-------|-------------|------|
| GET | / | Homepage/redirect | No |
| GET | /dashboard | Dashboard principale | Si |
| GET | /organizzazioni/:id? | Lista organizzazioni | Si |
| GET | /strutture/:idOrg?/:id? | Lista strutture | Si |
| GET | /assistiti/:id? | Lista assistiti | Si |
| POST | /api/v1/add-organizzazione | Crea organizzazione | Si |
| POST | /api/v1/add-struttura | Crea struttura | Si |
| POST | /api/v1/add-lista | Crea lista | Si |
| POST | /api/v1/add-assistito | Crea assistito (WebSocket) | Si |
| POST | /api/v1/add-assistito-in-lista | Aggiunge assistito a lista | Si |
| POST | /api/v1/fetch-db-from-blockchain | Sync DB dalla blockchain | Admin |
| POST | /api/v1/recover-from-arweave | Recupera dati da Arweave | Admin |
| GET | /api/v1/wallet/get-info | Info wallet IOTA | Si |
| GET | /wallet/verifica | Verifica/inizializza wallet | Si + Wallet |
| GET | /swagger.json | Schema OpenAPI | Si |
| GET | /docs | Swagger UI | Si |

## File Sensibili (mai committare)
- `config/private_iota_conf.js` - Chiavi private IOTA, password Stronghold
- `config/private_arweave_conf.js` - Wallet Arweave JWK
- `wallet-db/` - Database wallet locale
- `.tmp/` - File temporanei

## Note Sviluppo
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
