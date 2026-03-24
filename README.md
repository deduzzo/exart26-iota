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
  <i>Dati business interamente on-chain su IOTA 2.0 Rebased, con backup permanente su Arweave</i>
</p>

<p align="center">
  <a href="#-panoramica">Panoramica</a> &bull;
  <a href="#-architettura">Architettura</a> &bull;
  <a href="#-codifica-dati-on-chain">Codifica On-Chain</a> &bull;
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

Questa applicazione risolve questi problemi registrando **tutti i dati business interamente sulla blockchain IOTA 2.0 Rebased**. Non esiste un database locale per i dati operativi: il DB locale (sails-disk) funge esclusivamente da **cache** ricostruibile in qualsiasi momento dalla chain. Un **backup permanente su Arweave** (permaweb) garantisce un ulteriore livello di resilienza. I dati sensibili degli assistiti sono protetti da un sistema di **crittografia ibrida a triplo livello** (RSA-2048 + AES-256-CBC + HMAC-SHA256).

Il frontend e una **Single Page Application** moderna costruita con React, Vite e TailwindCSS, con design futuristico dark mode, glassmorphism e neon gradients, ottimizzata come **PWA** per l'uso su dispositivi mobili.

---

## Architettura

Il sistema e progettato su un'architettura dove la **blockchain IOTA 2.0 e la fonte di verita unica** (source of truth). Il database locale e una cache riscrivibile. I controller CRUD rispondono immediatamente al client dopo il salvataggio in cache; la pubblicazione sulla blockchain avviene in background (`setImmediate`), senza bloccare l'utente. Il modulo **SyncCache** garantisce un avvio istantaneo del server caricando i dati dalla cache locale su file (`.tmp/sync-cache.json`), con sincronizzazione blockchain in background.

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
                        |  | SyncCache.js         |  |
                        |  +-----+-------+-------+  |
                        +--------+-------+----------+
                                 |       |
                    +------------+       +-------------+
                    |                                   |
                    v                                   v
        +-----------------------+          +----------------------------+
        |  sails-disk (cache)   |          |   IOTA 2.0 Rebased         |
        |  Solo cache locale,   |          |   SOURCE OF TRUTH          |
        |  ricostruibile dalla  |          |   Ed25519 + Programmable   |
        |  blockchain           |          |   TX Blocks (u64 encoding) |
        +-----------------------+          +------------+---------------+
                                                        |
                                                backup automatico
                                                        |
                                                        v
                                            +-----------------------+
                                            |   Arweave Permaweb    |
                                            | (backup permanente)   |
                                            +-----------------------+
```

### Flusso di una operazione tipica (non-bloccante)

1. L'utente interagisce con il frontend React (SPA)
2. Il frontend invia una richiesta REST al backend Sails.js
3. Il backend valida i dati, genera le chiavi crittografiche, salva nella cache locale
4. **Il controller risponde immediatamente al client** (HTTP 200)
5. La **SyncCache** viene aggiornata (debounced 5 secondi)
6. In background (`setImmediate`):
   - I dati vengono cifrati con il sistema ibrido RSA+AES+HMAC
   - Il payload cifrato viene codificato come u64 split-coin amounts e pubblicato su IOTA 2.0
   - L'indice MAIN_DATA viene aggiornato sulla blockchain
   - Una copia viene caricata su Arweave come backup permanente
7. Il client riceve feedback in tempo reale via WebSocket durante le operazioni blockchain

### Flusso di avvio (Bootstrap con SyncCache)

1. **Step 1**: Carica cache locale da `.tmp/sync-cache.json` (istantaneo)
2. **Step 2**: Il server lifta immediatamente con i dati dalla cache
3. **Step 3**: Sync blockchain in background (non bloccante) - il frontend mostra un **banner animato** con barra di progresso
4. **Step 4**: Salva cache aggiornata su disco

---

## Codifica Dati On-Chain

Il sistema archivia i dati **interamente sulla blockchain IOTA 2.0**, senza bisogno di storage esterno. La tecnica sfrutta i **Programmable Transaction Blocks**: il payload JSON viene suddiviso in chunk da 7 byte, ciascuno codificato come amount `u64` di una operazione `splitCoins`.

### Schema della transazione

```
Programmable Transaction Block:
  splitCoins(gas, [amount0, amount1, amount2, ..., amountN])
  transferObjects([coin0, coin1, ..., coinN], selfAddress)

  amount[0] = 1                              <- Marker "exart26"
  amount[1] = payloadLength (in bytes)       <- Lunghezza totale del JSON
  amount[2] = chunk0  (1 byte index + 7 bytes dati)
  amount[3] = chunk1  (1 byte index + 7 bytes dati)
  ...
  amount[N] = chunkN-2
