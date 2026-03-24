const ArweaveHelper = require('../../utility/ArweaveHelper');

module.exports = {
  friendlyName: 'Arweave Status',
  description: 'Ritorna lo stato dettagliato di Arweave (configurazione, modo, statistiche).',
  inputs: {},
  exits: { success: {} },
  fn: async function () {
    const status = await ArweaveHelper.getDetailedStatus();
    return status;
  }
};
