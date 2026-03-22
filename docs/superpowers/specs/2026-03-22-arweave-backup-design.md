# Arweave Backup Permanente - Design Spec

## Obiettivo

Aggiungere Arweave come layer di backup permanente per tutti i dati scritti su IOTA. I dati cifrati RSA+AES vengono duplicati automaticamente su Arweave ad ogni operazione blockchain, garantendo recuperabilita anche dopo snapshot/pruning di IOTA.

## Architettura

```
Operazione (add-organizzazione, add-assistito, etc.)
    |
    +--> IOTA (primario, come oggi)
    |
    +--> Arweave (backup automatico, stesso payload cifrato)
              |
              +--> txId salvato nel DB locale per lookup veloce
```

## Componenti

### 1. ArweaveHelper.js (nuovo - api/utility/)

Modulo che incapsula tutte le interazioni con Arweave.

**Dipendenza**: `arweave` (npm package - arweave-js SDK)

**Configurazione**: legge wallet JWK da `config/private_arweave_conf.js` (gitignored). Se il file non esiste, Arweave e disabilitato e il sistema funziona solo con IOTA.

**Metodi**:

- `isEnabled()` - ritorna true se il wallet Arweave e configurato
- `uploadData(tag, encryptedPayload, entityId)` - carica dati cifrati su Arweave con tag metadata. Ritorna `{ success, txId, error }`. Non-bloccante: se fallisce, logga warning ma non blocca.
- `downloadByTag(tag, entityId)` - recupera l'ultima transazione per tag+entityId via GraphQL. Ritorna il payload decifrato o null.
- `getAllByTag(tag)` - lista tutte le transazioni con un tag specifico.

**Tag Arweave** (corrispondono ai TransactionDataType IOTA):
- `App-Name`: "exart26-iota"
- `Content-Type`: "application/json"
- `Data-Type`: il tag IOTA (MAIN_DATA, ASSISTITI_DATA, etc.)
- `Entity-Id`: ID dell'entita (opzionale)
- `Version`: messageVersion del payload

### 2. Modifica ListManager.js

Dopo ogni chiamata `iota.makeTransactionWithText()`, aggiungere:

```javascript
if (ArweaveHelper.isEnabled()) {
    ArweaveHelper.uploadData(tag, data, entityId)
        .catch(err => sails.log.warn('Arweave backup failed:', err.message));
}
```

Metodi da modificare:
- `updateOrganizzazioniStruttureListeToBlockchain()` - backup MAIN_DATA
- `updateDatiOrganizzazioneToBlockchain()` - backup ORGANIZZAZIONE_DATA
- `updateDatiStrutturaToBlockchain()` - backup STRUTTURE_LISTE_DATA
- `updateDatiAssistitoToBlockchain()` - backup ASSISTITI_DATA
- `updatePrivateKey()` - backup PRIVATE_KEY
- `aggiungiAssistitoInListaToBlockchain()` - backup LISTE_IN_CODA, MOVIMENTI_ASSISTITI_LISTA, ASSISTITI_IN_LISTA

### 3. Fallback nel recupero dati

Modifica `updateDBfromBlockchain()` e metodi di lettura:

```
1. Cerca transazione su IOTA
2. Se trovata -> usa quella (comportamento attuale)
3. Se NON trovata -> cerca su Arweave via tag
4. Se trovata su Arweave -> usa quella + logga "recovered from Arweave"
5. Se non trovata neanche su Arweave -> ritorna null (comportamento attuale)
```

### 4. Endpoint recupero manuale

`POST /api/v1/recover-from-arweave` (protetto da is-logged-in + is-super-admin)

Input: `{ dataType: string, entityId: string (opzionale) }`
Output: `{ success, data, source: "arweave" }`

### 5. UI Dashboard

Aggiungere nella dashboard:
- Indicatore "Arweave: Attivo/Non configurato"
- Bottone "Recupera da Arweave" nella sezione admin

### 6. Configurazione

File `config/private_arweave_conf.js` (gitignored):
```javascript
module.exports = {
    ARWEAVE_HOST: 'arweave.net',
    ARWEAVE_PORT: 443,
    ARWEAVE_PROTOCOL: 'https',
    ARWEAVE_WALLET_JWK: { /* wallet JSON key */ }
};
```

File `config/sample_private_arweave_conf.js` (committato, template):
```javascript
module.exports = {
    ARWEAVE_HOST: 'arweave.net',
    ARWEAVE_PORT: 443,
    ARWEAVE_PROTOCOL: 'https',
    ARWEAVE_WALLET_JWK: null // Inserire il wallet JWK qui
};
```

## Cosa NON cambia

- Crittografia RSA+AES (CryptHelper.js) resta identica
- Flusso IOTA resta il primario
- DB locale resta come cache operativa
- Se Arweave non e configurato, tutto funziona come prima

## Dipendenze npm

- `arweave`: "^1.15.0" (arweave-js SDK ufficiale)

## Rischi e mitigazioni

| Rischio | Mitigazione |
|---------|-------------|
| Upload Arweave lento (conferma ~20min) | Upload non-bloccante, operazione IOTA non attende |
| Wallet Arweave senza fondi | Check balance all'avvio, warning in dashboard |
| Rete Arweave down | Retry con backoff, log warning, IOTA continua |
| Costi imprevisti | I payload sono piccoli (KB), costi trascurabili |
