# Design: Modal Info Transazioni Blockchain

**Data**: 2026-03-25
**Stato**: Approvato

## Obiettivo

Aggiungere un'icona info su ogni entita del sistema (organizzazioni, strutture, liste, assistiti, movimenti lista). Cliccandola si apre un modal con i dati dell'entita e l'activity log completo delle transazioni blockchain associate, caricato in tempo reale dalla chain.

## Componente: BlockchainInfoModal

Componente React riutilizzabile.

**Props:**
- `entityType` — stringa: 'ORGANIZZAZIONE', 'STRUTTURA', 'LISTA', 'ASSISTITO', 'ASSISTITO_LISTA'
- `entityId` — ID dell'entita (numero o stringa)
- `entityData` — oggetto con i dati dell'entita (denominazione, CF, etc.) per la sezione dati
- `open` — boolean
- `onClose` — callback

**Layout del modal:**

```
┌─ ℹ️ ASL Roma 1 (Organizzazione) ──────────────┐
│                                                 │
│ ── Dati Entita ──                               │
│ ID: 1                                           │
│ Denominazione: ASL Roma 1                       │
│ Chiave Pubblica: MIIBIjANBg...  [copia]        │
│ Versione BC: 3                                  │
│ Creato: 25/03/2026 14:30                        │
│                                                 │
│ ── Activity Log (5 transazioni) ──              │
│                                                 │
│ 🟢 ORGANIZZAZIONE_DATA v3                       │
│    Digest: abc123...def456  [copia] [explorer]  │
│    25/03/2026 14:30:15                          │
│                                                 │
│ 🟢 PRIVATE_KEY                                  │
│    Digest: 789abc...012def  [copia] [explorer]  │
│    25/03/2026 14:30:12                          │
│                                                 │
│ 🟢 ORGANIZZAZIONE_DATA v2                       │
│    Digest: fed321...cba987  [copia] [explorer]  │
│    24/03/2026 10:15:03                          │
│                                                 │
│ ... (scroll)                                    │
│                                                 │
│                                    [Chiudi]     │
└─────────────────────────────────────────────────┘
```

## API Backend

### Nuovo endpoint

```
GET /api/v1/entity-transactions?type=ORGANIZZAZIONE&entityId=1
```

**Controller:** `api/controllers/api-entity-transactions.js`

**Logica:**
1. Riceve `type` e `entityId` come query params
2. Determina i tag blockchain da cercare in base al tipo di entita:
   - ORGANIZZAZIONE: cerca ORGANIZZAZIONE_DATA + PRIVATE_KEY con entityId = orgId
   - STRUTTURA: cerca STRUTTURE_LISTE_DATA + PRIVATE_KEY con entityId = orgId_strId
   - LISTA: nessuna transazione dedicata (inclusa in STRUTTURE_LISTE_DATA della struttura)
   - ASSISTITO: cerca ASSISTITI_DATA + PRIVATE_KEY con entityId = ASS#assId
   - ASSISTITO_LISTA: cerca ASSISTITI_IN_LISTA + MOVIMENTI_ASSISTITI_LISTA con entityId appropriato
3. Per ogni tag, chiama `iota.getAllDataByTag(tag, entityId)` in tempo reale
4. Aggrega i risultati, ordina per timestamp DESC
5. Ritorna array di transazioni

**Risposta:**
```json
{
  "entityType": "ORGANIZZAZIONE",
  "entityId": "1",
  "transactions": [
    {
      "tag": "ORGANIZZAZIONE_DATA",
      "digest": "abc123...def456",
      "version": 3,
      "timestamp": 1711367415000,
      "timestampFormatted": "25/03/2026 14:30:15",
      "explorerUrl": "https://explorer.rebased.iota.org/txblock/abc123..."
    },
    {
      "tag": "PRIVATE_KEY",
      "digest": "789abc...012def",
      "version": null,
      "timestamp": 1711367412000,
      "timestampFormatted": "25/03/2026 14:30:12",
      "explorerUrl": "https://explorer.rebased.iota.org/txblock/789abc..."
    }
  ]
}
```

## Mapping entityId per tipo

Per costruire l'entityId corretto da passare a `iota.getAllDataByTag`:

| Tipo | entityId usato sulla chain | Come calcolarlo |
|------|---------------------------|-----------------|
| ORGANIZZAZIONE | `orgId` (es. "1") | `entity.id.toString()` |
| STRUTTURA | `orgId_strId` (es. "1_5") | `entity.organizzazione + '_' + entity.id` |
| LISTA | Parte di STRUTTURE_LISTE_DATA della struttura padre | `orgId_strId` della struttura |
| ASSISTITO | `ASS#assId` (es. "ASS#42") | `'ASS#' + entity.id` |
| ASSISTITO_LISTA | Varia per tag | Dipende dal contesto |

## Posizionamento icona info nelle pagine

### Organizzazioni (`/app/organizzazioni`)
- Icona `<Info>` accanto al nome di ogni organizzazione nella lista/card

### Strutture (`/app/strutture`)
- Icona `<Info>` accanto al nome di ogni struttura

### Assistiti (`/app/assistiti`)
- Icona `<Info>` accanto al nome di ogni assistito nella tabella

### Liste (`/app/liste`)
- Icona `<Info>` accanto al nome di ogni lista (nella card header)
- Icona `<Info>` accanto a ogni assistito nella coda (posizioni #1, #2...)
- Icona `<Info>` accanto a ogni movimento nello storico

### Grafo (`/app/grafo`)
- Icona `<Info>` nel pannello dettagli del nodo selezionato

### Dashboard (`/app`)
- Non necessario (la dashboard mostra solo contatori aggregati)

## Stile

- Icona: `<Info size={14} />` da lucide-react
- Colore: `text-slate-500 hover:text-neon-cyan transition-colors cursor-pointer`
- Modal: stile glassmorphism coerente con il progetto (bg-slate-900/95 backdrop-blur-xl border-white/10)
- Activity log: `max-h-80 overflow-y-auto` con scroll
- Ogni transazione: card con bordo sottile, digest troncato con copia, link explorer
- Loading: spinner centrato nel modal durante il caricamento
- Errore: messaggio inline nel modal

## File da creare/modificare

**Nuovo:**
- `frontend/src/components/BlockchainInfoModal.jsx` — Componente modal riutilizzabile
- `api/controllers/api-entity-transactions.js` — Endpoint API

**Modifiche:**
- `frontend/src/api/endpoints.js` — Aggiungere `getEntityTransactions(type, entityId)`
- `config/routes.js` — Aggiungere rotta `GET /api/v1/entity-transactions`
- `frontend/src/pages/Organizzazioni.jsx` — Aggiungere icona info
- `frontend/src/pages/Strutture.jsx` — Aggiungere icona info (se esiste come pagina separata)
- `frontend/src/pages/Assistiti.jsx` — Aggiungere icona info (se esiste)
- `frontend/src/pages/Liste.jsx` — Aggiungere icona info su card lista, coda, storico
- `frontend/src/pages/Grafo.jsx` — Aggiungere icona info nel pannello dettagli nodo

## Dipendenze

Nessuna nuova dipendenza. Usa componenti e icone gia presenti (lucide-react, framer-motion).
