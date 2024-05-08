let iota = require('../../utility/iota');

module.exports = {


  friendlyName: 'View verifica',


  description: 'Display "Verifica" page.',


  exits: {

    success: {
      viewTemplatePath: 'pages/wallet/verifica'
    }

  },


  fn: async function () {
    await iota.getOrInitWallet();
    return {isWalletInitialized: await iota.isWalletInitialized()};
  }


};
