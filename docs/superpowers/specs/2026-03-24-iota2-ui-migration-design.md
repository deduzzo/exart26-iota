# ExArt26 IOTA - Migrazione IOTA 2.0 + UI Moderna

## Panoramica

Migrazione completa del progetto ExArt26 da IOTA Stardust (`@iota/sdk` v1.1.5) a IOTA 2.0 Rebased (`@iota/iota-sdk`) e riscrittura completa dell'interfaccia utente con React + Vite + TailwindCSS.

## Obiettivi

1. Passare a IOTA 2.0 Rebased con testnet e faucet disponibili
2. Semplificare l'architettura blockchain (keypair singolo, eventi Move)
3. UI moderna futuristica (dark mode, glassmorphism, neon gradients)
4. PWA per supporto mobile
5. Documentazione aggiornata

---

## WS1: Migrazione IOTA 2.0 SDK

### Decisioni architetturali

| Decisione | Scelta | Motivazione |
|-----------|--------|-------------|
| Keypair | Singolo Ed25519 per tutto | Semplifica gestione, riduce costi |
| Storage on-chain | Eventi Move (non oggetti) | Simile a tagged data, costo basso, immutabili |
| ESM compatibility | Dynamic `import()` in iota.js | Zero impatto su Sails.js (CommonJS) |
| Rete default | Testnet (con faucet) | Sviluppo e test gratuiti |

### File: `api/utility/iota.js` (riscrittura completa)

**Dipendenze nuove:**
```javascript
// Caricati via dynamic import()
import { getFullnodeUrl, IotaClient } from '@iota/iota-sdk/client';
import { Transaction } from '@iota/iota-sdk/transactions';
import { Ed25519Keypair } from '@iota/iota-sdk/keypairs/ed25519';
```

**Interfaccia pubblica (mantenuta compatibile dove possibile):**

```javascript
// Inizializzazione
isWalletInitialized() → boolean
getOrInitWallet() → { init, mnemonic, address }
getStatusAndBalance() → { status, balance, address }
getAddress() → string (hex 0x...)

// Scrittura dati (sostituisce makeTransactionWithText)
publishData(tag, dataObject, entityId?, version?) → { success, digest, error }

// Lettura dati (sostituisce getLastTransactionOfAccountWithTag)
getLastDataByTag(tag, entityId?) → { payload, version, timestamp } | null
getAllDataByTag(tag, entityId?) → array

// Utility
stringToHex(text) → string
hexToString(hex) → string
showBalanceFormatted(balance) → string
setSocketId(socketId) → void
GET_MAIN_KEYS() → { privateKey, publicKey }
```

**Dettaglio inizializzazione keypair:**
- Al primo avvio: genera mnemonic BIP39, deriva keypair Ed25519
- Salva mnemonic in `config/private_iota_conf.js` (campo IOTA_MNEMONIC)
- Le sessioni successive: carica keypair dal mnemonic salvato

**Dettaglio pubblicazione dati (publishData):**
```
1. Costruisce Programmable Transaction Block
2. Chiama moveCall per emettere un evento con:
   - sender: indirizzo del keypair
   - tag: stringa (es. "MAIN_DATA")
   - entityId: stringa opzionale (es. "ORG#1")
   - payload: dati cifrati (hex string)
   - version: numero versione
3. Firma e invia con il keypair
4. Ritorna { success, digest (tx hash), error }
```

**Dettaglio lettura dati (getLastDataByTag):**
```
1. Usa client.queryEvents() con filtro per:
   - sender: nostro indirizzo
   - eventType: tipo evento del nostro modulo Move
2. Filtra per tag e entityId nei dati dell'evento
3. Ordina per timestamp decrescente
4. Ritorna il primo (ultimo in ordine temporale)
```

**Nota su Move package:** Per emettere eventi custom serve un modulo Move deployato sulla rete. Se non disponibile, si usa come fallback la funzione `transferObjects` con un memo/metadata nel PTB. La spec prevede di verificare la disponibilita di un modulo Move semplice per eventi, altrimenti usare il pattern transfer+metadata.

### File: `api/utility/ListManager.js` (adattamento)

