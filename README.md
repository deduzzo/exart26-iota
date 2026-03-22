<p align="center">
  <img src="https://img.shields.io/badge/Node.js-%3E%3D17-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Sails.js-1.5-14ACC2?style=for-the-badge&logo=sails.js&logoColor=white" alt="Sails.js">
  <img src="https://img.shields.io/badge/IOTA%2FShimmer-SDK%201.1-131F37?style=for-the-badge&logo=iota&logoColor=white" alt="IOTA">
  <img src="https://img.shields.io/badge/Arweave-Permaweb-222326?style=for-the-badge&logo=arweave&logoColor=white" alt="Arweave">
  <img src="https://img.shields.io/badge/Bootstrap-5.3-7952B3?style=for-the-badge&logo=bootstrap&logoColor=white" alt="Bootstrap">
  <img src="https://img.shields.io/badge/Crittografia-RSA%20%2B%20AES%20%2B%20HMAC-DC382D?style=for-the-badge&logo=letsencrypt&logoColor=white" alt="Encryption">
</p>

<h1 align="center">ExArt26-IOTA</h1>

<p align="center">
  <b>Gestione decentralizzata delle liste d'attesa per la riabilitazione sanitaria (Ex Art. 26)</b><br>
  <i>Trasparenza, immutabilita e sicurezza attraverso la blockchain IOTA/Shimmer e il permaweb Arweave</i>
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

Questa applicazione risolve questi problemi registrando ogni operazione sulla **blockchain IOTA/Shimmer** (ledger distribuito e immutabile) e mantenendo un **backup permanente su Arweave** (permaweb). I dati sensibili degli assistiti sono protetti da un sistema di **crittografia ibrida a triplo livello** (RSA-2048 + AES-256-CBC + HMAC-SHA256).

---

## Architettura

Il sistema e progettato su un'architettura a tre livelli di persistenza, ciascuno con un ruolo specifico:

```
                        +---------------------------+
                        |      Browser / Client     |
                        |   (Bootstrap 5 + EJS +    |
                        |    WebSocket real-time)    |
                        +------------+--------------+
                                     |
                                     | HTTP / WebSocket
                                     v
                        +---------------------------+
                        |     Sails.js v1.5.0       |
                        |  +---------+-----------+  |
                        |  | REST API | Actions  |  |
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
        |   MySQL / sails-disk  |          |  IOTA/Shimmer Tangle  |
        |   (cache locale)      |          |  (ledger primario)    |
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

1. L'utente invia una richiesta (es. aggiunta assistito) tramite il browser
2. Il backend valida i dati e genera le chiavi crittografiche necessarie
3. I dati vengono cifrati con il sistema ibrido RSA+AES+HMAC
4. Il payload cifrato viene inviato come transazione tagged sulla rete IOTA/Shimmer
5. Una copia viene simultaneamente caricata su Arweave come backup permanente
6. Il database locale viene aggiornato come cache per accesso rapido
7. Il client riceve feedback in tempo reale via WebSocket durante l'intera operazione

---

## Stack Tecnologico

| Componente | Tecnologia | Versione | Ruolo |
|:-----------|:-----------|:---------|:------|
| **Backend** | Sails.js | 1.5.0 | Framework MVC, REST API, WebSocket |
| **Runtime** | Node.js | >= 17 | Ambiente di esecuzione |
| **Blockchain** | @iota/sdk | 1.1.5 | Ledger distribuito primario (IOTA/Shimmer) |
| **Permaweb** | Arweave | 1.15.5 | Backup permanente e immutabile |
| **Database** | MySQL / sails-disk | 3.0.1 | Cache locale per accesso rapido |
| **Frontend** | Bootstrap | 5.3.3 | UI responsive |
| **Template** | EJS | - | Rendering server-side delle viste |
| **Real-time** | Socket.io (sails-hook-sockets) | 2.0.0 | Feedback live operazioni blockchain |
| **API Docs** | Swagger UI | 5.17.2 | Documentazione interattiva OpenAPI |
| **Rate Limiting** | express-rate-limit | 7.1.0 | Protezione contro abusi |
| **Crittografia** | Node.js crypto (built-in) | - | RSA-2048, AES-256-CBC, HMAC-SHA256 |
| **Task Runner** | Grunt | 1.6.1 | Build e pipeline asset |
| **Linting** | ESLint + HTMLHint | 9.0 / 1.1.4 | Qualita del codice |

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
  Payload completo --> Blockchain IOTA + Arweave
```

