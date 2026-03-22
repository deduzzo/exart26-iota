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
  '*': 'is-logged-in',

  // Public routes - no auth needed
  'view-homepage-or-redirect': true,
  'entrance/*': true,
  'security/*': true,

  // Wallet routes need auth + wallet check
  'wallet/*': ['is-logged-in', 'is-wallet-initialized'],

  // API routes need auth
  'add-organizzazione': 'is-logged-in',
  'add-struttura': 'is-logged-in',
  'add-lista': 'is-logged-in',
  'add-assistito': 'is-logged-in',
  'add-assistito-in-lista': 'is-logged-in',
  'fetch-db-from-blockchain': ['is-logged-in', 'is-super-admin'],
  'recover-from-arweave': ['is-logged-in', 'is-super-admin'],
};
