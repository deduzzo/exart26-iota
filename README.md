<p align="center">
  <img src="https://img.shields.io/badge/Node.js-%3E%3D17-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Sails.js-1.5-14ACC2?style=for-the-badge&logo=sails.js&logoColor=white" alt="Sails.js">
  <img src="https://img.shields.io/badge/IOTA%202.0-Rebased-131F37?style=for-the-badge&logo=iota&logoColor=white" alt="IOTA 2.0">
  <img src="https://img.shields.io/badge/Arweave-Permaweb-222326?style=for-the-badge&logo=arweave&logoColor=white" alt="Arweave">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/TailwindCSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="TailwindCSS">
  <img src="https://img.shields.io/badge/Crittografia-RSA%20%2B%20AES%20%2B%20HMAC-DC382D?style=for-the-badge&logo=letsencrypt&logoColor=white" alt="Encryption">
</p>

<h1 align="center">ExArt26-IOTA</h1>

<p align="center">
  <b>Gestione decentralizzata delle liste d'attesa per la riabilitazione sanitaria (Ex Art. 26)</b><br>
  <i>Trasparenza, immutabilita e sicurezza attraverso la blockchain IOTA 2.0 Rebased e il permaweb Arweave</i>
</p>

<p align="center">
  <a href="#-panoramica">Panoramica</a> &bull;
  <a href="#-architettura">Architettura</a> &bull;
  <a href="#-stack-tecnologico">Stack</a> &bull;
  <a href="#-modello-dati">Modello Dati</a> &bull;
  <a href="#-sicurezza-e-crittografia">Sicurezza</a> &bull;
  <a href="#-funzionalita">Funzionalita</a> &bull;
  <a href="#-installazione">Installazione</a> &bull;
  <a href="#-api-endpoints">API</a>
</p>

---

## Panoramica

**ExArt26-IOTA** affronta un problema concreto della sanita italiana: la gestione delle liste d'attesa per i percorsi di riabilitazione previsti dall'**Art. 26 della Legge 833/1978**.

Attualmente, queste liste vengono spesso gestite con fogli di calcolo, documenti cartacei o software centralizzati, esponendole a rischi di:

- **Manipolazione** dei dati e dell'ordine di inserimento
- **Mancanza di trasparenza** verso i cittadini in attesa
- **Perdita di dati** in caso di guasti o errori umani
- **Assenza di auditabilita** sulle modifiche effettuate

Questa applicazione risolve questi problemi registrando ogni operazione sulla **blockchain IOTA 2.0 Rebased** (ledger distribuito e immutabile) e mantenendo un **backup permanente su Arweave** (permaweb). I dati sensibili degli assistiti sono protetti da un sistema di **crittografia ibrida a triplo livello** (RSA-2048 + AES-256-CBC + HMAC-SHA256).

Il frontend e una **Single Page Application** moderna costruita con React, Vite e TailwindCSS, con design futuristico dark mode, glassmorphism e neon gradients, ottimizzata come **PWA** per l'uso su dispositivi mobili.

---

## Architettura

Il sistema e progettato su un'architettura a tre livelli, con un frontend SPA separato che comunica con il backend via REST API e WebSocket:

```
                        +---------------------------+
                        |    React SPA (Vite)       |
                        |   TailwindCSS + Framer    |
                        |   Motion + PWA Ready      |
                        |   (porta 5173 in dev)     |
                        +------------+--------------+
                                     |
                                     | REST API / WebSocket
                                     v
                        +---------------------------+
                        |     Sails.js v1.5.0       |
                        |   (porta 1337)            |
                        |  +---------+-----------+  |
                        |  | REST API | Actions   |  |
                        |  +---------+-----------+  |
                        |  | ListManager.js       |  |
                        |  | CryptHelper.js       |  |
                        |  | ArweaveHelper.js     |  |
                        |  +-----+-------+-------+  |
                        +--------+-------+----------+
                                 |       |
                    +------------+       +-------------+
                    |                                   |
                    v                                   v
        +-----------------------+          +-----------------------+
        |   MySQL / sails-disk  |          |  IOTA 2.0 Rebased     |
        |   + BlockchainData    |          |  (Ed25519 keypair +   |
        |   (cache locale)      |          |   Programmable TX)    |
        +-----------------------+          +-----------+-----------+
                                                       |
                                               backup automatico
                                                       |
                                                       v
                                           +-----------------------+
                                           |   Arweave Permaweb    |
                                           | (backup permanente)   |
                                           +-----------------------+
```