### Gestione delle chiavi

| Aspetto | Implementazione |
|:--------|:----------------|
| **Generazione** | Ogni entita (Organizzazione, Struttura, Assistito) riceve una coppia di chiavi RSA-2048 al momento della creazione |
| **Chiave MAIN** | Esiste una coppia di chiavi master (`MAIN_PUBLIC_KEY` / `MAIN_PRIVATE_KEY`) usata per cifrare le chiavi private delle entita |
| **Archiviazione privata** | Le chiavi private delle entita vengono cifrate con la chiave pubblica MAIN prima di essere salvate sulla blockchain |
| **Protezione API** | Le chiavi private non vengono mai esposte nelle risposte JSON grazie a `customToJSON()` nei modelli |
| **Wallet IOTA** | Protetto da password tramite Stronghold (vault crittografico nativo dell'SDK IOTA) |

### Misure di sicurezza aggiuntive

- **CSRF Protection**: token CSRF richiesto per tutte le richieste mutative
- **Rate Limiting**: `express-rate-limit` per prevenire attacchi brute-force e DDoS
- **Autenticazione**: sistema di login/signup con conferma email e recupero password
- **Policy di accesso**: middleware Sails.js per la protezione delle rotte

---

## Funzionalita

### Gestione liste d'attesa
- Creazione e gestione di **organizzazioni**, **strutture**, **liste** e **assistiti**
- Inserimento e rimozione assistiti dalle liste con tracciamento dello **stato** e dei **timestamp**
- Relazioni many-to-many: un assistito puo essere in piu liste contemporaneamente

### Blockchain e immutabilita
- Ogni operazione viene registrata come **transazione tagged** sulla rete IOTA/Shimmer
- I dati sono classificati per tipo (`TransactionDataType`): dati principali, organizzazioni, strutture, liste, assistiti, chiavi private, movimenti
- **Sincronizzazione bidirezionale**: il database locale puo essere ricostruito interamente dalla blockchain (`fetch-db-from-blockchain`)

### Backup permanente su Arweave
- **Backup automatico** di ogni transazione sul permaweb Arweave
- I dati su Arweave sono **permanenti e immutabili** per design del protocollo
- **Recovery da Arweave**: in caso di perdita dei dati IOTA, e possibile recuperare tutto dal backup Arweave (`recover-from-arweave`)

### Interfaccia e real-time
- **Dashboard** con statistiche in tempo reale
- **Feedback WebSocket** durante le operazioni blockchain (progresso, conferme, errori)
- Interfaccia responsive con **Bootstrap 5.3**
- Viste dedicate per organizzazioni, strutture, assistiti

### Documentazione API
- **Swagger UI** integrata e accessibile a `/docs`
- Schema OpenAPI auto-generato disponibile a `/swagger.json`
- Supporto CSRF token automatico nelle richieste Swagger

### Gestione wallet
- Pagina di verifica stato wallet (`/wallet/verifica`)
- Informazioni wallet via API (`/api/v1/wallet/get-info`)
- Configurazione flessibile: supporto rete IOTA mainnet, Shimmer e testnet

---

## Installazione

### Prerequisiti

- **Node.js** >= 17
- **npm** >= 8
- **MySQL** (per produzione) oppure nessun DB (sails-disk in sviluppo)
- Un **wallet IOTA/Shimmer** con fondi per le transazioni
- Un **wallet Arweave** con fondi per il backup (opzionale)

### 1. Clonare il repository

```bash
git clone https://github.com/deduzzo/exart-26-iota.git
cd exart-26-iota
```

### 2. Installare le dipendenze

```bash
npm install
```

### 3. Configurare IOTA/Shimmer

Copiare il file di esempio e inserire le proprie chiavi:

```bash
cp config/sample_private_iota_conf.js config/private_iota_conf.js
```

Editare `config/private_iota_conf.js`:

```javascript
module.exports = {
  COIN_TYPE: CoinType.Shimmer,           // o CoinType.IOTA
  MAIN_PRIVATE_KEY: 'YOUR_RSA_PRIVATE_KEY',
  MAIN_PUBLIC_KEY: 'YOUR_RSA_PUBLIC_KEY',
  IOTA_STRONGHOLD_PASSWORD: 'una-password-sicura',
  IOTA_NODE_URL: 'https://api.testnet.shimmer.network',
  IOTA_EXPLORER_URL: 'https://explorer.shimmer.network/testnet',
  // ... altri parametri
};
```

> Per generare la coppia di chiavi RSA, utilizzare: `await CryptHelper.RSAGenerateKeyPair()`

### 4. Configurare Arweave (opzionale)

```bash
cp config/sample_private_arweave_conf.js config/private_arweave_conf.js
```

Editare `config/private_arweave_conf.js` inserendo il proprio wallet JWK (scaricabile da [arweave.app](https://arweave.app/wallet)).

### 5. Configurare il database (produzione)

Editare `config/datastores.js` con i parametri MySQL:

```javascript
default: {
  adapter: 'sails-mysql',
  url: 'mysql://user:password@host:3306/exart26',
}
```

> In sviluppo, il sistema usa `sails-disk` (nessuna configurazione necessaria).

### 6. Avviare l'applicazione

```bash
# Sviluppo
sails lift

# Oppure direttamente
node app.js

# Produzione
NODE_ENV=production node app.js
```

L'applicazione sara disponibile su `http://localhost:1337`.

---

## Struttura Progetto

```
exart26-iota/
|
+-- api/
|   +-- controllers/            # Action-based controllers (Sails.js actions2)
|   |   +-- account/            # Gestione account utente
|   |   +-- dashboard/          # Dashboard
|   |   +-- entrance/           # Login, signup, recupero password
|   |   +-- wallet/             # Verifica e info wallet
|   |   +-- add-organizzazione.js
|   |   +-- add-struttura.js
|   |   +-- add-lista.js
|   |   +-- add-assistito.js
|   |   +-- add-assistito-in-lista.js
|   |   +-- fetch-db-from-blockchain.js
|   |   +-- recover-from-arweave.js
|   |   +-- view-*.js           # Controller delle viste
|   |
|   +-- enums/                  # Enumerazioni
|   |   +-- StatoLista.js       # Stati dell'assistito in lista (6 stati)
|   |   +-- TransactionDataType.js  # Tipi di payload blockchain (8 tipi)
|   |
|   +-- models/                 # Modelli Waterline ORM
|   |   +-- Organizzazione.js
|   |   +-- Struttura.js
|   |   +-- Lista.js
|   |   +-- Assistito.js
|   |   +-- AssistitiListe.js   # Tabella di giunzione M:N
|   |   +-- View.js
|   |
|   +-- utility/                # Componenti core del sistema
|   |   +-- iota.js             # Gestione wallet, account, transazioni IOTA
|   |   +-- ListManager.js      # Logica business, sync DB <-> blockchain
|   |   +-- CryptHelper.js      # Crittografia ibrida RSA+AES+HMAC
|   |   +-- ArweaveHelper.js    # Backup e recovery da Arweave permaweb
|   |
|   +-- helpers/                # Sails.js helpers riutilizzabili
|   +-- hooks/                  # Hook personalizzati
|   +-- policies/               # Middleware di autorizzazione
|   +-- responses/              # Risposte HTTP personalizzate
|
+-- config/
|   +-- routes.js               # Definizione di tutte le rotte
|   +-- security.js             # CSRF, CORS
|   +-- datastores.js           # Connessione database
|   +-- custom.js               # Parametri personalizzati (URL, email, token)
|   +-- bootstrap.js            # Inizializzazione all'avvio (carica dati da blockchain)
|   +-- policies.js             # Mapping policy -> rotte
|   +-- sample_private_iota_conf.js     # Template configurazione IOTA
|   +-- sample_private_arweave_conf.js  # Template configurazione Arweave
|
+-- views/                      # Template EJS
|   +-- pages/                  # Pagine dell'applicazione
|   +-- layouts/                # Layout base
|   +-- emails/                 # Template email
|
+-- assets/                     # File statici (CSS, JS, immagini)
+-- swagger/                    # Schema OpenAPI generato
+-- tasks/                      # Task Grunt per build
+-- scripts/                    # Script di utilita
```

---

## API Endpoints

### Viste (GET)

| Rotta | Descrizione |
|:------|:------------|
| `GET /` | Homepage / redirect automatico |
| `GET /dashboard` | Dashboard principale con statistiche |
| `GET /organizzazioni/:id?` | Lista organizzazioni (dettaglio se `:id`) |
| `GET /strutture/:idOrganizzazione?/:id?` | Lista strutture filtrate per organizzazione |
| `GET /assistiti/:id?` | Lista assistiti (dettaglio se `:id`) |
| `GET /wallet/verifica` | Pagina verifica stato wallet IOTA |
| `GET /docs` | Documentazione Swagger UI interattiva |

### Autenticazione e account

| Metodo | Rotta | Descrizione |
|:-------|:------|:------------|
| `GET` | `/login` | Pagina di login |
| `GET` | `/signup` | Pagina di registrazione |
| `PUT` | `/api/v1/entrance/login` | Effettua login |
| `POST` | `/api/v1/entrance/signup` | Registra nuovo utente |
| `GET` | `/api/v1/account/logout` | Effettua logout |
| `PUT` | `/api/v1/account/update-password` | Aggiorna password |
| `PUT` | `/api/v1/account/update-profile` | Aggiorna profilo |
| `POST` | `/api/v1/entrance/send-password-recovery-email` | Invia email recupero password |
| `POST` | `/api/v1/entrance/update-password-and-login` | Aggiorna password e login |
| `GET` | `/email/confirm` | Conferma indirizzo email |

### API Operative (blockchain)

| Metodo | Rotta | Descrizione |
|:-------|:------|:------------|
| `POST` | `/api/v1/add-organizzazione` | Crea nuova organizzazione (genera chiavi RSA, scrive su blockchain) |
| `POST` | `/api/v1/add-struttura` | Crea nuova struttura |
| `POST` | `/api/v1/add-lista` | Crea nuova lista d'attesa |
| `POST` | `/api/v1/add-assistito` | Registra nuovo assistito (genera chiavi RSA) |
| `POST` | `/api/v1/add-assistito-in-lista` | Inserisce un assistito in una lista d'attesa |
| `POST` | `/api/v1/fetch-db-from-blockchain` | Ricostruisce il DB locale dalla blockchain |
| `POST` | `/api/v1/recover-from-arweave` | Recupera tutti i dati dal backup Arweave |
| `GET` | `/api/v1/wallet/get-info` | Restituisce informazioni sul wallet IOTA |
| `GET` | `/api/v1/get-transaction` | Recupera una transazione specifica |

### Utilita

| Rotta | Descrizione |
|:------|:------------|
| `GET /swagger.json` | Schema OpenAPI in formato JSON |
| `GET /csrfToken` | Ottieni token CSRF per le richieste |
| `POST /api/v1/observe-my-session` | Sottoscrizione WebSocket per sessione corrente |

---

## Screenshot

> Le screenshot dell'applicazione verranno aggiunte prossimamente.

<!--
Inserire qui le screenshot:
![Dashboard](docs/screenshots/dashboard.png)
![Organizzazioni](docs/screenshots/organizzazioni.png)
![Assistiti](docs/screenshots/assistiti.png)
-->

---

## Roadmap

- [ ] Implementazione completa della gestione movimenti tra liste
- [ ] Dashboard analitica avanzata con grafici temporali
- [ ] Esportazione dati in formato PDF e CSV
- [ ] Notifiche push per aggiornamenti di stato
- [ ] Supporto multi-lingua (i18n gia predisposto)
- [ ] Test automatizzati end-to-end
- [ ] Containerizzazione con Docker
- [ ] Supporto IOTA mainnet in produzione
- [ ] Interfaccia pubblica per consultazione posizione in lista (anonimizzata)
- [ ] Integrazione con sistemi informativi sanitari regionali

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
