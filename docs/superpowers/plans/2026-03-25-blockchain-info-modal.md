# Blockchain Info Modal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere icona info su ogni entita del sistema. Click apre modal con dati entita + activity log transazioni blockchain in tempo reale.

**Architecture:** Un componente `BlockchainInfoModal` riutilizzabile + un endpoint API `GET /api/v1/entity-transactions` che interroga la blockchain in tempo reale. L'icona info viene aggiunta nelle pagine Organizzazioni, Strutture, Assistiti, Liste, Grafo.

**Tech Stack:** React 19, Framer Motion, Lucide React (Info icon), Sails.js, iota.js

**Spec:** `docs/superpowers/specs/2026-03-25-blockchain-info-modal-design.md`

---

## File Structure

**Nuovi:**
- `api/controllers/api-entity-transactions.js` — Endpoint API
- `frontend/src/components/BlockchainInfoModal.jsx` — Modal riutilizzabile

**Modifiche:**
- `config/routes.js` — Aggiungere rotta
- `frontend/src/api/endpoints.js` — Aggiungere funzione API
- `frontend/src/pages/Organizzazioni.jsx` — Icona info nella colonna denominazione
- `frontend/src/pages/Strutture.jsx` — Icona info nella colonna denominazione
- `frontend/src/pages/Assistiti.jsx` — Icona info nella colonna assistito
- `frontend/src/pages/Liste.jsx` — Icona info su card lista, coda, storico
- `frontend/src/pages/Grafo.jsx` — Icona info nel pannello dettagli nodo

---

### Task 1: Backend — Endpoint API entity-transactions

**Files:**
- Create: `api/controllers/api-entity-transactions.js`
- Modify: `config/routes.js`

- [ ] **Step 1: Aggiungere rotta in config/routes.js**

Aggiungere prima della riga SPA catch-all:
```javascript
'GET    /api/v1/entity-transactions':   { action: 'api-entity-transactions' },
```

- [ ] **Step 2: Creare il controller**

```javascript
const iota = require('../utility/iota');
const TransactionDataType = require('../enums/TransactionDataType');

module.exports = {
  friendlyName: 'API Entity Transactions',
  description: 'Ritorna tutte le transazioni blockchain per una entita specifica.',
  inputs: {
    type: { type: 'string', required: true },
    entityId: { type: 'string', required: true },
  },
  exits: { success: {} },
  fn: async function (inputs, exits) {
    const { type, entityId } = inputs;

    // Determina quali tag cercare in base al tipo
    const tagsToSearch = [];
    switch (type) {
      case 'ORGANIZZAZIONE':
        tagsToSearch.push(
          { tag: TransactionDataType.ORGANIZZAZIONE_DATA, eid: entityId },
          { tag: TransactionDataType.PRIVATE_KEY, eid: entityId },
        );
        break;
      case 'STRUTTURA':
        tagsToSearch.push(
          { tag: TransactionDataType.STRUTTURE_LISTE_DATA, eid: entityId },
          { tag: TransactionDataType.PRIVATE_KEY, eid: entityId },
        );
        break;
      case 'ASSISTITO':
        tagsToSearch.push(
          { tag: TransactionDataType.ASSISTITI_DATA, eid: entityId },
          { tag: TransactionDataType.PRIVATE_KEY, eid: entityId },
        );
        break;
      case 'ASSISTITO_LISTA':
        tagsToSearch.push(
          { tag: TransactionDataType.ASSISTITI_IN_LISTA, eid: entityId },
          { tag: TransactionDataType.MOVIMENTI_ASSISTITI_LISTA, eid: entityId },
        );
        break;
      default:
        return exits.success({ entityType: type, entityId, transactions: [] });
    }

    // Query blockchain per ogni tag
    const transactions = [];
    const explorerBase = iota.getExplorerUrl ? iota.getExplorerUrl() : 'https://explorer.rebased.iota.org';

    for (const { tag, eid } of tagsToSearch) {
      try {
        const txs = await iota.getAllDataByTag(tag, eid);
        for (const tx of txs) {
          transactions.push({
            tag: tx.tag || tag,
            digest: tx.digest,
            version: tx.version || null,
            timestamp: tx.timestamp || null,
            timestampFormatted: tx.timestamp ? new Date(tx.timestamp).toLocaleString('it-IT') : null,
            explorerUrl: `${explorerBase}/txblock/${tx.digest}`,
          });
        }
      } catch (e) {
        // Skip errori per singolo tag
      }
    }

    // Ordina per timestamp DESC
    transactions.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    return exits.success({ entityType: type, entityId, transactions });
  }
};
```

