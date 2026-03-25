# ExArt26 IOTA - Gestione Liste d'Attesa Decentralizzata su Blockchain

## Documentazione Completa per Presentazione Clienti

---

# PARTE 1: PANORAMICA ESECUTIVA (Per Decision Maker)

## Cos'e ExArt26 IOTA?

ExArt26 IOTA e una piattaforma software innovativa per la gestione delle liste d'attesa nella riabilitazione sanitaria (Ex articolo 26 della Legge 833/1978), costruita interamente su tecnologia blockchain. A differenza di qualsiasi altro sistema di gestione liste d'attesa esistente, i dati dei pazienti non risiedono in un database tradizionale, ma sono archiviati in modo permanente, immutabile e verificabile sulla blockchain IOTA 2.0.

## Il Problema che Risolve

Le liste d'attesa sanitarie sono da sempre un punto critico del sistema sanitario italiano. I problemi principali sono:

1. **Opacita**: i cittadini non hanno modo di verificare autonomamente la propria posizione in lista, ne di sapere se la lista viene gestita correttamente.
2. **Manipolabilita**: i dati in un database tradizionale possono essere modificati, cancellati o alterati senza lasciare traccia. Un operatore con accesso al database puo spostare un paziente in coda, cancellarne uno, o alterare le date di inserimento.
3. **Centralizzazione**: i dati risiedono su un singolo server controllato da un singolo ente. Se il server si guasta, i dati possono andare persi. Se l'ente che gestisce il server non e trasparente, nessuno puo verificare cosa accade realmente.
4. **Mancanza di fiducia**: i pazienti devono fidarsi ciecamente dell'ente che gestisce la lista, senza avere strumenti per verificare che tutto funzioni correttamente.
5. **Assenza di audit trail**: non esiste uno storico immutabile delle operazioni. Chi ha inserito quel paziente? Quando? Chi lo ha rimosso? Perche? In un database tradizionale queste informazioni possono essere alterate.

## La Soluzione: Blockchain come Source of Truth

ExArt26 IOTA risolve tutti questi problemi archivando ogni singola operazione sulla blockchain IOTA 2.0:

- **Ogni inserimento in lista** diventa una transazione blockchain immutabile.
- **Ogni rimozione dalla lista** (per presa in carico, completamento, rinuncia, annullamento) e registrata in modo permanente.
- **Ogni modifica ai dati** e tracciata e verificabile da chiunque abbia accesso alla blockchain.
- **L'ordine cronologico** e garantito dalla blockchain stessa: nessuno puo retrodatare un inserimento.
- **I dati non possono essere cancellati o alterati** dopo la registrazione.

Il database locale dell'applicazione e semplicemente una **cache** (una copia locale per prestazioni) che puo essere cancellata e ricostruita in qualsiasi momento leggendo i dati dalla blockchain. La blockchain e l'unica fonte di verita.

## A Chi si Rivolge

- **ASL e Aziende Sanitarie** che gestiscono liste d'attesa per la riabilitazione
- **Strutture riabilitative** accreditate con il SSN
- **Regioni e Ministero della Salute** per il monitoraggio trasparente delle liste
- **Associazioni di pazienti** che richiedono trasparenza nella gestione delle liste
- **Enti di controllo e anticorruzione** che necessitano di audit trail immutabili

---

# PARTE 2: COME FUNZIONA (Per Stakeholder Tecnici e Non-Tecnici)

## 2.1 La Struttura Organizzativa

Il sistema modella fedelmente la struttura del sistema sanitario riabilitativo italiano:

### Gerarchia delle Entita

```
Organizzazione (es. ASL Roma 1, Fondazione Don Gnocchi)
  |
  +-- Struttura (es. Centro Riabilitativo Via Roma, Polo Riabilitativo Nord)
       |
       +-- Lista d'Attesa (es. Lista Riabilitazione Neurologica, Lista Riabilitazione Ortopedica)
            |
            +-- Assistito/Paziente (con posizione in coda: #1, #2, #3...)
```

- Una **Organizzazione** e l'ente che gestisce una o piu strutture (es. una ASL, una cooperativa, una fondazione).
- Una **Struttura** e un centro fisico dove si eroga la riabilitazione.
- Una **Lista d'Attesa** e specifica per tipo di riabilitazione all'interno di una struttura.
- Un **Assistito** e il paziente in attesa, che puo essere in coda in una o piu liste contemporaneamente.

### Ciclo di Vita dell'Assistito nella Lista

Un assistito passa attraverso diversi stati nel suo percorso nella lista d'attesa:

1. **INSERITO IN CODA** (Stato 1): il paziente viene aggiunto alla lista d'attesa. Riceve una posizione numerica (#1, #2, #3...) basata sull'ordine cronologico di inserimento.

2. **RIMOSSO - IN ASSISTENZA** (Stato 2): il paziente viene "chiamato" dalla lista perche e il suo turno. Inizia il percorso riabilitativo. Questo e lo stato piu comune di uscita dalla coda.

3. **RIMOSSO - COMPLETATO** (Stato 3): il paziente ha completato il percorso riabilitativo.

4. **RIMOSSO - CAMBIO LISTA** (Stato 4): il paziente viene spostato in un'altra lista (ad esempio perche le sue esigenze riabilitative sono cambiate).

5. **RIMOSSO - RINUNCIA** (Stato 5): il paziente rinuncia volontariamente al posto in lista.

6. **RIMOSSO - ANNULLATO** (Stato 6): l'inserimento in lista viene annullato per motivi amministrativi.

Ogni passaggio di stato viene registrato sulla blockchain con data e ora esatte, creando uno storico immutabile e verificabile.

## 2.2 Il Flusso Operativo Quotidiano

### Inserimento di un Nuovo Paziente

Quando un operatore inserisce un nuovo paziente nel sistema:

