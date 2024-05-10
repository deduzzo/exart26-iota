let iota = require('../utility/iota');

module.exports = {


  friendlyName: 'Get transaction by acountName and transactionId',


  description: '',


  inputs: {
    // accountName and transactionId
    accountName: {
      type: 'string',
      required: true
    },
    transactionId: {
      type: 'string',
      required: true
    }
  },


  exits: {

  },


  fn: async function (inputs) {
    let transaction = await iota.getTransactionByAccountNameAndId(inputs.accountName, inputs.transactionId);
    return {transaction};

  }


};
