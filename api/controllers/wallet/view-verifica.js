let iota = require('../../utility/iota');
const {IOTA_NODE_URL} = require('../../../config/private_iota_conf');

module.exports = {


  friendlyName: 'View verifica',


  description: 'Display "Verifica" page.',

  inputs: {
    initWallet: {
      type: 'boolean',
      description: 'If true, the wallet will be initialized',
      required: false,
      defaultsTo: false
    }
  },
  exits: {

    success: {
      viewTemplatePath: 'pages/wallet/verifica'
    }

  },


  fn: async function ({initWallet}) {
    let mnemonic = null;
    let mainAddress = null;
    let balance = null;
    let isWalletInitialized = await iota.isWalletInitialized();
    if (initWallet && !isWalletInitialized) {
      let res = await iota.getOrInitWallet(false);
      mainAddress = await iota.getFirstAddressOfAnAccount(res.mainAccount);
      isWalletInitialized = res.init;
      initWallet = false;
      mnemonic = res.mnemonic;
    }
    else if (isWalletInitialized) {
      let mainAccount = await iota.getMainAccount();
      mainAddress = await iota.getFirstAddressOfAnAccount(mainAccount);
      balance = await iota.getAccountBalance(mainAccount);
    }
    return {
      isWalletInitialized,
      initWallet,
      mainAddress,
      mnemonic,
      iotaNetwork: IOTA_NODE_URL,
      balance: iota.showBalanceFormatted(balance)
    };
  }


};
