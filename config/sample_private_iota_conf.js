// Rinominare il file in private_keys.js
// per generare le chiavi private e pubbliche è possibile usare il risultato della funzione:
// await CryptHelper.RSAGenerateKeyPair()

const {sep} = require('path');
const {CoinType} = require("@iota/sdk");

module.exports = {
  COIN_TYPE: CoinType.Shimmer,
  MAIN_PRIVATE_KEY: 'YOUR_PRIVATE_KEY',
  MAIN_PUBLIC_KEY: 'YOUR_PUBLIC_KEY',
  IOTA_STRONGHOLD_PASSWORD: 'a-secure-password',
  IOTA_WALLET_DB_PATH: 'wallet-db',
  IOTA_NODE_URL: 'https://api.testnet.shimmer.network',
  IOTA_EXPLORER_URL: 'https://explorer.shimmer.network/testnet',
  IOTA_STRONGHOLD_SNAPSHOT_PATH: 'wallet-db' + sep + 'vault.stronghold',
  IOTA_MAIN_ACCOUNT_ALIAS: 'main-account',
  TRANSACTION_VALUE: BigInt(100000),
  ACCOUNT_BASE_BALANCE: BigInt(500000),
  TRANSACTION_ZERO_VALUE: BigInt(0),
};
