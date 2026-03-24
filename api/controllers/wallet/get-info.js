const iota = require('../../utility/iota');

module.exports = {

  friendlyName: 'Get wallet info',

  description: 'Restituisce le informazioni sullo stato del wallet IOTA.',

  inputs: {},

  exits: {},

  fn: async function () {
    try {
      return await iota.getStatusAndBalance();
    } catch (err) {
      let msg = (err && err.error) ? err.error : (err && err.message) ? err.message : String(err);
      return {
        status: 'Errore connessione',
        balance: '0',
        address: null,
        error: msg
      };
    }
  }

};
