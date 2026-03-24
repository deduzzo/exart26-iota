const ArweaveHelper = require('../../utility/ArweaveHelper');

module.exports = {
  friendlyName: 'Arweave Transactions',
  description: 'Ritorna le transazioni Arweave per un dato tipo, utile per debug.',
  inputs: {
    dataType: {
      type: 'string',
      required: true,
      description: 'Tipo di dato (es. ORGANIZZAZIONE_DATA, STRUTTURE_LISTE_DATA, ASSISTITI_DATA).'
    },
    limit: {
      type: 'number',
      defaultsTo: 20,
      description: 'Numero massimo di transazioni da ritornare.'
    }
  },
  exits: { success: {} },
  fn: async function (inputs) {
    const transactions = await ArweaveHelper.getTransactionsForDebug(inputs.dataType, inputs.limit);
    return transactions;
  }
};