1. L'operatore compila il modulo nell'interfaccia web con i dati del paziente (nome, cognome, codice fiscale, dati di contatto).
2. Il sistema **risponde immediatamente** all'operatore confermando l'inserimento (l'interfaccia non si blocca).
3. In background, il sistema:
   - **Genera una coppia di chiavi crittografiche** (RSA-2048) dedicata a quel paziente.
   - **Cifra i dati sensibili** del paziente con crittografia ibrida (AES-256 + RSA-2048).
   - **Pubblica i dati cifrati sulla blockchain IOTA 2.0** come transazione permanente.
   - **Aggiorna l'indice globale** (MAIN_DATA) sulla blockchain.
   - **Effettua un backup** su Arweave (storage permanente secondario) come ulteriore sicurezza.
4. L'operatore riceve notifiche in tempo reale sullo stato della pubblicazione blockchain tramite WebSocket.

### Aggiunta a una Lista d'Attesa

Quando un paziente viene aggiunto a una lista d'attesa:

1. L'operatore seleziona il paziente e la lista.
2. Il sistema registra l'inserimento con data/ora esatte.
3. Il paziente riceve una posizione in coda (#1, #2, #3...) calcolata automaticamente.
4. La transazione blockchain registra chi ha inserito, quando, e in quale lista.
5. Tutte le altre posizioni nella coda vengono aggiornate di conseguenza.

### Chiamata del Paziente ("Chiama")

Quando e il turno del paziente:

1. L'operatore clicca il pulsante "Chiama" sulla prima posizione della coda.
2. Il paziente passa dallo stato "IN CODA" a "IN ASSISTENZA".
3. La transazione blockchain registra il momento esatto della chiamata.
4. Le posizioni di tutti gli altri pazienti in coda scalano automaticamente.
5. Il tempo di attesa viene calcolato e registrato (dalla data di inserimento alla data di chiamata).

### Verifica Pubblica della Posizione

Un paziente o il suo familiare puo verificare autonomamente la posizione in lista:

1. Accede alla pagina pubblica dell'applicazione (nessun login richiesto).
2. Inserisce il proprio codice fiscale.
3. Il codice fiscale viene **hashato localmente nel browser** (SHA-256) - il codice fiscale non viene mai inviato al server.
4. Il sistema mostra tutte le liste con identificativi anonimi (i primi 8 caratteri dell'hash SHA-256).
5. La posizione corrispondente al codice fiscale inserito viene evidenziata.
6. **Nessun dato personale e esposto**: gli altri pazienti vedono solo codici anonimi.

## 2.3 L'Architettura Tecnica (Livello Intermedio)

### I Tre Livelli del Sistema

```
LIVELLO 1 - INTERFACCIA UTENTE
  Applicazione web moderna (React) accessibile da browser
  Funziona su desktop, tablet e smartphone (PWA)
  Design intuitivo con dashboard, grafici e statistiche
  |
  |  Comunicazione via API REST + WebSocket (tempo reale)
  |
LIVELLO 2 - SERVER APPLICATIVO
  Backend Node.js (Sails.js) che gestisce la logica
  Cache locale SQLite per prestazioni (ricostruibile)
  Crittografia dei dati sensibili
  |
  |  Pubblicazione e lettura dati
  |
LIVELLO 3 - BLOCKCHAIN (SOURCE OF TRUTH)
  IOTA 2.0 Rebased - Storage primario immutabile
  Arweave - Backup permanente secondario
  Dati cifrati, accessibili solo con le chiavi corrette
```

### Perche IOTA 2.0?

IOTA 2.0 Rebased e stata scelta come blockchain primaria per motivi specifici:

1. **Zero fee (commissioni zero)**: pubblicare dati su IOTA non costa nulla in termini di commissioni di transazione. Questo e fondamentale per un sistema sanitario che effettua migliaia di operazioni al giorno.
2. **Alta scalabilita**: IOTA 2.0 utilizza un'architettura DAG (Directed Acyclic Graph) che permette transazioni parallele senza colli di bottiglia.
3. **Programmable Transaction Blocks**: permettono di codificare dati strutturati complessi direttamente nelle transazioni.
4. **Finalita rapida**: le transazioni vengono confermate in pochi secondi.
5. **Sostenibilita energetica**: IOTA non utilizza il Proof of Work tradizionale, quindi ha un impatto energetico trascurabile.
6. **Ecosistema enterprise-ready**: IOTA Foundation collabora attivamente con enti pubblici e aziende europee.

### Perche Arweave come Backup?

Arweave fornisce un secondo livello di sicurezza:

1. **Storage permanente**: i dati su Arweave sono garantiti per 200+ anni grazie al modello economico "pay once, store forever".
2. **Ridondanza geografica**: i dati sono replicati su centinaia di nodi in tutto il mondo.
3. **Recovery**: se per qualsiasi motivo i dati su IOTA fossero temporaneamente inaccessibili, il sistema puo recuperarli da Arweave.
4. **Opzionale**: Arweave e un livello aggiuntivo. Il sistema funziona perfettamente anche solo con IOTA.

### Il Meccanismo di Sincronizzazione

Quando il server si avvia:

1. **Avvio immediato**: il server parte istantaneamente usando i dati gia presenti nella cache locale SQLite (se disponibili da un avvio precedente). L'applicazione e subito utilizzabile.
2. **Sync in background**: simultaneamente, il sistema legge la blockchain per verificare se ci sono dati piu recenti.
3. **Aggiornamento incrementale**: solo i dati nuovi o modificati vengono scaricati, non l'intero dataset.
4. **Banner di progresso**: l'interfaccia mostra una barra di progresso durante la sincronizzazione, con contatori per organizzazioni, strutture e assistiti sincronizzati.
5. **Graceful degradation**: se la blockchain non e raggiungibile, l'app funziona comunque con i dati in cache.

Questo meccanismo garantisce che anche se il server viene spento, spostato su un'altra macchina, o se il database locale viene cancellato, tutti i dati possono essere ricostruiti dalla blockchain in qualsiasi momento.

## 2.4 L'Architettura Tecnica Dettagliata (Per Tecnici)

### Codifica Dati On-Chain: u64 Split-Coin

I dati vengono archiviati interamente sulla blockchain IOTA 2.0 usando una tecnica innovativa basata sui Programmable Transaction Blocks. Il payload JSON (contenente i dati del paziente, cifrati) viene suddiviso in chunk da 7 byte, ciascuno codificato come importo u64 (unsigned integer a 64 bit) di un'operazione splitCoins:

```
Programmable Transaction Block:
  splitCoins(gas, [amount0, amount1, ..., amountN])
  transferObjects([coin0, coin1, ..., coinN], selfAddress)

  amount[0] = 1                    <- Marker identificativo "exart26"
  amount[1] = payloadLength        <- Lunghezza totale del JSON in bytes
  amount[2..N] = chunk             <- 1 byte indice + 7 bytes dati = u64
```

Questo approccio permette di archiviare dati arbitrariamente grandi sulla blockchain senza limiti di dimensione del payload, suddividendoli in piccole unita che rientrano nel formato nativo delle transazioni IOTA.

### Crittografia End-to-End

Il flusso crittografico per ogni operazione e il seguente:

1. I dati sensibili del paziente vengono serializzati in formato JSON.
2. Viene generata una **chiave AES-256-CBC casuale** (unica per ogni transazione).
3. Il JSON viene **cifrato con AES-256-CBC** usando la chiave casuale.
4. La chiave AES viene **cifrata con RSA-2048 OAEP SHA-256** usando la chiave pubblica del destinatario.
5. Viene calcolato un **HMAC-SHA256** per garantire l'integrita dei dati (nessuno puo alterare il payload cifrato senza essere scoperto).
6. Il pacchetto completo (dati cifrati + chiave AES cifrata + HMAC) viene codificato come u64 e pubblicato su blockchain.
7. Lo stesso pacchetto viene duplicato su Arweave come backup (operazione non-bloccante).

Ogni entita nel sistema (Organizzazione, Struttura, Lista, Assistito) possiede una propria coppia di chiavi RSA-2048 generata al momento della creazione. Le chiavi private vengono salvate on-chain come transazioni dedicate di tipo PRIVATE_KEY, cifrate con la chiave pubblica master del sistema. Solo chi possiede la chiave privata master puo decifrare le chiavi private delle singole entita, e quindi accedere ai dati.

### Indice MAIN_DATA

MAIN_DATA e un indice leggero che funge da "sommario" di tutti i dati presenti sulla blockchain:

```json
{
  "entities": [
    { "type": "ORGANIZZAZIONE_DATA", "entityId": 1, "digest": "abc123..." },
    { "type": "STRUTTURE_LISTE_DATA", "entityId": 1, "digest": "def456..." },
    { "type": "ASSISTITI_DATA", "entityId": "ASS#1", "digest": "ghi789..." }
  ],
  "version": 5,
  "updatedAt": 1711234567890
}
```

Ogni entita nel sistema ha la propria transazione dedicata sulla blockchain. MAIN_DATA elenca tutti gli entityId per tipo (circa 50 byte per entita), fungendo da punto di partenza per il recovery:

1. Leggi MAIN_DATA dalla blockchain (indice certificato).
2. Per ogni entityId nell'indice, recupera la transazione dedicata per tag.
3. Se MAIN_DATA non esiste (primo avvio o corruzione), fallback: discovery scansionando tutte le transazioni per tag.
4. Ulteriore fallback: recovery da Arweave via query GraphQL.

### Controller Non-Bloccanti

Tutti i controller CRUD seguono un pattern asincrono non-bloccante per garantire reattivita all'utente:

1. Validazione dell'input (codice fiscale con regex, email, lunghezza minima denominazioni).
2. Salvataggio nella cache locale SQLite (operazione istantanea).
3. Risposta HTTP 200 immediata al client.
4. Pubblicazione blockchain in background tramite setImmediate().
5. Aggiornamento dell'indice MAIN_DATA.
6. Backup su Arweave (non-bloccante, se fallisce non interrompe l'operazione IOTA).

L'utente non deve mai attendere la conferma della blockchain per continuare a lavorare.

### Tipi di Transazione (TransactionDataType)

Il sistema utilizza 8 tipi di transazione, ciascuno identificato da un tag univoco:

| Tag | Descrizione |
|-----|-------------|
| MAIN_DATA | Indice globale di tutte le entita |
| ORGANIZZAZIONE_DATA | Dati di un'organizzazione |
| STRUTTURE_LISTE_DATA | Dati di strutture e liste associate |
| ASSISTITI_DATA | Dati anagrafici di un assistito |
| PRIVATE_KEY | Chiave privata RSA di un'entita (cifrata) |
| LISTE_IN_CODA | Stato corrente della coda di una lista |
| ASSISTITI_IN_LISTA | Associazione assistito-lista con stato |
| MOVIMENTI_ASSISTITI_LISTA | Storico movimenti (ingressi, uscite, cambi stato) |

---

# PARTE 3: INTERFACCIA UTENTE

## 3.1 Dashboard

La dashboard offre una panoramica immediata del sistema:

- Numero totale di organizzazioni, strutture, liste e assistiti.
- Statistiche aggregate sulle liste d'attesa.
- Stato della connessione blockchain.
- Indicatori di sincronizzazione.

## 3.2 Gestione Organizzazioni

Pagina per creare e visualizzare le organizzazioni sanitarie. Ogni organizzazione mostra le proprie strutture associate e le statistiche aggregate.

## 3.3 Gestione Strutture

Visualizzazione delle strutture per organizzazione, con statistiche per ogni lista associata:
- Numero di pazienti in coda
- Numero di pazienti usciti
- Totale pazienti transitati
- Tempo medio di attesa in giorni

## 3.4 Gestione Assistiti

Tabella completa degli assistiti con:
- Dati anagrafici
- Liste a cui sono assegnati
- Posizione attuale in coda (#1, #2, #3...)
- Stato corrente (in coda, in assistenza, completato, etc.)

## 3.5 Gestione Liste d'Attesa

Pagina principale operativa con layout a due colonne:
- **Colonna sinistra**: elenco di tutte le liste con filtro testuale per ricerca rapida.
- **Colonna destra**: dettaglio della lista selezionata.

Per ogni lista:
- Card con statistiche (in coda, usciti, media attesa giorni).
- Vista coda con posizioni numerate (#1, #2, #3...).
- Pulsante "Chiama" per il primo paziente in coda.
- Toggle tra vista Coda e vista Storico.
- Rimozione assistiti con selezione del motivo (in assistenza, completato, rinuncia, annullato).

## 3.6 Pagina Pubblica (Verifica Anonima)

Interfaccia pubblica accessibile senza autenticazione per i pazienti:
- Ogni paziente viene identificato con un codice anonimo (primi 8 caratteri dell'hash SHA-256 del codice fiscale).
- Il paziente inserisce il proprio codice fiscale, che viene hashato localmente nel browser.
- La posizione corrispondente viene evidenziata nelle liste.
- Zero dati personali esposti: gli altri pazienti vedono solo codici anonimi.
- Toggle Coda/Storico per ogni lista.

## 3.7 Visualizzazione Grafo Interattivo

Rappresentazione visiva force-directed di tutte le entita e le loro relazioni:
- Nodi colorati per tipo: organizzazioni (viola), strutture (cyan), liste (verde), assistiti (arancione), pazienti trattati (rosso).
- Connessioni che mostrano le relazioni gerarchiche.
- Pannello dettagli al passaggio del mouse.
- Utile per avere una visione d'insieme immediata della complessita del sistema.

## 3.8 Wallet Blockchain

Gestione del portafoglio blockchain:
- Inizializzazione del wallet con generazione automatica del mnemonic BIP39.
- Visualizzazione dell'indirizzo, del saldo e della rete.
- Toggle Arweave Produzione/Test.
- Reset del wallet con doppia conferma di sicurezza.

## 3.9 Debug e Audit

Pagina tecnica per verifica e audit:
- Stato dettagliato del wallet.
- Visualizzazione delle transazioni blockchain con decifratura del payload.
- Contenuto del database locale (cache).
- Cross-reference con verifica di consistenza tra database locale e blockchain.
- Transazioni Arweave per tipo, test interattivo di upload e verifica.

## 3.10 Pagina Load Test

Strumento integrato per generazione di dati di prova:
- Creazione massiva di organizzazioni, strutture, liste e assistiti di test.
- Log in tempo reale delle operazioni eseguite.
- Utile per demo, presentazioni e stress testing del sistema.

---

# PARTE 4: SICUREZZA E PRIVACY

## 4.1 Protezione dei Dati Sensibili

I dati sanitari sono tra i piu sensibili in assoluto (dati particolari ai sensi del GDPR, articolo 9). Il sistema implementa molteplici livelli di protezione:

### Crittografia a Riposo (At Rest)
- Tutti i dati dei pazienti sono cifrati con **AES-256-CBC** prima di essere pubblicati sulla blockchain.
- Le chiavi di cifratura sono protette con **RSA-2048 OAEP SHA-256**.
- Anche se qualcuno accedesse direttamente alla blockchain, vedrebbe solo dati cifrati illeggibili.

### Crittografia in Transito
- Comunicazioni client-server protette (HTTPS in produzione).
- WebSocket cifrati per le notifiche in tempo reale.

### Gestione delle Chiavi
- Ogni entita (organizzazione, struttura, lista, assistito) ha la propria coppia di chiavi RSA.
- Le chiavi private sono cifrate con la chiave master e archiviate on-chain.
- Il mnemonic BIP39 (12 parole) e l'unico segreto da custodire: da esso si derivano tutte le altre chiavi.

### Integrita dei Dati
- HMAC-SHA256 su ogni payload garantisce che i dati non possano essere alterati senza che il sistema lo rilevi.
- La blockchain stessa fornisce un ulteriore livello di garanzia di integrita tramite i digest delle transazioni.

## 4.2 Privacy del Paziente

### Pagina Pubblica Anonimizzata
- I pazienti sono identificati solo dal hash SHA-256 del codice fiscale (primi 8 caratteri).
- Il codice fiscale non lascia mai il browser del paziente: l'hashing avviene lato client.
- Nessun dato personale (nome, cognome, indirizzo) e visibile nella vista pubblica.

### Protezione CSRF
- Token CSRF abilitato per proteggere dalle richieste cross-site forgery.

## 4.3 Immutabilita e Auditabilita

- Ogni operazione sulla lista d'attesa e una transazione blockchain con timestamp preciso.
- Le transazioni sono immutabili: una volta registrate, non possono essere modificate o cancellate.
- L'intera cronologia delle operazioni e ricostruibile dalla blockchain in qualsiasi momento.
- Questo crea un audit trail perfetto per controlli, verifiche e contenziosi.

---

# PARTE 4B: SISTEMA CRITTOGRAFICO IN DETTAGLIO

## 4B.1 Architettura delle Chiavi

Il sistema utilizza una gerarchia crittografica a piu livelli, dove ogni livello protegge quello sottostante:

### Chiave Master (Livello 0 - Radice)
- **Tipo**: Coppia RSA-2048 (chiave pubblica + chiave privata)
- **Dove risiede**: nel file di configurazione del server (`config/private_iota_conf.js`), mai committato nel repository.
- **Funzione**: e la chiave radice dell'intero sistema. Serve a cifrare e decifrare le chiavi private di tutte le entita sottostanti.
- **Chi la possiede**: solo l'amministratore del sistema. Perderla significa perdere l'accesso a tutti i dati cifrati.
- **Backup**: il file di configurazione deve essere custodito in un luogo sicuro (vault, HSM, cassaforte).

### Wallet Blockchain (Livello 0 - Identita)
- **Tipo**: Ed25519 Keypair derivato da mnemonic BIP39 (12 parole).
- **Dove risiede**: il mnemonic e nel file di configurazione del server. Il keypair viene derivato dinamicamente dal mnemonic.
- **Funzione**: identifica il sistema sulla blockchain IOTA 2.0. Tutte le transazioni vengono firmate con questa chiave.
- **Chi la possiede**: solo l'amministratore del sistema. Il mnemonic e l'unico segreto da memorizzare per ricostruire l'intero wallet.
- **Faucet**: alla creazione del wallet, il sistema richiede automaticamente fondi dal faucet testnet/devnet di IOTA per pagare le operazioni.

### Chiavi per Entita (Livello 1 - Per ogni Organizzazione, Struttura, Lista, Assistito)
- **Tipo**: Coppia RSA-2048 (pubblica + privata), generata individualmente per ogni entita.
- **Dove risiede la chiave pubblica**: nei dati dell'entita stessa, visibile nel payload sulla blockchain.
- **Dove risiede la chiave privata**: sulla blockchain stessa, come transazione dedicata di tipo `PRIVATE_KEY`, cifrata con la chiave pubblica Master.
- **Funzione**: ogni entita ha la propria coppia di chiavi. I dati sensibili dell'entita vengono cifrati con la sua chiave pubblica. Solo chi possiede la chiave privata Master puo decifrare la chiave privata dell'entita, e quindi accedere ai dati.
- **Isolamento**: se un attaccante compromettesse la chiave di una singola entita, non potrebbe accedere ai dati delle altre entita.

### Chiavi di Sessione (Livello 2 - Per ogni transazione)
- **Tipo**: AES-256-CBC (chiave simmetrica a 256 bit), generata casualmente per ogni singola transazione.
- **Dove risiede**: all'interno del payload cifrato sulla blockchain, a sua volta cifrata con RSA-2048.
- **Funzione**: cifra il contenuto effettivo dei dati. Viene generata ex novo per ogni operazione, garantendo che due transazioni diverse non condividano mai la stessa chiave.
- **Forward Secrecy parziale**: anche se una chiave AES venisse compromessa, solo quella singola transazione sarebbe leggibile.

## 4B.2 Il Flusso Crittografico Completo (Passo per Passo)

### Cifratura (quando si scrive un dato)

```
PASSO 1: PREPARAZIONE DEI DATI
   I dati del paziente vengono serializzati in formato JSON.
   Esempio: {"nome":"Mario","cognome":"Rossi","cf":"RSSMRA80A01H501Z",...}

         |
         v

PASSO 2: GENERAZIONE CHIAVE DI SESSIONE
   Viene generata una chiave AES-256 casuale (32 byte).
   Viene generato un IV (Initialization Vector) casuale (16 byte).
   Questa chiave e unica per questa singola transazione.

         |
         v

PASSO 3: CIFRATURA SIMMETRICA DEI DATI
   Il JSON viene cifrato con AES-256-CBC usando la chiave di sessione e l'IV.
   Risultato: una stringa Base64 illeggibile senza la chiave.

         |
         v

PASSO 4: PROTEZIONE DELLA CHIAVE DI SESSIONE
   La chiave AES di sessione viene cifrata con RSA-2048 OAEP SHA-256
   usando la chiave pubblica dell'entita destinataria.
   Solo chi possiede la chiave privata corrispondente potra decifrarla.

         |
         v

PASSO 5: CALCOLO DELL'INTEGRITA
   Viene calcolato un HMAC-SHA256 sul messaggio cifrato,
   usando la chiave AES come segreto.
   Questo garantisce che nessuno possa alterare il payload
   senza essere scoperto.

         |
         v

PASSO 6: ASSEMBLAGGIO DELL'ENVELOPE
   Il pacchetto finale contiene:
   {
     "message": "<dati cifrati AES Base64>",
     "key": "<chiave AES cifrata RSA Base64>",
     "iv": "<initialization vector Base64>",
     "hmac": "<codice integrita Base64>",
     "messageVersion": 3,
     "envelopeVersion": "V1"
   }

         |
         v

PASSO 7: PUBBLICAZIONE
   L'envelope viene codificato come u64 split-coin
   e pubblicato sulla blockchain IOTA 2.0.
   Stesso envelope inviato come backup su Arweave.
```

### Decifratura (quando si legge un dato)

```
PASSO 1: RECUPERO DALLA BLOCKCHAIN
   La transazione viene letta dalla blockchain IOTA
   e l'envelope viene ricostruito dai chunk u64.

         |
         v

PASSO 2: DECIFRATURA DELLA CHIAVE DI SESSIONE
   La chiave AES cifrata viene decifrata con RSA-2048 OAEP SHA-256
   usando la chiave privata dell'entita (a sua volta decifrata
   con la chiave privata Master).

         |
         v

PASSO 3: VERIFICA INTEGRITA
   L'HMAC-SHA256 viene ricalcolato sul messaggio cifrato
   e confrontato con quello nell'envelope.
   Se non corrispondono, i dati sono stati alterati -> ERRORE.

         |
         v

PASSO 4: DECIFRATURA DEI DATI
   Il messaggio viene decifrato con AES-256-CBC
   usando la chiave di sessione e l'IV.
   Risultato: il JSON originale in chiaro.
```

## 4B.3 Sistema di Backup Multilivello

### Livello 1: Cache Locale SQLite

```
Posizione: .tmp/exart26.db (file su disco locale)
Tipo: SQLite via better-sqlite3
Funzione: Cache di performance per accesso istantaneo
Persistenza: Fino al prossimo sync-reset o cancellazione manuale
Ricostruibile: SI, in qualsiasi momento dalla blockchain
```

- Il server si avvia immediatamente usando i dati gia in cache.
- Non contiene dati autoritativi: e solo una copia di lavoro.
- Puo essere cancellata con `POST /api/v1/sync-reset` senza perdere dati.
- Occupa poche decine di MB anche con 100.000+ record.

### Livello 2: Blockchain IOTA 2.0 (Source of Truth)

```
Posizione: Rete distribuita IOTA 2.0 (migliaia di nodi globali)
Tipo: Programmable Transaction Blocks con dati u64
Funzione: Storage primario, immutabile, verificabile
Persistenza: Permanente finche la rete IOTA esiste
Ricostruibile: E il riferimento da cui tutto il resto viene ricostruito
```

- Ogni operazione e una transazione con digest univoco.
- Le transazioni sono immutabili: non possono essere modificate o cancellate.
- L'indice MAIN_DATA funge da punto di partenza per il recovery.
- I dati possono essere letti da qualsiasi nodo della rete IOTA.
- Zero costi di archiviazione: le transazioni IOTA non hanno fee.

### Livello 3: Arweave (Backup Permanente Secondario)

```
Posizione: Rete distribuita Arweave (centinaia di nodi globali)
Tipo: Storage permanente "pay once, store forever"
Funzione: Backup di ridondanza, recovery di ultima istanza
Persistenza: Garantita 200+ anni dal modello economico
Ricostruibile: SI, tramite query GraphQL per tag
Opzionale: Il sistema funziona perfettamente anche senza Arweave
```

- Stesso payload cifrato di IOTA viene duplicato su Arweave.
- Il backup e non-bloccante: se Arweave fallisce, l'operazione IOTA non viene interrotta.
- Due modalita: Produzione (arweave.net, storage reale permanente) e Test (ArLocal, nodo locale in-memory).
- Toggle da interfaccia utente nella pagina Wallet.
- Endpoint dedicato per recovery: `POST /api/v1/recover-from-arweave`.

### Flusso di Recovery (Dal Peggiore al Migliore Scenario)

```
SCENARIO 1: Server riavviato normalmente
   -> Il server parte con la cache SQLite gia su disco (istantaneo)
   -> Sync incrementale dalla blockchain in background (solo dati nuovi)
   -> Tempo: pochi secondi

SCENARIO 2: Cache locale cancellata o corrotta
   -> Il server parte vuoto
   -> Legge l'indice MAIN_DATA dalla blockchain
   -> Scarica ogni entita dalla blockchain
   -> Ricostruisce l'intera cache SQLite
   -> Tempo: da secondi a pochi minuti (dipende dalla quantita di dati)

SCENARIO 3: Cache cancellata + MAIN_DATA non trovato sulla blockchain
   -> Il server parte vuoto
   -> Fallback: scansiona TUTTE le transazioni dalla blockchain per tag
   -> Discovery di tutte le entita tramite filtro sull'indirizzo del wallet
   -> Ricostruisce la cache
   -> Tempo: piu lungo ma completo

SCENARIO 4: Blockchain IOTA temporaneamente inaccessibile
   -> Il server parte con la cache locale (se disponibile)
   -> Se la cache non c'e e Arweave e attivo: recovery da Arweave
   -> Query GraphQL su Arweave per tag e tipo di dato
   -> Scarica e decifra i payload
   -> Ricostruisce la cache
   -> Tempo: da secondi a minuti

SCENARIO 5: Server distrutto + nuova installazione da zero
   -> Basta avere: il mnemonic BIP39 (12 parole) + la chiave RSA master
   -> Il sistema ricostruisce tutto dalla blockchain (o da Arweave)
   -> Tempo: da minuti a decine di minuti (dipende dal volume dati)
```

---

# PARTE 4C: COSTI OPERATIVI

## Costi Irrisori: Analisi Dettagliata

Uno dei vantaggi principali di ExArt26 IOTA e il costo operativo estremamente basso, quasi nullo, rispetto a qualsiasi soluzione tradizionale o basata su altre blockchain.

### Costi della Blockchain IOTA 2.0

| Voce | Costo |
|------|-------|
| Fee per transazione | **ZERO** (IOTA non ha commissioni) |
| Costo di archiviazione dati on-chain | **ZERO** |
| Licenza software IOTA | **ZERO** (open source) |
| Costo per nodo IOTA | **ZERO** (si usano i nodi pubblici della rete) |

A differenza di Ethereum (dove una singola transazione puo costare da pochi centesimi a decine di euro in gas fee), o di altre blockchain con modelli a pagamento, IOTA 2.0 non ha commissioni di transazione. Questo significa che un sistema sanitario che effettua migliaia di operazioni al giorno non paga nulla per l'archiviazione blockchain.

### Costi di Arweave (Opzionali)

| Voce | Costo |
|------|-------|
| Storage permanente (Produzione) | ~0.001-0.01 USD per transazione (pochi KB) |
| ArLocal per test | **ZERO** (nodo locale in-memory) |
| Costo per 10.000 transazioni/anno | Stimato ~10-100 USD totali |

Arweave ha un costo minimo per transazione, proporzionale alla dimensione dei dati. Per i payload tipici di ExArt26 (pochi KB cifrati), il costo e nell'ordine di frazioni di centesimo per operazione. Su base annuale, anche con migliaia di operazioni, il costo complessivo di Arweave e trascurabile. Inoltre, Arweave e completamente opzionale: il sistema funziona perfettamente solo con IOTA.

### Costi Infrastrutturali

| Voce | Costo |
|------|-------|
| Server applicativo | Un singolo VPS/server con Node.js (da 5-20 EUR/mese) |
| Database | **ZERO** (SQLite locale, nessuna licenza) |
| Certificato SSL | **ZERO** (Let's Encrypt) |
| Licenze software | **ZERO** (stack interamente open source) |
| Backup | **ZERO** (la blockchain E il backup) |

Il server applicativo e l'unico costo infrastrutturale ricorrente. Un VPS base (2 CPU, 4GB RAM, 80GB SSD) e piu che sufficiente per gestire migliaia di utenti e decine di migliaia di transazioni, con un costo tra 5 e 20 EUR al mese.

### Confronto Costi Annuali con Soluzioni Tradizionali

| Voce | Sistema Tradizionale | ExArt26 IOTA |
|------|---------------------|--------------|
| Licenze database (Oracle/SQL Server) | 5.000-50.000 EUR/anno | 0 EUR |
| Infrastruttura server (HA, replica) | 2.000-10.000 EUR/anno | 60-240 EUR/anno |
| Backup e disaster recovery | 1.000-5.000 EUR/anno | 0 EUR (blockchain) |
| Fee blockchain | N/A | 0 EUR (IOTA) |
| Backup Arweave (opzionale) | N/A | 10-100 EUR/anno |
| Licenze applicative | 5.000-30.000 EUR/anno | 0 EUR (open source) |
| **TOTALE ANNUO** | **13.000-95.000 EUR** | **70-340 EUR** |

I costi operativi di ExArt26 IOTA sono dalle **50 alle 300 volte inferiori** rispetto a una soluzione tradizionale equivalente. Questo rende il sistema accessibile anche per piccole strutture con budget limitati.

### Costo per Paziente

Con un costo annuo stimato di 70-340 EUR e ipotizzando 1.000 pazienti gestiti:
- **Costo per paziente/anno**: 0.07-0.34 EUR
- Praticamente zero.

---

# PARTE 5: VANTAGGI COMPETITIVI

## 5.1 Rispetto ai Sistemi Tradizionali (Database Centralizzati)

| Caratteristica | Sistema Tradizionale | ExArt26 IOTA |
|---|---|---|
| Archiviazione dati | Database SQL centralizzato | Blockchain distribuita (IOTA 2.0) |
| Modificabilita dei dati | Chiunque con accesso al DB puo modificare | Immutabile: nessuno puo alterare le transazioni |
| Audit trail | Log applicativi (modificabili) | Blockchain immutabile con timestamp certificati |
| Trasparenza per il paziente | Nessuna | Verifica pubblica anonimizzata |
| Resilienza | Single point of failure | Dati distribuiti su migliaia di nodi + backup Arweave |
| Costo operativo | Licenze DB + infrastruttura server | Zero fee sulla blockchain IOTA |
| Dipendenza dal fornitore (vendor lock-in) | Alta: dati nel formato proprietario del fornitore | Zero: dati sulla blockchain pubblica, leggibili da chiunque |
| Recovery da disastro | Dipende dai backup del fornitore | Ricostruzione completa dalla blockchain in qualsiasi momento |
| Proof of integrity | Non disponibile | Ogni transazione ha un digest verificabile |
| Tempo per manipolazione | Minuti (modifica diretta al DB) | Impossibile (blockchain immutabile) |

## 5.2 Vantaggi Specifici

### Per le ASL e le Aziende Sanitarie
- **Eliminazione dei contenziosi**: ogni inserimento e rimozione e documentato sulla blockchain con data e ora immutabili. In caso di contenzioso, la prova e incontrovertibile.
- **Compliance normativa**: il sistema soddisfa i requisiti di trasparenza e tracciabilita richiesti dalla normativa sanitaria.
- **Riduzione dei costi IT**: nessuna licenza di database, nessuna infrastruttura di backup complessa. La blockchain e il backup.
- **Interoperabilita**: i dati sulla blockchain sono accessibili da qualsiasi sistema che sappia leggere le transazioni IOTA.

### Per i Pazienti
- **Trasparenza totale**: possibilita di verificare la propria posizione in lista in qualsiasi momento, senza dipendere dall'ente.
- **Garanzia di equita**: l'ordine cronologico e certificato dalla blockchain. Nessuno puo "saltare la coda" senza che la modifica sia visibile.
- **Privacy preservata**: la verifica pubblica usa solo hash anonimi. Nessun dato personale e esposto.

### Per gli Enti di Controllo
- **Audit completo**: ogni operazione e tracciata con timestamp, tipo di operazione e stato.
- **Verifica indipendente**: i controllori possono verificare i dati direttamente sulla blockchain, senza dipendere dal sistema dell'ente controllato.
- **Anti-frode**: impossibile retrodatare inserimenti o cancellare rimozioni.

### Per il Sistema Sanitario Regionale/Nazionale
- **Monitoraggio in tempo reale**: possibilita di aggregare dati da piu strutture per avere una visione regionale o nazionale delle liste d'attesa.
- **Benchmark**: confronto tra strutture basato su dati certificati e non manipolabili.
- **Pianificazione**: dati storici accurati per pianificare l'allocazione delle risorse.

## 5.3 Innovazioni Tecniche Distintive

1. **Codifica u64 Split-Coin**: tecnica proprietaria per archiviare dati arbitrariamente grandi sulla blockchain IOTA, superando i limiti nativi di dimensione delle transazioni.

2. **Controller Non-Bloccanti**: l'interfaccia utente non si blocca mai in attesa della conferma blockchain. L'operatore lavora a velocita normale, la blockchain viene aggiornata in background.

3. **Dual-Blockchain Redundancy**: IOTA come storage primario + Arweave come backup permanente. Doppia garanzia di persistenza dei dati.

4. **Recovery Multilivello**: se il database locale viene cancellato, il sistema lo ricostruisce dalla blockchain. Se la blockchain e temporaneamente inaccessibile, usa la cache locale. Se anche Arweave e disponibile, i dati possono essere recuperati da li. Tre livelli di fallback.

5. **Crittografia per Entita**: ogni organizzazione, struttura, lista e assistito ha le proprie chiavi crittografiche. Un compromesso di una chiave non espone gli altri dati.

6. **Hashing Client-Side per Privacy**: il codice fiscale del paziente non lascia mai il browser. Solo l'hash viene confrontato con i dati anonimizzati.

7. **Sync Incrementale**: al riavvio, il sistema scarica solo i dati nuovi dalla blockchain, non l'intero dataset. Avvio istantaneo con la cache locale, aggiornamento in background.

---

# PARTE 6: POTENZIALI SVILUPPI FUTURI

## 6.1 Sviluppi a Breve Termine

### Multi-Tenant e Multi-Ente
- Supporto per piu organizzazioni indipendenti sulla stessa istanza.
- Ogni organizzazione con le proprie chiavi e i propri dati, isolati crittograficamente.
- Dashboard regionale aggregata per il monitoraggio multi-ente.

### Autenticazione e Ruoli
- Integrazione con SPID/CIE per l'autenticazione degli operatori.
- Sistema di ruoli (amministratore, operatore, lettore, auditor).
- Firma digitale delle operazioni con identita certificata dell'operatore.

### Notifiche ai Pazienti
- Sistema di notifica via SMS/email/PEC quando il paziente si avvicina alla prima posizione in coda.
- Notifica automatica quando viene "chiamato" (passaggio a stato IN_ASSISTENZA).
- Integrazione con l'app IO per notifiche istituzionali.

### Reportistica Avanzata
- Report automatici per la Regione con dati aggregati.
- Esportazione dati in formato ministeriale.
- Dashboard di monitoraggio con KPI (Key Performance Indicators) per le liste d'attesa.

## 6.2 Sviluppi a Medio Termine

### Interoperabilita con il Fascicolo Sanitario Elettronico (FSE)
- Integrazione bidirezionale con il FSE 2.0.
- Lettura della prescrizione specialistica dal FSE.
- Aggiornamento automatico del FSE quando il paziente viene preso in carico.

### Smart Contract per Regole Automatiche
- Regole automatiche di priorita basate su criteri clinici (urgenza, patologia, eta).
- Gestione automatica delle scadenze (rimozione dalla lista dopo N giorni senza risposta).
- Escalation automatica quando il tempo di attesa supera le soglie regionali.

### App Mobile Nativa
- App dedicata per pazienti (iOS/Android) per verifica posizione in tempo reale.
- App dedicata per operatori con scanner QR per identificazione rapida del paziente.
- Notifiche push native.

### Multi-Blockchain
- Supporto per blockchain alternative oltre a IOTA (es. Ethereum L2, Polygon, Solana) per massima resilienza.
- Bridge cross-chain per replicazione dei dati su piu blockchain.

## 6.3 Sviluppi a Lungo Termine

### Federazione tra Regioni
- Network federato dove ogni Regione gestisce il proprio nodo blockchain.
- Mobilita inter-regionale: un paziente puo essere in lista in piu regioni.
- Compensazione automatica tra regioni per prestazioni cross-border.

### Intelligenza Artificiale
- Previsione dei tempi di attesa basata su dati storici certificati dalla blockchain.
- Suggerimento automatico della lista piu adatta per il paziente.
- Rilevamento automatico di anomalie (possibili irregolarita nella gestione delle liste).
- Ottimizzazione dell'allocazione delle risorse riabilitative.

### Estensione ad Altri Ambiti Sanitari
- Liste d'attesa per visite specialistiche.
- Liste d'attesa per interventi chirurgici.
- Gestione dei posti letto in strutture residenziali.
- Qualsiasi contesto dove serve trasparenza e immutabilita nella gestione delle code.

### Governance Decentralizzata
- DAO (Decentralized Autonomous Organization) per la governance del sistema.
- Votazione on-chain per le modifiche alle regole di gestione delle liste.
- Token di governance per gli stakeholder (ASL, strutture, associazioni pazienti).

---

# PARTE 7: COSA APPORTA DI NUOVO

## 7.1 Primo nel suo Genere

ExArt26 IOTA e il **primo sistema al mondo** che gestisce liste d'attesa sanitarie interamente su blockchain. Non si tratta di un sistema tradizionale con un "layer blockchain" aggiunto sopra: i dati **nascono e vivono** sulla blockchain. Il database locale e solo una cache di performance.

## 7.2 Paradigma "Blockchain-Native"

La maggior parte dei progetti "blockchain in sanita" si limita ad ancorare hash di documenti sulla blockchain, mantenendo i dati reali in un database tradizionale. ExArt26 IOTA rovescia questo paradigma:

- **I dati reali sono sulla blockchain**, non solo i loro hash.
- **Il database locale e sacrificabile**: puo essere cancellato e ricostruito in qualsiasi momento.
- **Zero dipendenza dall'infrastruttura locale**: se il server brucia, i dati sono salvi sulla blockchain.

## 7.3 Trasparenza senza Compromessi sulla Privacy

Il sistema risolve il paradosso apparente tra trasparenza e privacy:

- **Trasparenza per il sistema**: ogni operazione e tracciata e verificabile.
- **Privacy per il paziente**: i dati sono cifrati con crittografia di grado militare (AES-256 + RSA-2048).
- **Verifica anonima**: i pazienti possono controllare la propria posizione senza esporre dati personali a nessuno.

## 7.4 Zero Costi di Transazione

A differenza di soluzioni basate su Ethereum o altre blockchain con fee, IOTA 2.0 non ha costi di transazione. Questo rende il sistema economicamente sostenibile anche per volumi enormi di operazioni quotidiane tipici del sistema sanitario.

## 7.5 Resilienza a Prova di Catastrofe

Il sistema ha tre livelli di ridondanza:

1. **Cache locale SQLite**: avvio istantaneo, funzionamento offline.
2. **Blockchain IOTA 2.0**: migliaia di nodi distribuiti globalmente.
3. **Arweave**: storage permanente garantito per 200+ anni.

Anche nello scenario peggiore (server distrutto + rete IOTA temporaneamente inaccessibile), i dati sono recuperabili da Arweave.

## 7.6 Open Source e Vendor-Independent

- I dati sono su una blockchain pubblica: non sono proprieta di nessun fornitore.
- Se l'ente decide di cambiare fornitore, i dati rimangono accessibili sulla blockchain.
- Lo standard di codifica (u64 split-coin) e documentato e replicabile.
- Zero lock-in: il cliente possiede veramente i propri dati.

## 7.7 Conformita Normativa

Il sistema e progettato per soddisfare:

- **GDPR** (Regolamento UE 2016/679): crittografia dei dati personali, minimizzazione dei dati nella vista pubblica, diritto di verifica.
- **D.Lgs. 196/2003** (Codice Privacy italiano): misure di sicurezza adeguate per dati sanitari.
- **CAD** (Codice dell'Amministrazione Digitale): tracciabilita e integrita dei documenti informatici.
- **Piano Nazionale Liste d'Attesa**: trasparenza e monitoraggio delle liste d'attesa sanitarie.
- **Linee guida AgID** sulla blockchain nella PA: utilizzo di DLT (Distributed Ledger Technology) per la pubblica amministrazione.

---

# PARTE 8: GLOSSARIO

| Termine | Definizione |
|---------|-------------|
| **Blockchain** | Registro digitale distribuito e immutabile dove le transazioni vengono registrate in blocchi concatenati crittograficamente |
| **IOTA 2.0 Rebased** | Piattaforma blockchain di nuova generazione senza commissioni di transazione, sviluppata dalla IOTA Foundation |
| **Arweave** | Rete di storage permanente decentralizzato con modello "paga una volta, archivia per sempre" |
| **Source of Truth** | L'unica fonte autorevole dei dati. In ExArt26 IOTA, e la blockchain |
| **Cache** | Copia locale dei dati per velocizzare l'accesso. Puo essere cancellata e ricostruita |
| **AES-256-CBC** | Standard di crittografia simmetrica a 256 bit, considerato inviolabile con la tecnologia attuale |
| **RSA-2048** | Standard di crittografia asimmetrica (chiave pubblica/privata) a 2048 bit |
| **HMAC-SHA256** | Codice di autenticazione dei messaggi che garantisce l'integrita dei dati |
| **Mnemonic BIP39** | Sequenza di 12/24 parole che rappresenta una chiave crittografica in modo memorizzabile |
| **u64** | Intero senza segno a 64 bit, il formato usato per codificare i dati nelle transazioni IOTA |
| **Split-Coin** | Operazione IOTA che divide un coin in piu parti, usata per codificare dati nel sistema |
| **Programmable TX Block** | Blocco di transazione programmabile di IOTA 2.0 che permette operazioni complesse in una singola transazione |
| **MAIN_DATA** | Indice globale leggero che elenca tutte le entita presenti nel sistema |
| **Hash SHA-256** | Funzione crittografica che produce un'impronta digitale univoca di 256 bit da qualsiasi dato in input |
| **WebSocket** | Protocollo di comunicazione bidirezionale in tempo reale tra browser e server |
| **PWA** | Progressive Web App: applicazione web che puo funzionare come app nativa su smartphone |
| **CSRF** | Cross-Site Request Forgery: tipo di attacco informatico prevenuto dal sistema |
| **Ex Art. 26** | Articolo 26 della Legge 833/1978 che disciplina la riabilitazione nel SSN |
| **Digest** | Impronta digitale univoca di una transazione blockchain, usata per verificarne l'integrita |
| **Graceful Degradation** | Capacita del sistema di continuare a funzionare (con funzionalita ridotte) anche in caso di problemi |

---

# PARTE 9: RIEPILOGO INFOGRAFICO

## Il Flusso in 5 Passi

```
PASSO 1: L'OPERATORE INSERISCE IL PAZIENTE
   L'operatore compila il modulo web con i dati del paziente.
   Il sistema conferma immediatamente l'inserimento.

         |
         v

PASSO 2: CRITTOGRAFIA AUTOMATICA
   I dati vengono cifrati con AES-256 + RSA-2048.
   Ogni paziente ha le proprie chiavi crittografiche.
   Nessuno puo leggere i dati senza autorizzazione.

         |
         v

PASSO 3: PUBBLICAZIONE SU BLOCKCHAIN
   I dati cifrati vengono pubblicati su IOTA 2.0.
   La transazione e immutabile e con timestamp certificato.
   Backup automatico su Arweave (storage permanente).

         |
         v

PASSO 4: IL PAZIENTE VERIFICA LA SUA POSIZIONE
   Il paziente accede alla pagina pubblica.
   Inserisce il codice fiscale (hashato nel browser).
   Vede la sua posizione senza esporre dati personali.

         |
         v

PASSO 5: CHIAMATA E PRESA IN CARICO
   Quando e il turno, l'operatore clicca "Chiama".
   Il passaggio di stato e registrato su blockchain.
   Il tempo di attesa viene calcolato e certificato.
```

## I 3 Pilastri del Sistema

```
          TRASPARENZA                SICUREZZA               RESILIENZA
    +-----------------+      +-----------------+      +-----------------+
    | Ogni operazione |      | Crittografia    |      | 3 livelli di    |
    | e tracciata su  |      | AES-256 + RSA   |      | ridondanza:     |
    | blockchain      |      | per ogni dato   |      | Cache + IOTA    |
    |                 |      |                 |      | + Arweave       |
    | Verifica        |      | Hash anonimo    |      |                 |
    | pubblica        |      | per privacy     |      | Recovery da     |
    | anonimizzata    |      | del paziente    |      | qualsiasi       |
    |                 |      |                 |      | disastro        |
    | Audit trail     |      | Chiavi per      |      |                 |
    | immutabile      |      | ogni entita     |      | Zero downtime   |
    +-----------------+      +-----------------+      +-----------------+
```

## Confronto Visivo: Prima e Dopo

```
PRIMA (Sistema Tradizionale)          DOPO (ExArt26 IOTA)
+---------------------------+         +---------------------------+
| Database centralizzato    |         | Blockchain distribuita    |
| Dati modificabili         |         | Dati immutabili           |
| Backup manuale            |         | Backup automatico 3x     |
| Nessuna trasparenza       |         | Verifica pubblica         |
| Audit log manipolabile    |         | Audit trail blockchain    |
| Vendor lock-in            |         | Dati pubblici su chain    |
| Single point of failure   |         | Migliaia di nodi          |
| Costi licenze DB          |         | Zero fee IOTA             |
+---------------------------+         +---------------------------+
```

---

Documento generato per ExArt26 IOTA - Sistema di Gestione Liste d'Attesa Decentralizzata su Blockchain IOTA 2.0
Versione: 1.0 - Marzo 2026
