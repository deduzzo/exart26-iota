const pageTitle = 'Wallet Info';
const pageSubTitle = 'Verifica stato del wallet';

let iota = require('../../utility/iota');

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
      let res = await iota.getOrInitWallet();
      mainAddress = res.address;
      isWalletInitialized = res.init;
      initWallet = false;
      mnemonic = res.mnemonic;
    }
    else if (isWalletInitialized) {
      let statusInfo = await iota.getStatusAndBalance();
      mainAddress = statusInfo.address;
      balance = statusInfo.balance;
    }

    let iotaNetwork = 'testnet';
    try {
      iotaNetwork = require('../../../config/private_iota_conf').IOTA_NETWORK || 'testnet';
    } catch (e) {
      // Config non presente
    }
    return {
      pageTitle,
      pageSubTitle,
      isWalletInitialized,
      initWallet,
      mainAddress,
      mnemonic,
      iotaNetwork: iotaNetwork,
      balance: balance || iota.showBalanceFormatted(0)
    };
  }


};
