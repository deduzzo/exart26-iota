const ArweaveHelper = require('../utility/ArweaveHelper');
const CryptHelper = require('../utility/CryptHelper');
const iota = require('../utility/iota');
const ListManager = require('../utility/ListManager');

module.exports = {

  friendlyName: 'Recover from Arweave',

  description: 'Recupera i dati dalla blockchain Arweave come fallback.',

  inputs: {
    dataType: {
      type: 'string',
      required: false,
      description: 'Tipo di dato da recuperare (MAIN_DATA, ASSISTITI_DATA, etc.). Se vuoto, recupera tutto.'
    },
    entityId: {
      type: 'string',
      required: false,
      description: 'ID entita specifica da recuperare.'
    }
  },

  exits: {
    success: {
      description: 'Dati recuperati con successo da Arweave.',
    },
    invalid: {
      responseType: 'badRequest',
      description: 'Arweave non configurato o errore nel recupero.'
    }
  },

  fn: async function (inputs, exits) {
    if (!ArweaveHelper.isEnabled()) {
      return exits.invalid({error: 'Arweave non configurato.'});
    }

    try {
      let manager = new ListManager();
      let result = await manager.updateDBfromBlockchain();
      return exits.success({
        success: result.success,
        source: result.source || 'unknown',
        message: result.success
          ? `Dati recuperati con successo da ${result.source || 'blockchain'}.`
          : 'Nessun dato trovato su IOTA ne su Arweave.'
      });
    } catch (e) {
      sails.log.error('Recover from Arweave error:', e);
      return exits.invalid({error: e.message});
    }
  }
};
