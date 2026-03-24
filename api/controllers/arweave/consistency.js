const ArweaveHelper = require('../../utility/ArweaveHelper');
const iota = require('../../utility/iota');

module.exports = {
  friendlyName: 'Arweave Consistency',
  description: 'Verifica la consistenza tra le transazioni IOTA e i backup Arweave.',
  inputs: {},
  exits: { success: {} },
  fn: async function () {
    const iotaTxs = {};
    const types = ['ORGANIZZAZIONE_DATA', 'STRUTTURE_LISTE_DATA', 'ASSISTITI_DATA'];

    for (const type of types) {
      iotaTxs[type] = await iota.getAllDataByTag(type);
    }

    const result = await ArweaveHelper.getConsistency(iotaTxs);
    return result;
  }
};
