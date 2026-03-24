/**
 * Policy Mappings
 * (sails.config.policies)
 *
 * Policies are simple functions which run **before** your actions.
 *
 * For more information on configuring policies, check out:
 * https://sailsjs.com/docs/concepts/policies
 */

module.exports.policies = {
  // Tutte le rotte sono pubbliche (nessuna autenticazione richiesta)
  '*': true,

  // Wallet: tutte le rotte sono pubbliche (get-info gestisce gia il caso non inizializzato)
  'wallet/*': true,

  // Admin routes: solo verifica wallet
  'fetch-db-from-blockchain': 'is-wallet-initialized',
  'recover-from-arweave': 'is-wallet-initialized',
};
