const ArweaveHelper = require('../../utility/ArweaveHelper');

module.exports = {
  friendlyName: 'Arweave Switch Mode',
  description: 'Cambia la modalita di Arweave tra production e test.',
  inputs: {
    mode: {
      type: 'string',
      required: true,
      isIn: ['production', 'test'],
      description: 'Modalita Arweave: production o test.'
    }
  },
  exits: { success: {} },
  fn: async function (inputs) {
    const result = await ArweaveHelper.switchMode(inputs.mode);
    return result;
  }
};
