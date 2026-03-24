/**
 * Configurazione Arweave per backup permanente.
 *
 * Copiare questo file come `private_arweave_conf.js` e inserire il wallet JWK.
 * Il file private_arweave_conf.js e nel .gitignore e non verra committato.
 *
 * Per generare un wallet Arweave:
 *   1. Andare su https://arweave.app/wallet
 *   2. Creare un nuovo wallet
 *   3. Scaricare il file JSON (JWK)
 *   4. Copiare il contenuto del file JSON nel campo ARWEAVE_WALLET_JWK
 *
 * Per finanziare il wallet (testnet):
 *   https://faucet.arweave.net/
 */
module.exports = {
  ARWEAVE_HOST: 'arweave.net',
  ARWEAVE_PORT: 443,
  ARWEAVE_PROTOCOL: 'https',
  ARWEAVE_WALLET_JWK: null, // Inserire qui il contenuto del file JWK (oggetto JSON)
  ARWEAVE_LOCAL_PORT: 1984, // Porta per ArLocal in modalita test (opzionale, default 1984)
};