**Cambiamenti:**
- Rimuovere tutti i riferimenti a `getOrCreateWalletAccount()` e account multipli
- Sostituire `iota.makeTransactionWithText(account, addr, TAG, data)` con `iota.publishData(TAG, data, entityId)`
- Sostituire `iota.getLastTransactionOfAccountWithTag(account, TAG)` con `iota.getLastDataByTag(TAG, entityId)`
- Rimuovere pattern `JSON.parse(iota.hexToString(transazione.payload.essence.payload.data))` - la nuova API ritorna direttamente l'oggetto payload
- Rimuovere `getOrCreateWalletAccount`, `getAllWalletAccountsMatching`, `waitUntilBalanceIsGreaterThanZero`
- Metodo `updatePrivateKey()`: non piu account separato, usa publishData con entityId = walletId
- Metodo `aggiungiAssistitoInListaToBlockchain()`: semplificato senza gestione account/fondi multipli

**Esempio trasformazione:**
```javascript
// PRIMA (Stardust)
let orgAccount = await iota.getOrCreateWalletAccount(walletId);
let res = await iota.makeTransactionWithText(orgAccount, addr, ORGANIZZAZIONE_DATA, data.data);

// DOPO (Rebased)
let res = await iota.publishData(ORGANIZZAZIONE_DATA, data.data, idOrganizzazione, version);
```

### File: `config/private_iota_conf.js` (semplificato)

```javascript
module.exports = {
  // Rete IOTA 2.0
  IOTA_NETWORK: 'testnet',           // 'testnet' | 'mainnet' | 'devnet'
  IOTA_NODE_URL: null,               // null = usa default della rete

  // Keypair (generato al primo avvio)
  IOTA_MNEMONIC: null,               // BIP39 mnemonic, generato automaticamente

  // Chiavi RSA per crittografia dati (invariate)
  MAIN_PRIVATE_KEY: 'YOUR_PRIVATE_KEY',
  MAIN_PUBLIC_KEY: 'YOUR_PUBLIC_KEY',

  // Move package ID (opzionale, per eventi custom)
  MOVE_PACKAGE_ID: null,

  // Explorer
  IOTA_EXPLORER_URL: 'https://explorer.rebased.iota.org',
};
```

### File: `config/bootstrap.js` (adattamento minimo)

- Cambiare `iota.isWalletInitialized()` (stessa firma, nuova implementazione)
- Il `ListManager.updateDBfromBlockchain()` funziona gia con la nuova interfaccia

### File rimossi/non piu necessari
- `wallet-db/` directory (Stronghold non piu usato)
- Concetto di `TRANSACTION_VALUE`, `ACCOUNT_BASE_BALANCE` (niente piu trasferimenti fondi tra account)

---

## WS2: UI Moderna (React + Vite + TailwindCSS)

### Struttura

```
frontend/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── public/
│   ├── manifest.json          # PWA manifest
│   └── icons/                 # Icone PWA
└── src/
    ├── main.jsx               # Entry point
    ├── App.jsx                # Router principale
    ├── index.css              # Tailwind imports + custom styles
    ├── api/
    │   ├── client.js          # Fetch wrapper con CSRF
    │   └── endpoints.js       # Definizione API endpoints
    ├── components/
    │   ├── Layout.jsx         # Layout con sidebar + topbar
    │   ├── Sidebar.jsx        # Navigazione laterale
    │   ├── StatsCard.jsx      # Card statistica animata
    │   ├── DataTable.jsx      # Tabella dati riutilizzabile
    │   ├── Modal.jsx          # Modale glassmorphism
    │   ├── StatusBadge.jsx    # Badge stato (blockchain, arweave)
    │   ├── LoadingSpinner.jsx # Spinner animato
    │   └── Toast.jsx          # Notifiche toast
    ├── pages/
    │   ├── Dashboard.jsx      # Stats + stato blockchain + ultime operazioni
    │   ├── Organizzazioni.jsx # CRUD organizzazioni
    │   ├── Strutture.jsx      # CRUD strutture (filtro per org)
    │   ├── Assistiti.jsx      # CRUD assistiti + ricerca
    │   ├── Liste.jsx          # Gestione liste + inserimento assistiti
    │   └── Wallet.jsx         # Stato wallet, init, explorer
    ├── hooks/
    │   ├── useApi.js          # Hook fetch con loading/error
    │   └── useWebSocket.js    # Hook Socket.io per feedback real-time
    └── utils/
        └── formatters.js      # Formattazione date, numeri, etc.
```

