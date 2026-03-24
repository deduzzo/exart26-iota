const SyncCache = require('../utility/SyncCache');
const ListManager = require('../utility/ListManager');
const CryptHelper = require('../utility/CryptHelper');

module.exports = {

  friendlyName: 'Rimuovi assistito da lista',

  description: 'Rimuove un assistito dalla lista con gestione multi-lista.',

  inputs: {
    idAssistitoListe: {
      type: 'number',
      required: true,
      description: 'ID del record AssistitiListe principale da aggiornare',
    },
    stato: {
      type: 'number',
      required: true,
      description: 'Nuovo stato: 2=in assistenza, 3=completato, 4=cambio lista, 5=rinuncia, 6=annullato',
    },
    azioniAltreListe: {
      type: 'json',
      required: false,
      description: 'Array di azioni per le altre liste: [{ idAssistitoListe, azione: "mantieni"|"rimuovi", statoRimozione? }]',
    },
  },

  exits: {
    success: { description: 'Assistito rimosso dalla lista.' },
    invalid: { responseType: 'badRequest' },
  },

  fn: async function (inputs, exits) {
    const statiValidi = [2, 3, 4, 5, 6];
    if (!statiValidi.includes(inputs.stato)) {
      return exits.invalid({error: 'Stato non valido.'});
    }

    const record = await AssistitiListe.findOne({id: inputs.idAssistitoListe})
      .populate('assistito').populate('lista');
    if (!record) {
      return exits.invalid({error: 'Record non trovato.'});
    }
    if (record.stato !== 1) {
      return exits.invalid({error: 'L\'assistito non e in coda.'});
    }

    const assistitoNome = record.assistito ? `${record.assistito.cognome} ${record.assistito.nome}` : `#${record.assistito}`;
    sails.log.info(`[rimuovi] ${assistitoNome} rimosso da lista #${record.lista?.id || record.lista} con stato ${inputs.stato}`);

    // 1. Aggiorna il record principale
    const updated = await AssistitiListe.updateOne({id: inputs.idAssistitoListe}).set({
      stato: inputs.stato,
      chiuso: true,
      dataOraUscita: Date.now(),
    });

    // 2. Gestisci le altre liste
    const azioniAltreListe = inputs.azioniAltreListe || [];
    const risultatiAltreListe = [];

    for (const azione of azioniAltreListe) {
      if (azione.azione === 'rimuovi' && azione.idAssistitoListe) {
        const statoRimozione = azione.statoRimozione || 4; // default: cambio lista
        const altroRecord = await AssistitiListe.findOne({id: azione.idAssistitoListe});
        if (altroRecord && altroRecord.stato === 1) {
          await AssistitiListe.updateOne({id: azione.idAssistitoListe}).set({
            stato: statoRimozione,
            chiuso: true,
            dataOraUscita: Date.now(),
          });
          sails.log.info(`[rimuovi] ${assistitoNome} rimosso anche da lista #${altroRecord.lista} con stato ${statoRimozione}`);
          risultatiAltreListe.push({ id: azione.idAssistitoListe, azione: 'rimosso', stato: statoRimozione });
        }
      } else {
        risultatiAltreListe.push({ id: azione.idAssistitoListe, azione: 'mantenuto' });
      }
    }

    // 3. Blockchain publish in background
    setImmediate(async () => {
      try {
        const iota = require('../utility/iota');
        const {MOVIMENTI_ASSISTITI_LISTA} = require('../enums/TransactionDataType');
        const lista = await Lista.findOne({id: record.lista?.id || record.lista}).populate('struttura');
        if (lista && lista.struttura) {
          const movimentoData = {
            idAssistitoListe: record.id,
            assistito: record.assistito?.id || record.assistito,
            lista: lista.id,
            statoOld: 1,
            statoNew: inputs.stato,
            dataOraUscita: Date.now(),
            azioniAltreListe: risultatiAltreListe,
          };
          const entityId = await Lista.getWalletIdLista({id: lista.id});
          const encrypted = await CryptHelper.encryptAndSend(JSON.stringify(movimentoData), null, lista.struttura.publicKey);
          const res = await iota.publishData(MOVIMENTI_ASSISTITI_LISTA, encrypted.data, entityId);
          sails.log.info(`[rimuovi] Blockchain: MOVIMENTI ${res.success ? 'OK' : 'FAILED'}`);
        }
      } catch (err) {
        sails.log.warn('[rimuovi] Blockchain error:', err.message || err);
      }
    });

    SyncCache.markDirty('AssistitiListe');
      return exits.success({
      record: updated,
      altreListe: risultatiAltreListe,
      blockchainStatus: 'publishing',
      error: null,
    });
  }
};