```

### Codifica (`_encodePayloadToChunks`)

1. Il payload JSON viene convertito in `Buffer`
2. Il buffer viene diviso in blocchi da 7 byte
3. Ogni blocco viene prefissato con 1 byte di indice (posizione del chunk)
4. Il risultato (8 byte) viene interpretato come `BigInt` u64
5. Le coin risultanti vengono trasferite a se stessi (nessuna perdita di fondi)

### Decodifica (`_decodeChunksToPayload`)

1. Si leggono gli input `u64` dalla transazione (`queryTransactionBlocks`)
2. Si verifica il marker: il primo u64 deve essere `1`
3. Il secondo u64 indica la lunghezza del payload
4. I restanti u64 vengono convertiti in buffer da 8 byte, ordinati per indice (byte 0), concatenati i byte 1-7
5. Il buffer viene troncato a `payloadLength` e parsato come JSON

### MAIN_DATA come indice leggero

Per evitare problemi di scalabilita, il sistema usa una strategia a indice:

- **MAIN_DATA** contiene solo un indice leggero: la lista di `entityId` per tipo (~50 byte per entita) con il digest dell'ultima transazione
- Ogni entita ha la propria **transazione dedicata** (`ORGANIZZAZIONE_DATA`, `STRUTTURE_LISTE_DATA`, `ASSISTITI_DATA`, `PRIVATE_KEY`)
- MAIN_DATA serve come **start-point certificato** per il recovery: al bootstrap si legge l'indice, poi si recupera ogni entita dalla sua transazione

### Lettura dalla blockchain

La funzione `_queryTransactionsFromChain` interroga il nodo IOTA con `queryTransactionBlocks` filtrando per `FromAddress` (l'indirizzo del wallet), decodifica ogni transazione e filtra per tag/entityId. Non serve alcun database locale per la lettura.

---

## Stack Tecnologico

| Componente | Tecnologia | Versione | Ruolo |
|:-----------|:-----------|:---------|:------|
| **Frontend** | React | 19 | SPA con design futuristico dark mode |
| **Build Tool** | Vite | 6 | Dev server con HMR e build ottimizzata |
| **Styling** | TailwindCSS | 4 | Utility-first CSS (glassmorphism, neon gradients) |
| **Animazioni** | Framer Motion | 12 | Transizioni e animazioni fluide |
| **Grafo** | react-force-graph-2d | - | Visualizzazione interattiva force-directed |
| **Icone** | Lucide React | 0.400+ | Set di icone moderne |
| **Routing** | React Router DOM | 7 | Navigazione SPA |
| **Backend** | Sails.js | 1.5.0 | Framework MVC, REST API, WebSocket |
| **Runtime** | Node.js | >= 17 | Ambiente di esecuzione (consigliato v20+) |
| **Blockchain** | @iota/iota-sdk | 1.10+ | IOTA 2.0 Rebased (Ed25519, Programmable TX) |
| **Permaweb** | Arweave | 1.15.5 | Backup permanente e immutabile |
| **Cache locale** | sails-disk | 3.0.1 | Cache ricostruibile (source of truth = blockchain) |
| **SyncCache** | File JSON (.tmp/sync-cache.json) | - | Cache persistente per avvio istantaneo del server |
| **Real-time** | Socket.io (sails-hook-sockets) | 2.0.0 | Feedback live operazioni blockchain |
| **API Docs** | Swagger UI | 5.17.2 | Documentazione interattiva OpenAPI |
| **Rate Limiting** | express-rate-limit | 7.1.0 | Disponibile ma disabilitato per compatibilita SPA |
| **Crittografia** | Node.js crypto (built-in) | - | RSA-2048 OAEP SHA-256, AES-256-CBC, HMAC-SHA256 |
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

### Dove vivono i dati

| Modello | Cache locale (sails-disk) | Blockchain IOTA 2.0 | Arweave (backup) |
|:--------|:------------------------:|:-------------------:|:----------------:|
| Organizzazione | Cache | ORGANIZZAZIONE_DATA | Backup |
| Struttura + Liste | Cache | STRUTTURE_LISTE_DATA | Backup |
| Assistito | Cache | ASSISTITI_DATA | Backup |
| Chiavi private | Cache | PRIVATE_KEY (cifrate RSA) | Backup |
| Indice entita | - | MAIN_DATA | Backup |

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
  | RSA-2048 OAEP       |  <-- La chiave AES viene cifrata con la chiave pubblica
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
  Payload completo --> u64 encoding --> Blockchain IOTA 2.0 + Arweave
```

