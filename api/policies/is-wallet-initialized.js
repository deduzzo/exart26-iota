// policies/is-wallet-initialized.js
const iota = require('../utility/iota');
module.exports = async function (req, res, proceed) {
  let isWalletInitialized = await iota.isWalletInitialized();
  if (isWalletInitialized) {
    return proceed();
  }

  // Per le richieste API, restituire JSON
  if (req.wantsJSON || req.path.startsWith('/api/')) {
    return res.status(503).json({
      status: 'WALLET non inizializzato',
      message: 'Il wallet IOTA non e ancora inizializzato. Accedere a /wallet/verifica per configurarlo.'
    });
  }

  // Per le pagine, redirect alla verifica wallet
  return res.redirect('/wallet/verifica');
};
