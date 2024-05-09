const iota = require('../../utility/iota');

module.exports = {


  friendlyName: 'Get wallet info info',


  description: '',


  inputs: {

  },


  exits: {

  },


  fn: async function (inputs) {
    return await iota.getStatusAndBalance();
  }


};