### Gestione delle chiavi

| Aspetto | Implementazione |
|:--------|:----------------|
| **Generazione** | Ogni entita (Organizzazione, Struttura, Assistito) riceve una coppia di chiavi RSA-2048 al momento della creazione |
| **Chiave MAIN** | Esiste una coppia di chiavi master (`MAIN_PUBLIC_KEY` / `MAIN_PRIVATE_KEY`) usata per cifrare le chiavi private delle entita |
| **Archiviazione privata** | Le chiavi private delle entita vengono cifrate con la chiave pubblica MAIN e salvate on-chain come transazioni PRIVATE_KEY |
| **Protezione API** | Le chiavi private non vengono mai esposte nelle risposte JSON grazie a `customToJSON()` nei modelli |
| **Padding RSA** | OAEP con SHA-256 (aggiornato da PKCS1 per compatibilita Node.js 22) |
| **Wallet IOTA 2.0** | Singolo keypair Ed25519 derivato da mnemonic BIP39 (nessun vault Stronghold) |

### Misure di sicurezza aggiuntive

- **Rate Limiting**: disponibile via `express-rate-limit` ma attualmente disabilitato per compatibilita SPA
- **CSRF Protection**: token CSRF disponibile via `/csrfToken` per le richieste mutative
- **Nessuna autenticazione**: l'applicazione e attualmente in modalita aperta (tutte le rotte pubbliche)
- **Policy**: le rotte admin (`fetch-db-from-blockchain`, `recover-from-arweave`) richiedono wallet inizializzato

---

## Funzionalita

