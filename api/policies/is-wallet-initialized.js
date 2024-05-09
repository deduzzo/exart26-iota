// policies/is-wallet-initialized.js
const iota = require('../utility/iota');
module.exports = async function (req, res, proceed) {
  let isWalletInitialized = await iota.isWalletInitialized();
  if (isWalletInitialized) {
    return proceed();
  }

  // redirect to wallet/verifica
  return res.redirect('/wallet/verifica');

};