### Flusso di una operazione tipica

1. L'utente interagisce con il frontend React (SPA)
2. Il frontend invia una richiesta REST al backend Sails.js
3. Il backend valida i dati e genera le chiavi crittografiche necessarie
4. I dati vengono cifrati con il sistema ibrido RSA+AES+HMAC
5. Il payload cifrato viene pubblicato su IOTA 2.0 tramite Programmable Transaction Blocks
6. Il risultato viene salvato nella cache locale `BlockchainData`
7. Una copia viene simultaneamente caricata su Arweave come backup permanente
8. Il database locale viene aggiornato come cache per accesso rapido
9. Il client riceve feedback in tempo reale via WebSocket durante l'intera operazione

---

## Stack Tecnologico

| Componente | Tecnologia | Versione | Ruolo |
|:-----------|:-----------|:---------|:------|
| **Frontend** | React | 19 | SPA con design futuristico dark mode |
| **Build Tool** | Vite | 6 | Dev server con HMR e build ottimizzata |
| **Styling** | TailwindCSS | 4 | Utility-first CSS (glassmorphism, neon gradients) |
| **Animazioni** | Framer Motion | 12 | Transizioni e animazioni fluide |
| **Icone** | Lucide React | 0.400+ | Set di icone moderne |
| **Routing** | React Router DOM | 7 | Navigazione SPA |
| **Backend** | Sails.js | 1.5.0 | Framework MVC, REST API, WebSocket |
| **Runtime** | Node.js | >= 17 | Ambiente di esecuzione (consigliato v20+) |
| **Blockchain** | @iota/iota-sdk | 1.10+ | IOTA 2.0 Rebased (Ed25519, Programmable TX) |
| **Permaweb** | Arweave | 1.15.5 | Backup permanente e immutabile |
| **Database** | MySQL / sails-disk | 3.0.1 | Cache locale per accesso rapido |
| **Real-time** | Socket.io (sails-hook-sockets) | 2.0.0 | Feedback live operazioni blockchain |
| **API Docs** | Swagger UI | 5.17.2 | Documentazione interattiva OpenAPI |
| **Rate Limiting** | express-rate-limit | 7.1.0 | Protezione contro abusi |
| **Crittografia** | Node.js crypto (built-in) | - | RSA-2048, AES-256-CBC, HMAC-SHA256 |
| **Task Runner** | Grunt | 1.6.1 | Build e pipeline asset (con fix Node.js >= 20) |

---

## Modello Dati

La gerarchia dei dati riflette l'organizzazione reale del sistema sanitario riabilitativo:

```
Organizzazione (ASL, Ente)
 |
 +-- ha molte --> Struttura (Centro di riabilitazione)
                   |
                   +-- ha molte --> Lista (Lista d'attesa specifica)
                                     |
                                     +-- M:N --> Assistito (Paziente)
                                          (via AssistitiListe)
```

### Dettaglio dei modelli

| Modello | Descrizione | Relazioni | Campi chiave |
|:--------|:------------|:----------|:-------------|
| **Organizzazione** | Ente sanitario (ASL, cooperativa) | 1:N con Struttura | nome, publicKey, privateKey |
| **Struttura** | Centro di riabilitazione fisico | N:1 con Organizzazione, 1:N con Lista | nome, indirizzo, organizzazione |
| **Lista** | Lista d'attesa per un servizio | N:1 con Struttura, M:N con Assistito | nome, descrizione, struttura |
| **Assistito** | Paziente in attesa di servizio | M:N con Lista (via AssistitiListe) | nome, cognome, codiceFiscale, publicKey, privateKey |
| **AssistitiListe** | Tabella di giunzione | N:1 con Assistito, N:1 con Lista | stato, dataInserimento, dataRimozione |
| **BlockchainData** | Cache locale transazioni blockchain | - | digest, tag, entityId, version, payload, timestamp |

### Stati dell'assistito in lista (`StatoLista`)

