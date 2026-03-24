const db = require('../utility/db');
const iota = require('../utility/iota');
const CryptHelper = require('../utility/CryptHelper');
const TransactionDataType = require('../enums/TransactionDataType');

module.exports = {

  friendlyName: 'API Debug',

  description: 'Ritorna tutti i dati del sistema: wallet, transazioni blockchain (con decryption), DB locale, cross-references.',

  inputs: {},

  exits: {
    success: {
      description: 'Dati debug completi.',
    },
  },

  fn: async function () {

    // 1. Wallet info
    let walletInfo = null;
    let walletInitialized = await iota.isWalletInitialized();
    if (walletInitialized) {
      try {
        walletInfo = await iota.getStatusAndBalance();
        walletInfo.hasMnemonic = true;
      } catch (e) {
        walletInfo = { status: 'Errore', error: e.message, hasMnemonic: false };
      }
    } else {
      walletInfo = { status: 'NON INIZIALIZZATO', hasMnemonic: false };
    }

    // 2. All transactions from blockchain grouped by tag
    const allTags = [
      TransactionDataType.MAIN_DATA,
      TransactionDataType.ORGANIZZAZIONE_DATA,
      TransactionDataType.STRUTTURE_LISTE_DATA,
      TransactionDataType.ASSISTITI_DATA,
      TransactionDataType.PRIVATE_KEY,
      TransactionDataType.LISTE_IN_CODA,
      TransactionDataType.ASSISTITI_IN_LISTA,
      TransactionDataType.MOVIMENTI_ASSISTITI_LISTA,
    ];

    const mainKeys = iota.GET_MAIN_KEYS();
    let blockchainTransactions = {};

    if (walletInitialized) {
      for (const tag of allTags) {
        try {
          const txs = await iota.getAllDataByTag(tag);
          const txResults = [];
          for (const tx of txs) {
            let decrypted = null;
            let decryptError = null;

            if (tx.payload && mainKeys.privateKey) {
              try {
                const data = tx.payload;
                if (data && data.message && data.key && data.iv) {
                  decrypted = await CryptHelper.receiveAndDecrypt(data, mainKeys.privateKey);
                } else {
                  decrypted = data;
                }
              } catch (e) {
                decryptError = e.message || 'Decrypt failed';
              }
            }

            txResults.push({
              digest: tx.digest,
              tag: tx.tag,
              entityId: tx.entityId,
              version: tx.version,
              timestamp: tx.timestamp,
              timestampFormatted: tx.timestamp ? new Date(tx.timestamp).toLocaleString('it-IT') : null,
              encryptedPayload: tx.payload,
              decryptedPayload: decrypted,
              decryptError: decryptError,
            });
          }
          blockchainTransactions[tag] = txResults;
        } catch (e) {
          blockchainTransactions[tag] = { error: e.message };
        }
      }
    }

    // 3. Local DB state (limited for performance)
    const organizzazioni = db.Organizzazione.find({}, { limit: 100 });
    const strutture = db.Struttura.find({}, { limit: 200 });
    const liste = db.Lista.find({}, { limit: 200 });
    const assistiti = db.Assistito.find({}, { limit: 200 });
    const assistitiListe = db.AssistitiListe.findWithDetails({}, { limit: 500 });
    const blockchainData = db.BlockchainData.find({}, { sort: 'timestamp DESC', limit: 500 });

    // Add org/liste info to strutture for display
    for (const str of strutture) {
      str.organizzazione = db.Organizzazione.findOne({id: str.organizzazione});
      str.liste = db.Lista.find({struttura: str.id});
    }

    // Add struttura info to liste
    for (const l of liste) {
      l.struttura = l.struttura ? db.Struttura.findOne({id: l.struttura}) : null;
    }

    // For DB output, include privateKey info (truncated) for debug
    const organizzazioniDebug = organizzazioni.map(o => ({
      ...o,
      hasPrivateKey: !!o.privateKey,
      hasPublicKey: !!o.publicKey,
      publicKeyTruncated: o.publicKey ? o.publicKey.substring(0, 60) + '...' : null,
      privateKeyTruncated: o.privateKey ? o.privateKey.substring(0, 60) + '...' : null,
    }));

    const struttureDebug = strutture.map(s => ({
      ...s,
      hasPrivateKey: !!s.privateKey,
      hasPublicKey: !!s.publicKey,
      publicKeyTruncated: s.publicKey ? s.publicKey.substring(0, 60) + '...' : null,
      privateKeyTruncated: s.privateKey ? s.privateKey.substring(0, 60) + '...' : null,
    }));

    const assistitiDebug = assistiti.map(a => ({
      ...a,
      hasPrivateKey: !!a.privateKey,
      hasPublicKey: !!a.publicKey,
      publicKeyTruncated: a.publicKey ? a.publicKey.substring(0, 60) + '...' : null,
      privateKeyTruncated: a.privateKey ? a.privateKey.substring(0, 60) + '...' : null,
    }));

    // 4. Cross-reference index — pre-build Maps for O(N+M) lookups
    const alByAssistito = new Map();
    for (const al of assistitiListe) {
      const assId = al.assistito;
      if (!alByAssistito.has(assId)) alByAssistito.set(assId, []);
      alByAssistito.get(assId).push(al);
    }

    const crossReferences = {
      organizzazioni: organizzazioni.map(org => {
        const orgTxs = Array.isArray(blockchainTransactions[TransactionDataType.ORGANIZZAZIONE_DATA])
          ? blockchainTransactions[TransactionDataType.ORGANIZZAZIONE_DATA].filter(tx => String(tx.entityId) === String(org.id))
          : [];
        const pkTxs = Array.isArray(blockchainTransactions[TransactionDataType.PRIVATE_KEY])
          ? blockchainTransactions[TransactionDataType.PRIVATE_KEY].filter(tx => String(tx.entityId) === String(org.id))
          : [];
        const bcCache = blockchainData.filter(bd => bd.entityId === String(org.id) && bd.tag === TransactionDataType.ORGANIZZAZIONE_DATA);

        return {
          id: org.id,
          denominazione: org.denominazione,
          hasPublicKey: !!org.publicKey,
          hasPrivateKey: !!org.privateKey,
          ultimaVersioneSuBlockchain: org.ultimaVersioneSuBlockchain,
          blockchainTxCount: orgTxs.length,
          blockchainTxDigests: orgTxs.map(tx => tx.digest),
          privateKeyOnChain: pkTxs.length > 0,
          privateKeyDigests: pkTxs.map(tx => tx.digest),
          localCacheCount: bcCache.length,
          status: orgTxs.length > 0 ? (org.publicKey ? 'consistent' : 'missing_keys') : (org.id ? 'not_on_blockchain' : 'missing'),
        };
      }),
      strutture: strutture.map(str => {
        const orgId = str.organizzazione ? (typeof str.organizzazione === 'object' ? str.organizzazione.id : str.organizzazione) : null;
        const entityId = orgId ? orgId + '_' + str.id : str.id;
        const strTxs = Array.isArray(blockchainTransactions[TransactionDataType.STRUTTURE_LISTE_DATA])
          ? blockchainTransactions[TransactionDataType.STRUTTURE_LISTE_DATA].filter(tx => String(tx.entityId) === String(entityId))
          : [];
        const pkTxs = Array.isArray(blockchainTransactions[TransactionDataType.PRIVATE_KEY])
          ? blockchainTransactions[TransactionDataType.PRIVATE_KEY].filter(tx => String(tx.entityId) === String(entityId))
          : [];

        return {
          id: str.id,
          denominazione: str.denominazione,
          organizzazioneId: orgId,
          entityId: entityId,
          hasPublicKey: !!str.publicKey,
          hasPrivateKey: !!str.privateKey,
          ultimaVersioneSuBlockchain: str.ultimaVersioneSuBlockchain,
          blockchainTxCount: strTxs.length,
          blockchainTxDigests: strTxs.map(tx => tx.digest),
          privateKeyOnChain: pkTxs.length > 0,
          listeCount: Array.isArray(str.liste) ? str.liste.length : 0,
          status: strTxs.length > 0 ? (str.publicKey ? 'consistent' : 'missing_keys') : (str.id ? 'not_on_blockchain' : 'missing'),
        };
      }),
      assistiti: assistiti.map(ass => {
        const entityId = iota.ASSISTITO_ACCOUNT_PREFIX + ass.id;
        const assTxs = Array.isArray(blockchainTransactions[TransactionDataType.ASSISTITI_DATA])
          ? blockchainTransactions[TransactionDataType.ASSISTITI_DATA].filter(tx => String(tx.entityId) === String(entityId))
          : [];
        const pkTxs = Array.isArray(blockchainTransactions[TransactionDataType.PRIVATE_KEY])
          ? blockchainTransactions[TransactionDataType.PRIVATE_KEY].filter(tx => String(tx.entityId) === String(entityId))
          : [];
        const assListe = alByAssistito.get(ass.id) || [];

        return {
          id: ass.id,
          nome: ass.nome,
          cognome: ass.cognome,
          codiceFiscale: ass.codiceFiscale,
          entityId: entityId,
          hasPublicKey: !!ass.publicKey,
          hasPrivateKey: !!ass.privateKey,
          ultimaVersioneSuBlockchain: ass.ultimaVersioneSuBlockchain,
          blockchainTxCount: assTxs.length,
          blockchainTxDigests: assTxs.map(tx => tx.digest),
          privateKeyOnChain: pkTxs.length > 0,
          listeAssegnate: assListe.map(al => ({
            id: al.id,
            listaId: al.lista,
            listaDenominazione: al.listaDenominazione || null,
            stato: al.stato,
            chiuso: al.chiuso,
            dataOraIngresso: al.dataOraIngresso,
            dataOraUscita: al.dataOraUscita,
          })),
          status: assTxs.length > 0 ? (ass.publicKey ? 'consistent' : 'missing_keys') : (ass.id ? 'not_on_blockchain' : 'missing'),
        };
      }),
    };

    return {
      wallet: walletInfo,
      blockchainTransactions,
      database: {
        organizzazioni: organizzazioniDebug,
        strutture: struttureDebug,
        liste,
        assistiti: assistitiDebug,
        assistitiListe,
        blockchainData,
      },
      crossReferences,
      meta: {
        timestamp: new Date().toISOString(),
        allTags,
        totalOrg: db.Organizzazione.count(),
        totalStr: db.Struttura.count(),
        totalListe: db.Lista.count(),
        totalAss: db.Assistito.count(),
        totalAL: db.AssistitiListe.count(),
        limited: true,
        displayLimit: 'Primi 100-500 record per tipo. Cross-reference basato solo sui record mostrati.',
      },
    };
  }
};
