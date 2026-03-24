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

            return {
              digest: tx.digest,
              tag: tx.tag,
              entityId: tx.entityId,
              version: tx.version,
              timestamp: tx.timestamp,
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

    // 3. Local DB state - fetch all records with relationships
    const organizzazioni = await Organizzazione.find().populate('strutture');
    const strutture = await Struttura.find().populate('organizzazione').populate('liste');
    const liste = await Lista.find().populate('struttura');
    const assistiti = await Assistito.find();
    const assistitiListe = await AssistitiListe.find().populate('assistito').populate('lista');
    const blockchainData = await BlockchainData.find().sort('createdAt DESC');

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

    // 4. Cross-reference index
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
        const entityId = str.organizzazione ? (typeof str.organizzazione === 'object' ? str.organizzazione.id : str.organizzazione) + '_' + str.id : str.id;
        const strTxs = Array.isArray(blockchainTransactions[TransactionDataType.STRUTTURE_LISTE_DATA])
          ? blockchainTransactions[TransactionDataType.STRUTTURE_LISTE_DATA].filter(tx => String(tx.entityId) === String(entityId))
          : [];
        const pkTxs = Array.isArray(blockchainTransactions[TransactionDataType.PRIVATE_KEY])
          ? blockchainTransactions[TransactionDataType.PRIVATE_KEY].filter(tx => String(tx.entityId) === String(entityId))
          : [];

        return {
          id: str.id,
          denominazione: str.denominazione,
          organizzazioneId: typeof str.organizzazione === 'object' ? str.organizzazione.id : str.organizzazione,
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
        const assListe = assistitiListe.filter(al => {
          const assId = typeof al.assistito === 'object' ? al.assistito.id : al.assistito;
          return assId === ass.id;
        });

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
            listaId: typeof al.lista === 'object' ? al.lista.id : al.lista,
            listaDenominazione: typeof al.lista === 'object' ? al.lista.denominazione : null,
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
        timestamp: Date.now(),
        allTags,
      },
    };
  }
};