| Codice | Stato | Descrizione |
|:------:|:------|:------------|
| 1 | `INSERITO_IN_CODA` | Paziente in attesa nella lista |
| 2 | `RIMOSSO_IN_ASSISTENZA` | Preso in carico, riabilitazione avviata |
| 3 | `RIMOSSO_COMPLETATO` | Percorso riabilitativo concluso |
| 4 | `RIMOSSO_CAMBIO_LISTA` | Trasferito a un'altra lista |
| 5 | `RIMOSSO_RINUNCIA` | Rinuncia volontaria del paziente |
| 6 | `RIMOSSO_ANNULLATO` | Rimozione per annullamento amministrativo |

---

## Sicurezza e Crittografia

Il sistema implementa un meccanismo di **crittografia ibrida a triplo livello** per garantire riservatezza, autenticita e integrita dei dati sanitari.

### Schema crittografico

```
  Dati in chiaro (JSON)
        |
        v
  +---------------------+
  | AES-256-CBC         |  <-- Chiave simmetrica generata casualmente per ogni transazione
  | (cifratura dati)    |
  +-----+---------------+
        |
        v
  Dati cifrati (ciphertext)
        +
  +---------------------+
  | RSA-2048            |  <-- La chiave AES viene cifrata con la chiave pubblica
  | (cifratura chiave)  |      del destinatario
  +-----+---------------+
        |
        v
  Chiave AES cifrata (encryptedKey)
        +
  +---------------------+
  | HMAC-SHA256         |  <-- Firma di integrita calcolata sul ciphertext
  | (integrita)         |
  +-----+---------------+
        |
        v
  Payload completo --> Blockchain IOTA 2.0 + Arweave
```

### Gestione delle chiavi

| Aspetto | Implementazione |
|:--------|:----------------|
| **Generazione** | Ogni entita (Organizzazione, Struttura, Assistito) riceve una coppia di chiavi RSA-2048 al momento della creazione |
| **Chiave MAIN** | Esiste una coppia di chiavi master (`MAIN_PUBLIC_KEY` / `MAIN_PRIVATE_KEY`) usata per cifrare le chiavi private delle entita |
| **Archiviazione privata** | Le chiavi private delle entita vengono cifrate con la chiave pubblica MAIN prima di essere salvate sulla blockchain |
| **Protezione API** | Le chiavi private non vengono mai esposte nelle risposte JSON grazie a `customToJSON()` nei modelli |
| **Wallet IOTA 2.0** | Singolo keypair Ed25519 derivato da mnemonic BIP39 (nessun vault Stronghold) |

### Misure di sicurezza aggiuntive

- **Rate Limiting**: `express-rate-limit` limita a 100 richieste per 15 minuti per IP sulle rotte `/api/`
- **CSRF Protection**: token CSRF disponibile via `/csrfToken` per le richieste mutative
- **Nessuna autenticazione**: l'applicazione e attualmente in modalita aperta (tutte le rotte pubbliche)
- **Policy**: le rotte admin (`fetch-db-from-blockchain`, `recover-from-arweave`) richiedono wallet inizializzato

---

## Funzionalita

### Gestione liste d'attesa
- Creazione e gestione di **organizzazioni**, **strutture**, **liste** e **assistiti**
- Inserimento e rimozione assistiti dalle liste con tracciamento dello **stato** e dei **timestamp**
- Relazioni many-to-many: un assistito puo essere in piu liste contemporaneamente

### Blockchain e immutabilita
- Ogni operazione viene registrata come **Programmable Transaction Block** sulla rete IOTA 2.0 Rebased
- I dati sono classificati per tipo (`TransactionDataType`): dati principali, organizzazioni, strutture, liste, assistiti, chiavi private, movimenti
- Cache locale tramite modello `BlockchainData` per query rapide
- **Sincronizzazione bidirezionale**: il database locale puo essere ricostruito interamente dalla blockchain (`fetch-db-from-blockchain`)

### Backup permanente su Arweave
- **Backup automatico** di ogni transazione sul permaweb Arweave
- I dati su Arweave sono **permanenti e immutabili** per design del protocollo
- **Recovery da Arweave**: in caso di perdita dei dati IOTA, e possibile recuperare tutto dal backup Arweave (`recover-from-arweave`)

