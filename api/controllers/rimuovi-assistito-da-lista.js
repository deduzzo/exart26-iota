const ListManager = require('../utility/ListManager');

module.exports = {

  friendlyName: 'Rimuovi assistito da lista',

  description: 'Rimuove un assistito dalla lista (preso in carico / completato / rinuncia / ecc.)',

  inputs: {
    idAssistitoListe: {
      type: 'number',
      required: true,
      description: 'ID del record AssistitiListe da aggiornare',
    },
    stato: {
      type: 'number',
      required: true,
      description: 'Nuovo stato: 2=in assistenza, 3=completato, 4=cambio lista, 5=rinuncia, 6=annullato',
    },
  },

  exits: {
    success: { description: 'Assistito rimosso dalla lista.' },
    invalid: { responseType: 'badRequest' },
  },

  fn: async function (inputs, exits) {
    const statiValidi = [2, 3, 4, 5, 6]; // tutto tranne INSERITO_IN_CODA (1)
    if (!statiValidi.includes(inputs.stato)) {
      return exits.invalid({error: 'Stato non valido. Valori: 2=in assistenza, 3=completato, 4=cambio lista, 5=rinuncia, 6=annullato'});
    }

    const record = await AssistitiListe.findOne({id: inputs.idAssistitoListe}).populate('assistito').populate('lista');
    if (!record) {
      return exits.invalid({error: 'Record non trovato.'});
    }
    if (record.stato !== 1) {
      return exits.invalid({error: 'L\'assistito non e in coda (stato attuale: ' + record.stato + ').'});
    }

    sails.log.info(`[rimuovi] Assistito #${record.assistito?.id || record.assistito} rimosso da lista #${record.lista?.id || record.lista} con stato ${inputs.stato}`);

    // Aggiorna il record
    const updated = await AssistitiListe.updateOne({id: inputs.idAssistitoListe}).set({
      stato: inputs.stato,
      chiuso: true,
      dataOraUscita: Date.now(),
    });

    // Blockchain publish in background
    setImmediate(async () => {
      try {
        const manager = new ListManager();
        // Pubblica il movimento sulla blockchain
        const CryptHelper = require('../utility/CryptHelper');
        const iota = require('../utility/iota');
        const lista = await Lista.findOne({id: record.lista?.id || record.lista}).populate('struttura');
        if (lista && lista.struttura) {
          const movimentoData = {
            idAssistitoListe: record.id,
            assistito: record.assistito?.id || record.assistito,
            lista: lista.id,
            statoOld: 1,
            statoNew: inputs.stato,
            dataOraUscita: Date.now(),
          };
          const {MOVIMENTI_ASSISTITI_LISTA} = require('../enums/TransactionDataType');
          const entityId = await Lista.getWalletIdLista({id: lista.id});
          const encrypted = await CryptHelper.encryptAndSend(JSON.stringify(movimentoData), null, lista.struttura.publicKey);
          const res = await iota.publishData(MOVIMENTI_ASSISTITI_LISTA, encrypted.data, entityId);
          sails.log.info(`[rimuovi] Blockchain: MOVIMENTI ${res.success ? 'OK' : 'FAILED'}`);
        }
      } catch (err) {
        sails.log.warn('[rimuovi] Blockchain error:', err.message || err);
      }
    });

    return exits.success({
      record: updated,
      blockchainStatus: 'publishing',
      error: null,
    });
  }
};