- [ ] **Step 3: Commit**

```bash
git add api/controllers/api-entity-transactions.js config/routes.js
git commit -m "feat: endpoint GET /api/v1/entity-transactions per activity log blockchain"
```

---

### Task 2: Frontend — BlockchainInfoModal + API endpoint

**Files:**
- Create: `frontend/src/components/BlockchainInfoModal.jsx`
- Modify: `frontend/src/api/endpoints.js`

- [ ] **Step 1: Aggiungere funzione API in endpoints.js**

```javascript
// Entity transactions (blockchain activity log)
export const getEntityTransactions = (type, entityId) =>
  api(`/api/v1/entity-transactions?type=${type}&entityId=${entityId}`);
```

- [ ] **Step 2: Creare BlockchainInfoModal.jsx**

Componente modal riutilizzabile con:
- Props: `entityType`, `entityId`, `entityData`, `open`, `onClose`
- Sezione dati entita (campi principali)
- Activity log con loading spinner, lista transazioni con digest copiabile, explorer link
- Stile glassmorphism coerente con il progetto

Il componente deve:
1. Quando `open` diventa true, chiamare `getEntityTransactions(entityType, entityId)`
2. Mostrare spinner durante il caricamento
3. Mostrare la lista transazioni ordinate per timestamp DESC
4. Ogni transazione: tag badge, digest troncato con bottone copia, timestamp, link explorer
5. Sezione dati entita in alto con i campi principali dell'entita

Mapping entityId per il backend:
- ORGANIZZAZIONE: `entity.id.toString()`
- STRUTTURA: `entity.organizzazione + '_' + entity.id` (orgId_strId)
- ASSISTITO: `'ASS#' + entity.id`
- ASSISTITO_LISTA: l'entityId specifico del movimento

Il modal deve calcolare l'entityId corretto prima di chiamare l'API, in base all'entityType.

Stile: usa Modal esistente (`frontend/src/components/Modal.jsx`) come wrapper, oppure implementa un modal standalone glassmorphism con AnimatePresence di framer-motion.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/BlockchainInfoModal.jsx frontend/src/api/endpoints.js
git commit -m "feat: BlockchainInfoModal component + API endpoint function"
```

---

### Task 3: Icona info nelle pagine Organizzazioni + Strutture + Assistiti

**Files:**
- Modify: `frontend/src/pages/Organizzazioni.jsx`
- Modify: `frontend/src/pages/Strutture.jsx`
- Modify: `frontend/src/pages/Assistiti.jsx`

Queste tre pagine usano tutte il componente `DataTable` con colonne definite come array. L'icona info va aggiunta nella render function della colonna denominazione/nome.

- [ ] **Step 1: Organizzazioni.jsx**

1. Aggiungere imports: `import { Info } from 'lucide-react'` (se non presente) e `import BlockchainInfoModal from '../components/BlockchainInfoModal'`
2. Aggiungere state: `const [infoModal, setInfoModal] = useState(null)` (null o { entityType, entityId, entityData })
3. Nella colonna "Denominazione" (riga ~21), wrappare il render con l'icona Info:
```jsx
render: (v, row) => (
  <div className="flex items-center gap-1.5">
    <span className="font-medium text-slate-100">{v}</span>
    <button onClick={(e) => { e.stopPropagation(); setInfoModal({ entityType: 'ORGANIZZAZIONE', entityId: String(row.id), entityData: row }); }}
      className="text-slate-500 hover:text-neon-cyan transition-colors"><Info size={14} /></button>
  </div>
)
```
4. Aggiungere il modal nel JSX (prima della chiusura del componente):
```jsx
<BlockchainInfoModal
  open={!!infoModal}
  onClose={() => setInfoModal(null)}
  entityType={infoModal?.entityType}
  entityId={infoModal?.entityId}
  entityData={infoModal?.entityData}
/>
```

- [ ] **Step 2: Strutture.jsx**

Stesso pattern. Colonna "Denominazione" (riga ~55). entityType='STRUTTURA', entityId=`row.organizzazione + '_' + row.id`. Nota: `row.organizzazione` potrebbe essere un oggetto (da populate) o un numero — gestire entrambi i casi.

- [ ] **Step 3: Assistiti.jsx**

Stesso pattern. Colonna "Assistito" (riga ~72). entityType='ASSISTITO', entityId=`'ASS#' + row.id`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Organizzazioni.jsx frontend/src/pages/Strutture.jsx frontend/src/pages/Assistiti.jsx
git commit -m "feat: icona info blockchain su Organizzazioni, Strutture, Assistiti"
```