### Frontend moderno
- **Single Page Application** con React 19 e React Router 7
- Design futuristico **dark mode** con glassmorphism e neon gradients
- Animazioni fluide con **Framer Motion**
- Pagine: Dashboard, Organizzazioni, Strutture, Assistiti, Wallet
- **PWA ready** per supporto mobile
- **Feedback WebSocket** durante le operazioni blockchain (progresso, conferme, errori)

### Documentazione API
- **Swagger UI** integrata e accessibile a `/docs`
- Schema OpenAPI auto-generato disponibile a `/swagger.json`

### Gestione wallet
- Pagina dedicata nel frontend per stato e informazioni wallet
- Keypair Ed25519 singolo derivato da mnemonic BIP39
- Mnemonic generato automaticamente al primo avvio e salvato nella configurazione
- Richiesta automatica fondi dal **faucet testnet/devnet**

---

## Guida all'Installazione e Avvio

### Prerequisiti

| Requisito | Versione | Note |
|:----------|:---------|:-----|
| **Node.js** | >= 17 | Consigliato v20 LTS o v22 |
| **npm** | >= 8 | Incluso con Node.js |
| **MySQL** | >= 5.7 | Solo per produzione (in sviluppo usa sails-disk) |

### 1. Clonare il repository

```bash
git clone https://github.com/deduzzo/exart-26-iota.git
cd exart-26-iota
```

### 2. Installare le dipendenze backend

```bash
npm install
```

### 3. Installare le dipendenze frontend

```bash
cd frontend
npm install
cd ..
```

### 4. Configurare IOTA 2.0 Rebased (obbligatorio)

Questa configurazione e **necessaria** per avviare l'applicazione.

```bash
cp config/sample_private_iota_conf.js config/private_iota_conf.js
```

Editare `config/private_iota_conf.js` con i propri parametri:

```javascript
module.exports = {
  // Rete: 'testnet' | 'mainnet' | 'devnet'
  IOTA_NETWORK: 'testnet',

  // URL nodo custom (null = usa il default della rete selezionata)
  IOTA_NODE_URL: null,

  // Mnemonic BIP39 per il keypair Ed25519
  // Viene generato automaticamente al primo avvio se null
  IOTA_MNEMONIC: null,

  // Chiavi RSA-2048 per crittografia dei dati
  MAIN_PRIVATE_KEY: 'YOUR_RSA_PRIVATE_KEY',
  MAIN_PUBLIC_KEY: 'YOUR_RSA_PUBLIC_KEY',

  // Explorer URL
  IOTA_EXPLORER_URL: 'https://explorer.rebased.iota.org',
};
```

#### Generare le chiavi RSA

Le chiavi RSA master sono fondamentali: vengono usate per cifrare/decifrare tutte le chiavi private delle entita. Per generarle:

```bash
node -e "require('./api/utility/CryptHelper').RSAGenerateKeyPair().then(k => console.log(JSON.stringify(k, null, 2)))"
```

Copiare i valori `privateKey` e `publicKey` nei campi `MAIN_PRIVATE_KEY` e `MAIN_PUBLIC_KEY`.

> **Importante**: conservare la chiave privata master in un luogo sicuro. Senza di essa non sara possibile decifrare i dati sulla blockchain.

#### Mnemonic e Wallet

Il mnemonic BIP39 viene **generato automaticamente** al primo avvio se `IOTA_MNEMONIC` e impostato a `null`. Il sistema:

1. Genera un nuovo mnemonic BIP39
2. Deriva un keypair Ed25519 dal mnemonic
3. Salva automaticamente il mnemonic nel file di configurazione
4. Se la rete e testnet/devnet, richiede fondi dal **faucet** automaticamente

> **Nota**: e possibile impostare un mnemonic esistente prima del primo avvio per utilizzare un wallet gia esistente.

#### Reti disponibili

| Rete | IOTA_NETWORK | Note |
|:-----|:-------------|:-----|
| IOTA 2.0 Testnet | `testnet` | Faucet disponibile, consigliato per sviluppo |
| IOTA 2.0 Devnet | `devnet` | Faucet disponibile |
| IOTA 2.0 Mainnet | `mainnet` | Produzione |