### Gestione liste d'attesa
- Creazione e gestione di **organizzazioni**, **strutture**, **liste** e **assistiti**
- Inserimento e rimozione assistiti dalle liste con tracciamento dello **stato** e dei **timestamp**
- **Pagina Liste dedicata** (`/app/liste`): layout a **2 colonne** con **filtro testuale**, cards per lista con statistiche (in coda, usciti, media attesa giorni), vista coda con posizioni, bottone "Chiama" per il primo in coda, toggle Coda/Storico
- **Rimozione assistiti**: selezione dello stato di uscita (in assistenza, completato, rinuncia, annullato)
- **Statistiche liste**: API strutture arricchita con stats per lista (inCoda, usciti, totale, tempoMedioGiorni)
- **Assistiti con liste**: la tabella assistiti mostra le liste assegnate con posizione in coda (#1, #2...)
- Relazioni many-to-many: un assistito puo essere in piu liste contemporaneamente

### Dati interamente on-chain
- **Zero database locale per i dati business**: tutto e archiviato sulla blockchain IOTA 2.0 Rebased
- I dati vengono codificati come **u64 split-coin amounts** nei Programmable Transaction Blocks
- **MAIN_DATA come indice leggero**: contiene solo la lista di entityId per tipo, non l'intero dataset
- Ogni entita ha la propria **transazione dedicata** sulla chain
- Il DB locale (sails-disk) e una **cache ricostruibile** dalla blockchain in qualsiasi momento
- **Controller non-bloccanti**: tutti i CRUD (inclusi add-assistito-in-lista e rimuovi-assistito-da-lista) rispondono immediatamente al client, pubblicazione blockchain in background via `setImmediate`

### SyncCache - Avvio istantaneo
- **Cache locale persistente** su file `.tmp/sync-cache.json`
- Al bootstrap il server **lifta immediatamente** con i dati dalla cache, senza aspettare la blockchain
- La sincronizzazione blockchain avviene **in background** (non bloccante)
- Ogni operazione CRUD **aggiorna la cache** automaticamente (debounced 5 secondi)
- **`POST /api/v1/sync-reset`**: cancella la cache e riforza la sync da blockchain
- **`GET /api/v1/sync-status`**: stato sync in tempo reale (syncing, progress, contatori)
- **Banner sync nell'UI**: barra di progresso animata visibile su ogni pagina durante la sincronizzazione, con status, percentuale e contatori (org/str/ass). Polling ogni 2 secondi, scompare automaticamente al completamento

### Backup permanente su Arweave
- **Backup automatico** di ogni transazione sul permaweb Arweave
- I dati su Arweave sono **permanenti e immutabili** per design del protocollo
- **Recovery da Arweave**: in caso di perdita dei dati IOTA, e possibile recuperare tutto dal backup Arweave (`recover-from-arweave`)
- Il backup e **non-bloccante**: se Arweave fallisce, l'operazione IOTA non viene interrotta

### Consultazione Pubblica Anonimizzata
- **Pagina Pubblico** (`/app/pubblico`): frontend accessibile senza autenticazione per la verifica della posizione in lista
- Ogni assistito viene mostrato come **ID anonimo** (primi 8 caratteri dello SHA-256 del codice fiscale)
- L'utente inserisce il proprio codice fiscale, che viene **hashato lato client** (mai inviato al server)
- La posizione corrispondente viene **evidenziata** nella lista
- Toggle Coda/Storico per ogni lista
- **Zero dati personali esposti**: nessun nome, cognome o codice fiscale visibile
- API dedicata: `GET /api/v1/public/liste`

### Visualizzazione Grafo
- Pagina `/app/grafo` con **grafo interattivo force-directed** (react-force-graph-2d)
- Tutte le entita rappresentate come nodi con **codifica colore per tipo** (organizzazioni, strutture, liste, assistiti, **trattati**)
- **Nodi Trattati**: pazienti usciti dalla lista, aggregati per lista, visualizzati come nodi dedicati nel grafo
- **Pannello dettagli** al hover con chiavi, indirizzi e timestamp
- Controlli zoom e layout

### Load Test e Simulazione
- **Pagina Load Test** (`/app/load-test`): generazione dati di prova direttamente dall'UI con log in tempo reale delle operazioni eseguite
- **`npm run simulate`**: script CLI per simulazione continua infinita con crescita proporzionale, utile per stress test e demo

### Pagina Debug
- Pagina `/app/debug` per diagnostica e verifica del sistema
- Mostra stato **wallet** (indirizzo, balance, rete)
- Visualizza **transazioni blockchain** con decrypt del payload cifrato
- Mostra contenuto **DB locale** (cache)
- **Cross-references** con verifica di consistency tra DB e blockchain
- API dedicata: `GET /api/v1/debug`

### Gestione Wallet
- **WalletInitModal**: modale globale presente in ogni pagina, si attiva automaticamente se il wallet non e inizializzato
- Inizializzazione wallet via API `POST /api/v1/wallet/init` (genera mnemonic, mostra con copia, richiede fondi faucet)
- **Reset Wallet**: `POST /api/v1/wallet/reset` per distruggere e ricreare il wallet con doppia conferma UI
- Pagina dedicata per stato e informazioni wallet
- Keypair Ed25519 singolo derivato da mnemonic BIP39

### Frontend moderno
- **Single Page Application** con React 19 e React Router 7
- Design futuristico **dark mode** con glassmorphism e neon gradients
- Animazioni fluide con **Framer Motion**
- Pagine: Dashboard, Organizzazioni, Strutture, Assistiti, **Liste**, Wallet, Grafo, **Pubblico**, **Debug**, **Load Test**
- **PWA ready** per supporto mobile
- **Feedback WebSocket** durante le operazioni blockchain (progresso, conferme, errori)

### Documentazione API
- **Swagger UI** integrata e accessibile a `/docs`
- Schema OpenAPI auto-generato disponibile a `/swagger.json`

---

## Guida all'Installazione e Avvio

### Prerequisiti

| Requisito | Versione | Note |
|:----------|:---------|:-----|
| **Node.js** | >= 17 | Consigliato v20 LTS o v22 |
| **npm** | >= 8 | Incluso con Node.js |
| **MySQL** | >= 5.7 | Solo per produzione (in sviluppo usa sails-disk come cache) |

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
  // Viene generato automaticamente via WalletInitModal se null
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

#### Inizializzazione Wallet

Il wallet viene inizializzato tramite il **WalletInitModal**, un modale che appare automaticamente nel frontend su ogni pagina se il wallet non e ancora configurato:

1. L'utente clicca "Inizializza Wallet" nel modale
2. Il sistema chiama `POST /api/v1/wallet/init`
3. Viene generato un nuovo mnemonic BIP39 e derivato un keypair Ed25519
4. Il mnemonic viene salvato automaticamente nel file di configurazione
5. Il modale mostra il mnemonic con possibilita di copiarlo
6. Se la rete e testnet/devnet, i fondi vengono richiesti automaticamente dal **faucet**
7. L'utente clicca "Continua" per procedere

> **Nota**: e possibile impostare un mnemonic esistente in `config/private_iota_conf.js` prima del primo avvio per utilizzare un wallet gia esistente.

#### Reti disponibili

| Rete | IOTA_NETWORK | Note |
|:-----|:-------------|:-----|
| IOTA 2.0 Testnet | `testnet` | Faucet disponibile, consigliato per sviluppo |
| IOTA 2.0 Devnet | `devnet` | Faucet disponibile |
| IOTA 2.0 Mainnet | `mainnet` | Produzione |

#### Richiedere fondi dal faucet (testnet/devnet)

I fondi vengono richiesti automaticamente all'inizializzazione del wallet. Per richiedere fondi aggiuntivi, utilizzare la pagina Wallet nel frontend oppure l'API:

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

### 6. Avviare l'applicazione

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

**Simulazione dati (opzionale):**
```bash
npm run simulate
```
Avvia una simulazione continua infinita con crescita proporzionale (utile per test e demo).

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
1. Carica la **SyncCache** da `.tmp/sync-cache.json` (istantaneo, se presente)
2. **Il server lifta immediatamente** con i dati dalla cache
3. Verifica la connessione al nodo IOTA 2.0
4. Se il wallet non e inizializzato, il **WalletInitModal** apparira nel frontend
5. La sincronizzazione blockchain avviene **in background** (non bloccante) - il frontend mostra un banner animato con progresso
6. Se Arweave e configurato, verifica la connessione al gateway
7. Genera la documentazione Swagger su `/docs`

### Risoluzione problemi

| Problema | Soluzione |
|:---------|:----------|
| `Cannot find module '../../config/private_iota_conf'` | Copiare il sample: `cp config/sample_private_iota_conf.js config/private_iota_conf.js` |
| `ERR_REQUIRE_ESM` con @iota/iota-sdk | Normale: l'SDK usa ESM, il sistema lo gestisce con `dynamic import()`. Verificare che `iota.js` usi `loadSdk()` |
| Errore Grunt `Cannot convert a Symbol value to a string` | Warning non bloccante con Node.js >= 20, task Grunt personalizzati risolvono il problema |
| WalletInitModal non appare | Verificare che `config/private_iota_conf.js` esista. Il modale appare solo se il wallet non e inizializzato |
| Dati non sincronizzati | Usare `POST /api/v1/sync-reset` per cancellare la cache e riforzare la sync, oppure `POST /api/v1/fetch-db-from-blockchain` per ricostruire la cache dalla blockchain |
| Arweave non funziona | Verificare che il wallet JWK sia completo e che abbia fondi sufficienti |
| Frontend non si connette al backend | Verificare che Sails.js sia in esecuzione sulla porta 1337 e che il proxy Vite sia configurato |
| Transazione blockchain fallisce | Verificare il balance del wallet. Per testnet/devnet usare il faucet dalla pagina Wallet |

---

## Struttura Progetto

```
exart26-iota/
|
+-- frontend/                     # Frontend React SPA
|   +-- src/
|   |   +-- pages/                # Dashboard, Organizzazioni, Strutture, Assistiti, Liste, Wallet, Grafo, Pubblico, Debug, LoadTest
|   |   +-- components/           # Layout, WalletInitModal, LoadingSpinner, ...
|   |   +-- hooks/                # Custom React hooks (useApi, ...)
|   |   +-- api/                  # Client API per comunicazione con backend
|   |   +-- utils/                # Utility frontend (formatters, ...)
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
|   |   +-- wallet/               # get-info, init-wallet, reset-wallet, view-verifica
|   |   +-- add-organizzazione.js # Non-bloccante (setImmediate per blockchain)
|   |   +-- add-struttura.js      # Non-bloccante
|   |   +-- add-lista.js          # Non-bloccante
|   |   +-- add-assistito.js      # Non-bloccante
|   |   +-- add-assistito-in-lista.js  # Non-bloccante
|   |   +-- rimuovi-assistito-da-lista.js  # Non-bloccante, con selezione stato
|   |   +-- fetch-db-from-blockchain.js
|   |   +-- recover-from-arweave.js
|   |   +-- api-dashboard.js      # GET /api/v1/dashboard (JSON)
|   |   +-- api-organizzazioni.js # GET /api/v1/organizzazioni (JSON)
|   |   +-- api-strutture.js      # GET /api/v1/strutture con stats liste (JSON)
|   |   +-- api-assistiti.js      # GET /api/v1/assistiti con liste e posizione (JSON)
|   |   +-- api-liste-dettaglio.js # GET /api/v1/liste-dettaglio: coda + storico (JSON)
|   |   +-- api-graph-data.js     # GET /api/v1/graph-data (JSON)
|   |   +-- api-public.js         # GET /api/v1/public/liste (dati anonimizzati)
|   |   +-- api-debug.js          # GET /api/v1/debug (diagnostica)
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
|   |   +-- iota.js               # IOTA 2.0: u64 encoding, publishData, query on-chain
|   |   +-- ListManager.js        # Logica business, MAIN_DATA index, sync blockchain->cache
|   |   +-- CryptHelper.js        # Crittografia ibrida RSA+AES+HMAC
|   |   +-- ArweaveHelper.js      # Backup e recovery da Arweave permaweb
|   |   +-- SyncCache.js          # Cache locale persistente su file per avvio istantaneo
|   |
|   +-- helpers/                  # Sails.js helpers riutilizzabili
|   +-- hooks/                    # Hook personalizzati
|   +-- policies/                 # Middleware (is-wallet-initialized)
|   +-- responses/                # Risposte HTTP personalizzate
|
+-- config/
|   +-- routes.js                 # Definizione di tutte le rotte (REST + SPA catch-all)
|   +-- security.js               # CSRF, CORS
|   +-- datastores.js             # Connessione database (sails-disk come cache)
|   +-- custom.js                 # Parametri personalizzati (URL, email, token)
|   +-- bootstrap.js              # Carica SyncCache, lifta server, sync blockchain in background
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
| `GET` | `/api/v1/strutture?organizzazione=X` | Lista strutture filtrate per organizzazione, con stats per lista (inCoda, usciti, totale, tempoMedioGiorni) |
| `GET` | `/api/v1/assistiti/:id?` | Lista assistiti con liste assegnate e posizione in coda (dettaglio se `:id`) |
| `GET` | `/api/v1/liste-dettaglio?idLista=X` | Dettaglio lista: coda con posizione + storico movimenti |
| `GET` | `/api/v1/graph-data` | Dati per il grafo interattivo (tutte le entita con relazioni) |
| `GET` | `/api/v1/debug` | Dati debug: wallet, transazioni blockchain con decrypt, DB locale, cross-references |

### API Pubblica (zero autenticazione, dati anonimizzati)

| Metodo | Rotta | Descrizione |
|:-------|:------|:------------|
| `GET` | `/api/v1/public/liste` | Liste con assistiti anonimizzati (ID = primi 8 char SHA-256 del CF). Zero dati personali esposti |

### API Operative (blockchain)

| Metodo | Rotta | Descrizione |
|:-------|:------|:------------|
| `POST` | `/api/v1/add-organizzazione` | Crea organizzazione (risposta immediata, blockchain in background) |
| `POST` | `/api/v1/add-struttura` | Crea struttura (risposta immediata, blockchain in background) |
| `POST` | `/api/v1/add-lista` | Crea lista d'attesa (risposta immediata, blockchain in background) |
| `POST` | `/api/v1/add-assistito` | Registra assistito (risposta immediata, blockchain in background) |
| `POST` | `/api/v1/add-assistito-in-lista` | Inserisce un assistito in una lista d'attesa (risposta immediata, blockchain in background) |
| `POST` | `/api/v1/rimuovi-assistito-da-lista` | Rimuove assistito da lista. Body: `{ idAssistitoListe, stato }`. Stati: 2=in assistenza, 3=completato, 5=rinuncia, 6=annullato |
| `POST` | `/api/v1/fetch-db-from-blockchain` | Ricostruisce la cache locale dalla blockchain (richiede wallet) |
| `POST` | `/api/v1/recover-from-arweave` | Recupera tutti i dati dal backup Arweave (richiede wallet) |
| `POST` | `/api/v1/sync-reset` | Cancella la SyncCache e riforza la sincronizzazione da blockchain |
| `GET` | `/api/v1/sync-status` | Stato sync in tempo reale: syncing, progress percentuale, contatori entita |

### API Wallet

| Metodo | Rotta | Descrizione |
|:-------|:------|:------------|
| `POST` | `/api/v1/wallet/init` | Inizializza wallet: genera mnemonic, ritorna `{ success, mnemonic, address }` |
| `POST` | `/api/v1/wallet/reset` | Reset wallet: distrugge e ricrea il wallet (doppia conferma UI) |
| `GET` | `/api/v1/wallet/get-info` | Restituisce stato, balance, indirizzo e rete del wallet |
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

- [x] Implementazione completa della gestione movimenti tra liste (pagina Liste con coda, storico, rimozione con stato)
- [x] Interfaccia pubblica per consultazione posizione in lista (anonimizzata con hash SHA-256 del CF)
- [x] SyncCache per avvio istantaneo del server con sync blockchain in background
- [x] Banner sync animato nell'UI con barra di progresso e contatori
- [x] Pagina Load Test per generazione dati di prova dall'UI
- [x] Script CLI di simulazione continua (`npm run simulate`)
- [x] Pagina Liste a 2 colonne con filtro testuale
- [x] Nodi Trattati nel grafo (pazienti usciti aggregati per lista)
- [ ] Dashboard analitica avanzata con grafici temporali
- [ ] Esportazione dati in formato PDF e CSV
- [ ] Notifiche push per aggiornamenti di stato
- [ ] Supporto multi-lingua (i18n)
- [ ] Test automatizzati end-to-end
- [ ] Containerizzazione con Docker
- [ ] Supporto IOTA 2.0 mainnet in produzione
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
  <i>ExArt26-IOTA &mdash; Dati sanitari interamente on-chain, trasparenti e immutabili</i>
</p>
