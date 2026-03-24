// Configurazione IOTA 2.0 Rebased
// Copiare questo file come private_iota_conf.js
//
// Per generare le chiavi RSA:
//   node -e "require('./api/utility/CryptHelper').RSAGenerateKeyPair().then(k => console.log(JSON.stringify(k, null, 2)))"

module.exports = {
  // Rete: 'testnet' | 'mainnet' | 'devnet'
  IOTA_NETWORK: 'testnet',

  // URL nodo custom (null = usa il default della rete selezionata)
  IOTA_NODE_URL: null,

  // Mnemonic BIP39 per il keypair Ed25519
  // Viene generato automaticamente al primo avvio se null
  IOTA_MNEMONIC: null,

  // Chiavi RSA-2048 per crittografia dei dati
  MAIN_PRIVATE_KEY: 'YOUR_RSA_PRIVATE_KEY',
  MAIN_PUBLIC_KEY: 'YOUR_RSA_PUBLIC_KEY',

  // Explorer URL
  IOTA_EXPLORER_URL: 'https://explorer.rebased.iota.org',
};
