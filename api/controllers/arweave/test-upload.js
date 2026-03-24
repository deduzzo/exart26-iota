const ArweaveHelper = require('../../utility/ArweaveHelper');

module.exports = {
  friendlyName: 'Arweave Test Upload',
  description: 'Esegue un upload di test su Arweave per verificare la connettivita.',
  inputs: {},
  exits: { success: {} },
  fn: async function () {
    const result = await ArweaveHelper.testUpload();
    return result;
  }
};