---

### Task 4: Icona info nella pagina Liste (card + coda + storico)

**Files:**
- Modify: `frontend/src/pages/Liste.jsx`

Tre punti di inserzione nella stessa pagina.

- [ ] **Step 1: Aggiungere imports e state**

```javascript
import { Info } from 'lucide-react';
import BlockchainInfoModal from '../components/BlockchainInfoModal';
// ...
const [infoModal, setInfoModal] = useState(null);
```

- [ ] **Step 2: Icona nella card lista (riga ~197)**

Accanto a `<h3 className="font-semibold text-sm">{lista.denominazione}</h3>`:
```jsx
<div className="flex items-center gap-1.5">
  <h3 className="font-semibold text-sm">{lista.denominazione}</h3>
  <button onClick={(e) => { e.stopPropagation(); setInfoModal({ entityType: 'STRUTTURA', entityId: lista.struttura + '_' + lista.id, entityData: lista }); }}
    className="text-slate-500 hover:text-neon-cyan transition-colors"><Info size={14} /></button>
</div>
```

Nota: Le liste sono incluse nelle transazioni STRUTTURE_LISTE_DATA della struttura padre. L'entityId e `orgId_strId`.

- [ ] **Step 3: Icona nella coda (riga ~328)**

Accanto al nome dell'assistito nella coda:
```jsx
<div className="flex items-center gap-1.5">
  <p className="font-medium text-sm">{item.assistito?.cognome} {item.assistito?.nome}</p>
  <button onClick={() => setInfoModal({ entityType: 'ASSISTITO', entityId: 'ASS#' + item.assistito?.id, entityData: item.assistito })}
    className="text-slate-500 hover:text-neon-cyan transition-colors"><Info size={14} /></button>
</div>
```

- [ ] **Step 4: Icona nello storico (riga ~365)**

Stesso pattern della coda, accanto al nome nello storico.

- [ ] **Step 5: Aggiungere il modal nel JSX**

```jsx
<BlockchainInfoModal open={!!infoModal} onClose={() => setInfoModal(null)} {...infoModal} />
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Liste.jsx
git commit -m "feat: icona info blockchain su Liste (card, coda, storico)"
```

---

### Task 5: Icona info nella pagina Grafo

**Files:**
- Modify: `frontend/src/pages/Grafo.jsx`

- [ ] **Step 1: Aggiungere imports e state**

```javascript
import { Info } from 'lucide-react';
import BlockchainInfoModal from '../components/BlockchainInfoModal';
const [infoModal, setInfoModal] = useState(null);
```

- [ ] **Step 2: Icona nel pannello dettagli nodo (riga ~278)**

Nel HoverPanel, accanto a `{node.label}`:

```jsx
<div className="flex items-center gap-2">
  <div className="flex-1 min-w-0">
    <p className="text-xs uppercase tracking-wider" style={{ color: typeInfo.color }}>{typeInfo.label}</p>
    <p className="text-white font-semibold truncate max-w-[240px]">{node.label}</p>
  </div>
  <button onClick={() => {
    // Mappare node.type al entityType e entityId corretti
    const mapping = {
      organizzazione: { entityType: 'ORGANIZZAZIONE', entityId: String(node.data.id) },
      struttura: { entityType: 'STRUTTURA', entityId: node.data.organizzazione + '_' + node.data.id },
      assistito: { entityType: 'ASSISTITO', entityId: 'ASS#' + node.data.id },
    };
    const m = mapping[node.type];
    if (m) setInfoModal({ ...m, entityData: node.data });
  }} className="text-slate-400 hover:text-neon-cyan transition-colors">
    <Info size={14} />
  </button>
</div>
```

- [ ] **Step 3: Aggiungere il modal**

```jsx
<BlockchainInfoModal open={!!infoModal} onClose={() => setInfoModal(null)} {...infoModal} />
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Grafo.jsx
git commit -m "feat: icona info blockchain nel grafo interattivo"
```

---

### Task 6: Build frontend + verifica

- [ ] **Step 1: Build**

```bash
cd frontend && npm run build
```

Zero errori.

- [ ] **Step 2: Verifica visuale**

Aprire ogni pagina e verificare che l'icona info appaia correttamente.

- [ ] **Step 3: Commit finale se serve**
