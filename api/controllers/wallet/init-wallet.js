const iota = require('../../utility/iota');

module.exports = {

  friendlyName: 'Init wallet',

  description: 'Inizializza il wallet IOTA 2.0 (genera mnemonic, richiede faucet).',

  inputs: {},

  exits: {},

  fn: async function () {
    try {
      const isInitialized = await iota.isWalletInitialized();
      if (isInitialized) {
        const status = await iota.getStatusAndBalance();
        return {
          success: true,
          alreadyInitialized: true,
          address: status.address,
          balance: status.balance,
          network: status.network,
        };
      }

      const result = await iota.getOrInitWallet();
      const status = await iota.getStatusAndBalance();

      return {
        success: true,
        alreadyInitialized: false,
        mnemonic: result.mnemonic,
        address: status.address,
        balance: status.balance,
        network: status.network,
      };
    } catch (err) {
      const msg = (err && err.message) ? err.message : String(err);
      sails.log.warn('Wallet init error: ' + msg);
      return {
        success: false,
        error: msg,
      };
    }
  }

};
