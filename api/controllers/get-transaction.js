module.exports = {


  friendlyName: 'Get transaction by digest',


  description: 'Recupera una transazione dalla cache locale BlockchainData tramite digest.',


  inputs: {
    digest: {
      type: 'string',
      required: true,
      description: 'Transaction digest (hash) sulla blockchain IOTA'
    },
    // Mantiene compatibilita con vecchie chiamate (ignorati)
    accountName: {
      type: 'string',
      required: false
    },
    transactionId: {
      type: 'string',
      required: false
    }
  },


  exits: {

  },


  fn: async function (inputs) {
    const digestOrId = inputs.digest || inputs.transactionId;
    if (!digestOrId) {
      return { transaction: null, error: 'digest o transactionId richiesto' };
    }
    let record = await BlockchainData.findOne({ digest: digestOrId });
    if (record) {
      return { transaction: JSON.parse(record.payload) };
    }
    return { transaction: null };
  }


};
