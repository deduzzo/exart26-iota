# ExArt26 IOTA - Gestione Liste d'Attesa Decentralizzata

## Descrizione
Applicazione per la gestione delle liste d'attesa per la riabilitazione sanitaria (Ex art. 26) decentralizzata, che utilizza la rete IOTA/Shimmer e il framework Sails.js v1.

## Stack Tecnologico
- **Backend**: Sails.js v1.5.0 (Node.js >= 17)
- **Blockchain**: @iota/sdk v1.1.5 (supporto IOTA e Shimmer)
- **Database**: sails-disk (dev) / MySQL (produzione)
- **Frontend**: EJS templates + Bootstrap 5.3.3
- **Crittografia**: RSA-2048 + AES-256-CBC + HMAC-SHA256
- **Real-time**: Socket.io via sails-hook-sockets
- **API Docs**: Swagger (auto-generato)

## Architettura

### Modelli (api/models/)
- **Organizzazione** → ha molte Strutture
- **Struttura** → appartiene a Organizzazione, ha molte Liste
- **Lista** → appartiene a Struttura, ha molti Assistiti (M2M)
- **Assistito** → ha molte Liste (M2M via AssistitiListe)
- **AssistitiListe** → tabella di giunzione con stato e timestamp

### Gerarchia Entita
```
Organizzazione
  └── Struttura (1:N)
       └── Lista (1:N)
            └── Assistito (M:N via AssistitiListe)
```

### Componenti Core (api/utility/)
- **iota.js** - Gestione wallet IOTA, account, transazioni con payload cifrati
- **ListManager.js** - Logica business: sync DB<->blockchain, CRUD entita con crittografia
- **CryptHelper.js** - Crittografia ibrida RSA+AES, firma digitale, HMAC

### Flusso Crittografico
1. Dati cifrati con AES-256-CBC (chiave random)
2. Chiave AES cifrata con RSA-2048 (chiave pubblica destinatario)
3. HMAC-SHA256 per integrita dei dati
4. Tutto inviato come tagged payload su IOTA

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
npm install

# Lint
npx eslint api/
```

## Configurazione
- `config/private_iota_conf.js` - Configurazione IOTA (NON committare, vedi sample)
- `config/custom.js` - URL base, email, token TTL
- `config/datastores.js` - Connessione DB
- `config/security.js` - CSRF abilitato
- `config/routes.js` - Tutte le rotte API

## API Routes
| Metodo | Rotta | Descrizione |
|--------|-------|-------------|
| GET | / | Homepage/redirect |
| GET | /dashboard | Dashboard principale |
| GET | /organizzazioni/:id? | Lista organizzazioni |
| GET | /strutture/:idOrg?/:id? | Lista strutture |
| GET | /assistiti/:id? | Lista assistiti |
| POST | /api/v1/add-organizzazione | Crea organizzazione |
| POST | /api/v1/add-struttura | Crea struttura |
| POST | /api/v1/add-lista | Crea lista |
| POST | /api/v1/add-assistito | Crea assistito |
| POST | /api/v1/add-assistito-in-lista | Aggiunge assistito a lista |
| POST | /api/v1/fetch-db-from-blockchain | Sync DB dalla blockchain |
| GET | /api/v1/wallet/get-info | Info wallet |
| GET | /swagger.json | Schema OpenAPI |
| GET | /docs | Swagger UI |

## File Sensibili (mai committare)
- `config/private_iota_conf.js` - Chiavi private IOTA, password Stronghold
- `wallet-db/` - Database wallet locale
- `.tmp/` - File temporanei

## Note Sviluppo
- Ogni entita (Organizzazione, Struttura, Assistito) ha una coppia RSA generata alla creazione
- Le chiavi private vengono memorizzate sia nel DB locale che nella blockchain (cifrate con la chiave pubblica MAIN)
- Il `customToJSON()` nei modelli omette le privateKey dalle risposte JSON
- Il bootstrap carica i dati dalla blockchain all'avvio se il wallet e inizializzato
- WebSocket usati per feedback real-time durante le operazioni blockchain
