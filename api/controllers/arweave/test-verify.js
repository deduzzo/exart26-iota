const ArweaveHelper = require('../../utility/ArweaveHelper');

module.exports = {
  friendlyName: 'Arweave Test Verify',
  description: 'Verifica una transazione Arweave per ID.',
  inputs: {
    txId: {
      type: 'string',
      required: true,
      description: 'ID della transazione Arweave da verificare.'
    }
  },
  exits: { success: {} },
  fn: async function (inputs) {
    const result = await ArweaveHelper.testVerify(inputs.txId);
    return result;
  }
};
