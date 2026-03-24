const ListManager = require('../utility/ListManager');
module.exports = {

  friendlyName: 'Aggiorna db da blockchain',

  description: 'Aggiorna il database locale con i dati presenti nella cache blockchain.',

  inputs: {},

  exits: {
    success: {
      description: 'All done.',
    },
  },

  fn: async function () {
    sails.log.info('[fetch-db] Avvio sincronizzazione manuale...');
    try {
      const manager = new ListManager();
      const res = await manager.updateDBfromBlockchain();
      if (res.success) {
        sails.log.info(`[fetch-db] Sync completata da ${res.source}, organizzazioni: ${res.data ? res.data.length : 0}`);
      } else {
        sails.log.info('[fetch-db] Nessun dato trovato nella cache BlockchainData.');
      }
      return { success: res.success, source: res.source || null, dataImported: res.data };
    } catch (err) {
      sails.log.error('[fetch-db] Errore:', err.message);
      return { success: false, error: err.message };
    }
  }

};