### Design System

**Palette colori:**
- Background: `#0a0a1a` (quasi nero) → `#111827` (grigio scuro)
- Card: `rgba(255,255,255,0.05)` con `backdrop-blur-xl`
- Accento primario: `#06b6d4` (cyan) → `#8b5cf6` (purple) gradient
- Accento secondario: `#10b981` (emerald) per successo
- Warning: `#f59e0b` (amber)
- Danger: `#ef4444` (red)
- Testo: `#f1f5f9` (chiaro) / `#94a3b8` (muted)

**Effetti:**
- Glassmorphism: `bg-white/5 backdrop-blur-xl border border-white/10`
- Neon glow: `shadow-[0_0_15px_rgba(6,182,212,0.3)]` sui bordi attivi
- Transizioni: Framer Motion per mount/unmount pagine, hover su card
- Gradient animati sulla sidebar e header

**Componenti chiave:**
- Card con bordi luminosi al hover
- Sidebar collassabile con icone animate
- Stats card con counter animato (count-up)
- Tabelle con righe hover glow
- Modal con backdrop blur
- Toast notifiche con slide-in

### Dipendenze frontend

```json
{
  "dependencies": {
    "react": "^19",
    "react-dom": "^19",
    "react-router-dom": "^7",
    "framer-motion": "^12",
    "socket.io-client": "^4",
    "lucide-react": "latest"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4",
    "vite": "^6",
    "tailwindcss": "^4",
    "autoprefixer": "latest",
    "postcss": "latest"
  }
}
```

### Comunicazione Backend

- **API REST**: tutte le chiamate passano per `/api/v1/*` (gia esistenti)
- **CSRF**: il frontend chiama `GET /csrfToken` all'avvio e include il token in ogni richiesta mutativa
- **WebSocket**: Socket.io client per feedback real-time operazioni blockchain
- **Proxy Vite**: in sviluppo, Vite proxya `/api/*` e `/socket.io/*` verso Sails.js sulla porta 1337

### Adattamento Backend per SPA

- `config/routes.js`: aggiungere catch-all route che serve `index.html` per tutte le rotte non-API
- `config/security.js`: configurare CORS per permettere richieste dal dev server Vite (porta 5173)
- Rimuovere le view EJS e i relativi controller `view-*` (sostituiti dalle pagine React)
- Mantenere i controller API (`add-organizzazione`, `add-struttura`, etc.)

---

## WS3: Integrazione

- Collegare frontend React al backend Sails.js
- Test end-to-end del flusso completo: crea organizzazione → cifra → scrivi su IOTA 2.0 → backup Arweave → leggi → decifra
- Configurare build di produzione: `vite build` → output in `assets/` o `.tmp/public/`
- WebSocket feedback per operazioni blockchain

## WS4: Documentazione

- README.md: aggiornato con nuovo stack, nuove istruzioni setup, screenshot nuova UI
- CLAUDE.md: aggiornato con nuova architettura, nuovi comandi, nuove dipendenze
- Guida migrazione dati da Stardust (se necessario)

---

## Piano di esecuzione con agenti paralleli

```
Tempo  Agent 1 (IOTA 2.0)          Agent 2 (Frontend)
─────  ─────────────────────        ──────────────────
  T0   iota.js riscrittura          frontend/ scaffold
  T1   ListManager adattamento      componenti base (Layout, Sidebar, Card)
  T2   config + bootstrap           pagine (Dashboard, Organizzazioni, ...)
  T3   controller wallet fix        hooks API + WebSocket
       ─────────────────────────────────────────────────
  T4          Agent 3: Integrazione + Test
  T5          Agent 4: Documentazione
```

## Rischi e mitigazioni

| Rischio | Mitigazione |
|---------|-------------|
| Move events non supportati senza modulo custom | Fallback: usare transfer + metadata nel PTB |
| ESM dynamic import problemi con Sails.js | Testare subito all'inizio, prima di riscrivere tutto |
| API IOTA 2.0 instabili su testnet | Error handling robusto, fallback Arweave gia presente |
| Socket.io tra Vite dev e Sails.js | Proxy configurato in vite.config.js |