#### Richiedere fondi dal faucet (testnet/devnet)

I fondi vengono richiesti automaticamente al primo avvio del wallet. Per richiedere fondi aggiuntivi, utilizzare la pagina Wallet nel frontend oppure l'API:

```bash
curl http://localhost:1337/api/v1/wallet/get-info
```

### 5. Configurare Arweave - Backup Permanente (opzionale)

Arweave fornisce un layer di backup permanente e immutabile. Se configurato, ogni transazione IOTA viene automaticamente duplicata su Arweave. Se non configurato, il sistema funziona normalmente solo con IOTA.

```bash
cp config/sample_private_arweave_conf.js config/private_arweave_conf.js
```

Editare `config/private_arweave_conf.js`:

```javascript
module.exports = {
  // Host del gateway Arweave
  ARWEAVE_HOST: 'arweave.net',
  ARWEAVE_PORT: 443,
  ARWEAVE_PROTOCOL: 'https',

  // Wallet JWK - copiare qui il contenuto del file JSON scaricato
  ARWEAVE_WALLET_JWK: {
    "kty": "RSA",
    "n": "...",
    "e": "...",
    // ... contenuto completo del file JWK
  },
};
```

#### Come ottenere un wallet Arweave

1. Andare su [arweave.app](https://arweave.app/wallet)
2. Creare un nuovo wallet
3. Scaricare il file JSON (JWK) - questo e il wallet
4. Copiare l'**intero contenuto** del file JSON nel campo `ARWEAVE_WALLET_JWK`
5. Finanziare il wallet con AR token (per testnet: [faucet.arweave.net](https://faucet.arweave.net/))

#### Come funziona il backup Arweave

```
Operazione utente
      |
      v
  Scrivi su IOTA 2.0 (primario, bloccante)
      |
      +---> Backup su Arweave (non-bloccante, in parallelo)
      |
      v
  Risposta all'utente
```

- Il backup e **non-bloccante**: se Arweave fallisce, l'operazione IOTA non viene interrotta
- I dati su Arweave sono **permanenti**: una volta scritti, non possono essere cancellati
- I dati sono **cifrati**: stesso payload crittografico usato per IOTA
- I tag GraphQL permettono di cercare e recuperare i dati per tipo ed entita

#### Recovery da Arweave

In caso di perdita dei dati IOTA, e possibile recuperare tutto dal backup Arweave:

```bash
curl -X POST http://localhost:1337/api/v1/recover-from-arweave
```

### 6. Configurare il database (produzione)

Editare `config/datastores.js` con i parametri MySQL:

```javascript
default: {
  adapter: 'sails-mysql',
  url: 'mysql://user:password@host:3306/exart26',
}
```

> In sviluppo, il sistema usa `sails-disk` (database su file, nessuna configurazione necessaria).

### 7. Avviare l'applicazione

#### Sviluppo (due terminali)

**Terminale 1 - Backend Sails.js:**
```bash
node app.js
```
Il backend sara disponibile su **http://localhost:1337**.

**Terminale 2 - Frontend React:**
```bash
cd frontend
npm run dev
```
Il frontend sara disponibile su **http://localhost:5173** con proxy automatico verso il backend.

#### Produzione

```bash
# Build del frontend
cd frontend
npm run build
cd ..

# Avvio del backend (serve anche il frontend compilato)
NODE_ENV=production node app.js
```

In produzione il frontend compilato viene servito da Sails.js tramite la rotta catch-all `GET /app/*`.

#### Primo avvio

Al primo avvio, il sistema:
1. Inizializza il database locale (sails-disk o MySQL)
2. Verifica la connessione al nodo IOTA 2.0
3. Se il mnemonic non e presente, genera un nuovo keypair Ed25519 e richiede fondi dal faucet
4. Se il wallet e inizializzato, sincronizza il DB dalla blockchain
5. Se Arweave e configurato, verifica la connessione al gateway
6. Genera la documentazione Swagger su `/docs`

### Risoluzione problemi

| Problema | Soluzione |
|:---------|:----------|
| `Cannot find module '../../config/private_iota_conf'` | Copiare il sample: `cp config/sample_private_iota_conf.js config/private_iota_conf.js` |
| `ERR_REQUIRE_ESM` con @iota/iota-sdk | Normale: l'SDK usa ESM, il sistema lo gestisce con `dynamic import()`. Verificare che `iota.js` usi `loadSdk()` |
| Errore Grunt `Cannot convert a Symbol value to a string` | Warning non bloccante con Node.js >= 20, task Grunt personalizzati risolvono il problema |
| `migrate: 'safe'` al bootstrap | Normale in produzione. In sviluppo, cancellare `.tmp/bootstrap-version.json` per forzare il re-seed |
| Arweave non funziona | Verificare che il wallet JWK sia completo e che abbia fondi sufficienti |
| Frontend non si connette al backend | Verificare che Sails.js sia in esecuzione sulla porta 1337 e che il proxy Vite sia configurato |

---

## Struttura Progetto

```
exart26-iota/
|
+-- frontend/                     # Frontend React SPA
|   +-- src/
|   |   +-- pages/                # Pagine: Dashboard, Organizzazioni, Strutture, Assistiti, Wallet
|   |   +-- components/           # Componenti riutilizzabili
|   |   +-- hooks/                # Custom React hooks
|   |   +-- api/                  # Client API per comunicazione con backend
|   |   +-- utils/                # Utility frontend
|   |   +-- App.jsx               # Router e layout principale
|   |   +-- main.jsx              # Entry point React
|   |   +-- index.css             # Stili globali TailwindCSS
|   +-- public/                   # Asset statici
|   +-- vite.config.js            # Configurazione Vite (proxy, build)
|   +-- package.json              # Dipendenze frontend
|
+-- api/
|   +-- controllers/              # Action-based controllers (Sails.js actions2)
|   |   +-- dashboard/            # Dashboard
|   |   +-- wallet/               # Verifica e info wallet
|   |   +-- add-organizzazione.js
|   |   +-- add-struttura.js
|   |   +-- add-lista.js
|   |   +-- add-assistito.js
|   |   +-- add-assistito-in-lista.js
|   |   +-- fetch-db-from-blockchain.js
|   |   +-- recover-from-arweave.js
|   |   +-- api-dashboard.js      # GET /api/v1/dashboard (JSON)
|   |   +-- api-organizzazioni.js # GET /api/v1/organizzazioni (JSON)
|   |   +-- api-strutture.js      # GET /api/v1/strutture (JSON)
|   |   +-- api-assistiti.js      # GET /api/v1/assistiti (JSON)
|   |   +-- view-*.js             # Controller delle viste (legacy)
|   |
|   +-- enums/                    # Enumerazioni
|   |   +-- StatoLista.js         # Stati dell'assistito in lista (6 stati)
|   |   +-- TransactionDataType.js  # Tipi di payload blockchain (8 tipi)
|   |
|   +-- models/                   # Modelli Waterline ORM
|   |   +-- Organizzazione.js
|   |   +-- Struttura.js
|   |   +-- Lista.js
|   |   +-- Assistito.js
|   |   +-- AssistitiListe.js     # Tabella di giunzione M:N
|   |   +-- BlockchainData.js     # Cache locale transazioni blockchain
|   |   +-- View.js
|   |
|   +-- utility/                  # Componenti core del sistema
|   |   +-- iota.js               # IOTA 2.0: keypair Ed25519, publishData, query dati
|   |   +-- ListManager.js        # Logica business, sync DB <-> blockchain
|   |   +-- CryptHelper.js        # Crittografia ibrida RSA+AES+HMAC
|   |   +-- ArweaveHelper.js      # Backup e recovery da Arweave permaweb
|   |
|   +-- helpers/                  # Sails.js helpers riutilizzabili
|   +-- hooks/                    # Hook personalizzati
|   +-- policies/                 # Middleware (is-wallet-initialized)
|   +-- responses/                # Risposte HTTP personalizzate
|
+-- config/
|   +-- routes.js                 # Definizione di tutte le rotte (REST + SPA catch-all)
|   +-- security.js               # CSRF, CORS
|   +-- datastores.js             # Connessione database
|   +-- custom.js                 # Parametri personalizzati (URL, email, token)
|   +-- bootstrap.js              # Inizializzazione all'avvio (carica dati da blockchain)
|   +-- policies.js               # Mapping policy -> rotte (tutte pubbliche)
|   +-- sample_private_iota_conf.js     # Template configurazione IOTA 2.0
|   +-- sample_private_arweave_conf.js  # Template configurazione Arweave
|
+-- views/                        # Template EJS (legacy)
+-- assets/                       # File statici backend
+-- swagger/                      # Schema OpenAPI generato
+-- tasks/                        # Task Grunt personalizzati (fix Node.js >= 20)
+-- scripts/                      # Script di utilita
```

---

## API Endpoints

### API JSON (per frontend React)

| Metodo | Rotta | Descrizione |
|:-------|:------|:------------|
| `GET` | `/api/v1/dashboard` | Statistiche per la dashboard |
| `GET` | `/api/v1/organizzazioni/:id?` | Lista organizzazioni (dettaglio se `:id`) |
| `GET` | `/api/v1/strutture?organizzazione=X` | Lista strutture filtrate per organizzazione |
| `GET` | `/api/v1/assistiti/:id?` | Lista assistiti (dettaglio se `:id`) |

### API Operative (blockchain)

| Metodo | Rotta | Descrizione |
|:-------|:------|:------------|
| `POST` | `/api/v1/add-organizzazione` | Crea nuova organizzazione (genera chiavi RSA, scrive su blockchain) |
| `POST` | `/api/v1/add-struttura` | Crea nuova struttura |
| `POST` | `/api/v1/add-lista` | Crea nuova lista d'attesa |
| `POST` | `/api/v1/add-assistito` | Registra nuovo assistito (genera chiavi RSA) |
| `POST` | `/api/v1/add-assistito-in-lista` | Inserisce un assistito in una lista d'attesa |
| `POST` | `/api/v1/fetch-db-from-blockchain` | Ricostruisce il DB locale dalla blockchain (richiede wallet) |
| `POST` | `/api/v1/recover-from-arweave` | Recupera tutti i dati dal backup Arweave (richiede wallet) |
| `GET` | `/api/v1/wallet/get-info` | Restituisce informazioni sul wallet IOTA 2.0 |
| `GET` | `/api/v1/get-transaction` | Recupera una transazione specifica |

### Viste (legacy EJS)

| Rotta | Descrizione |
|:------|:------------|
| `GET /` | Homepage / redirect automatico |
| `GET /dashboard` | Dashboard (EJS) |
| `GET /organizzazioni/:id?` | Organizzazioni (EJS) |
| `GET /strutture/:idOrganizzazione?/:id?` | Strutture (EJS) |
| `GET /assistiti/:id?` | Assistiti (EJS) |
| `GET /wallet/verifica` | Pagina verifica stato wallet |

### Utilita

| Rotta | Descrizione |
|:------|:------------|
| `GET /swagger.json` | Schema OpenAPI in formato JSON |
| `GET /docs` | Documentazione Swagger UI interattiva |
| `GET /csrfToken` | Ottieni token CSRF per le richieste |
| `POST /api/v1/observe-my-session` | Sottoscrizione WebSocket per sessione corrente |
| `GET /app/*` | SPA catch-all: serve il frontend React compilato |

---

## Roadmap

- [ ] Implementazione completa della gestione movimenti tra liste
- [ ] Dashboard analitica avanzata con grafici temporali
- [ ] Esportazione dati in formato PDF e CSV
- [ ] Notifiche push per aggiornamenti di stato
- [ ] Supporto multi-lingua (i18n)
- [ ] Test automatizzati end-to-end
- [ ] Containerizzazione con Docker
- [ ] Supporto IOTA 2.0 mainnet in produzione
- [ ] Interfaccia pubblica per consultazione posizione in lista (anonimizzata)
- [ ] Integrazione con sistemi informativi sanitari regionali
- [ ] Autenticazione e autorizzazione utenti

---

## Licenza

Questo progetto e distribuito con finalita di ricerca e sviluppo.
Per informazioni sulla licenza, contattare l'autore.

---

## Autore

Sviluppato da [**deduzzo**](https://github.com/deduzzo)

---

<p align="center">
  <i>ExArt26-IOTA &mdash; Trasparenza e immutabilita per le liste d'attesa sanitarie</i>
</p>
