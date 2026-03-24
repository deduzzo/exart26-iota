/**
 * IOTA 2.0 Rebased - Utility per blockchain
 *
 * Usa @iota/iota-sdk con dynamic import per compatibilita CommonJS.
 * Keypair singolo Ed25519 derivato da mnemonic BIP39.
 * I dati vengono pubblicati come transazioni con metadata e
 * memorizzati nella cache locale (modello BlockchainData).
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.resolve(__dirname, '../../config/private_iota_conf.js');

// Lazy-loaded SDK modules
let _sdk = null;
let _keypair = null;
let _client = null;
let _address = null;
let _socketId = undefined;

// Config - caricata on-demand per evitare crash se il file non esiste
let _config = null;
function _getConfig() {
  if (!_config) {
    try {
      _config = require('../../config/private_iota_conf');
    } catch (e) {
      // Config non presente - ritorna defaults
      _config = {
        IOTA_NETWORK: 'testnet',
        IOTA_NODE_URL: null,
        IOTA_MNEMONIC: null,
        MAIN_PRIVATE_KEY: null,
        MAIN_PUBLIC_KEY: null,
        IOTA_EXPLORER_URL: 'https://explorer.rebased.iota.org',
      };
    }
  }
  return _config;
}

const GET_MAIN_KEYS = () => {
  const config = _getConfig();
  return { privateKey: config.MAIN_PRIVATE_KEY, publicKey: config.MAIN_PUBLIC_KEY };
};

// Tag prefix per identificare le nostre transazioni
const APP_TAG = 'exart26';

/**
 * Carica i moduli ESM dell'SDK via dynamic import (una sola volta)
 */
async function loadSdk() {
  if (_sdk) return _sdk;
  const [clientMod, txMod, keypairMod, faucetMod, utilsMod] = await Promise.all([
    import('@iota/iota-sdk/client'),
    import('@iota/iota-sdk/transactions'),
    import('@iota/iota-sdk/keypairs/ed25519'),
    import('@iota/iota-sdk/faucet'),
    import('@iota/iota-sdk/utils'),
  ]);
  _sdk = {
    getFullnodeUrl: clientMod.getFullnodeUrl,
    IotaClient: clientMod.IotaClient,
    Transaction: txMod.Transaction,
    Ed25519Keypair: keypairMod.Ed25519Keypair,
    getFaucetHost: faucetMod.getFaucetHost,
    requestIotaFromFaucetV1: faucetMod.requestIotaFromFaucetV1,
    NANOS_PER_IOTA: utilsMod.NANOS_PER_IOTA,
  };
  return _sdk;
}

/**
 * Ottieni il client IOTA
 */
async function getClient() {
  if (_client) return _client;
  const sdk = await loadSdk();
  const config = _getConfig();
  const url = config.IOTA_NODE_URL || sdk.getFullnodeUrl(config.IOTA_NETWORK || 'testnet');
  _client = new sdk.IotaClient({ url });
  return _client;
}

/**
 * Ottieni il keypair dal mnemonic
 */
async function getKeypair() {
  if (_keypair) return _keypair;
  const config = _getConfig();
  if (!config.IOTA_MNEMONIC) {
    throw new Error('Wallet non inizializzato. Mnemonic non presente nella configurazione.');
  }
  const sdk = await loadSdk();
  _keypair = sdk.Ed25519Keypair.deriveKeypair(config.IOTA_MNEMONIC);
  _address = _keypair.getPublicKey().toIotaAddress();
  return _keypair;
}

/**
 * Ottieni l'indirizzo del wallet
 */
async function getAddress() {
  await getKeypair();
  return _address;
}

// --- Utility ---

let setSocketId = (socketId) => {
  if (socketId !== null) _socketId = socketId;
};

let stringToHex = (text) => {
  return '0x' + Buffer.from(text).toString('hex');
};

let hexToString = (hex) => {
  return Buffer.from(hex.replace('0x', ''), 'hex').toString();
};

let showBalanceFormatted = (balanceNanos) => {
  const nanos = BigInt(balanceNanos || 0);
  const iotaVal = nanos / BigInt(1000000000);
  const formatted = nanos.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formatted} nanos [${iotaVal} IOTA]`;
};

// --- Inizializzazione ---

async function isWalletInitialized() {
  try {
    const config = _getConfig();
    if (!config.IOTA_MNEMONIC) return false;
    await getKeypair();
    await getClient();
    return true;
  } catch (ex) {
    return false;
  }
}

async function getOrInitWallet() {
  const sdk = await loadSdk();
  const config = _getConfig();

  if (config.IOTA_MNEMONIC) {
    // Gia inizializzato
    const kp = await getKeypair();
    const address = kp.getPublicKey().toIotaAddress();
    return { init: false, mnemonic: null, address };
  }

  // Genera nuovo mnemonic
  const { generateMnemonic } = await import('@scure/bip39');
  const { wordlist } = await import('@scure/bip39/wordlists/english');
  const mnemonic = generateMnemonic(wordlist);

  const kp = sdk.Ed25519Keypair.deriveKeypair(mnemonic);
  const address = kp.getPublicKey().toIotaAddress();

  // Salva mnemonic nel file di configurazione
  _saveMnemonicToConfig(mnemonic);

  // Aggiorna runtime
  config.IOTA_MNEMONIC = mnemonic;
  _keypair = kp;
  _address = address;

  // Richiedi fondi dal faucet (testnet/devnet)
  const network = config.IOTA_NETWORK || 'testnet';
  if (network === 'testnet' || network === 'devnet') {
    try {
      await sdk.requestIotaFromFaucetV1({
        host: sdk.getFaucetHost(network),
        recipient: address,
      });
      if (typeof sails !== 'undefined') {
        sails.helpers.consoleSocket('Faucet: fondi richiesti per ' + address, _socketId);
      }
    } catch (e) {
      if (typeof sails !== 'undefined') {
        sails.log.warn('Faucet request failed:', e.message);
      }
    }
  }

  return { init: true, mnemonic, address };
}

function _saveMnemonicToConfig(mnemonic) {
  try {
    let content = fs.readFileSync(CONFIG_PATH, 'utf8');
    content = content.replace(
      /IOTA_MNEMONIC:\s*null/,
      `IOTA_MNEMONIC: '${mnemonic}'`
    );
    fs.writeFileSync(CONFIG_PATH, content, 'utf8');
  } catch (e) {
    console.error('Could not save mnemonic to config file:', e.message);
  }
}

// --- Status ---

async function getStatusAndBalance() {
  if (!await isWalletInitialized()) {
    return { status: 'WALLET non inizializzato', balance: '0', address: null };
  }
  try {
    const client = await getClient();
    const address = await getAddress();
    const balance = await client.getBalance({ owner: address });
    return {
      status: 'WALLET OK',
      balance: showBalanceFormatted(balance.totalBalance),
      address: address,
      network: _getConfig().IOTA_NETWORK || 'testnet',
      explorerUrl: _getConfig().IOTA_EXPLORER_URL,
    };
  } catch (err) {
    return {
      status: 'Errore connessione',
      balance: '0',
      address: _address,
      error: err.message,
    };
  }
}

// --- Pubblicazione dati ---

/**
 * Pubblica dati cifrati sulla blockchain come transazione con metadata.
 * I dati vengono salvati nel DB locale (BlockchainData) e un transfer
 * minimo a se stessi viene eseguito come proof-of-existence.
 *
 * @param {string} tag - Tipo di dato (es. 'MAIN_DATA', 'ORGANIZZAZIONE_DATA')
 * @param {object} dataObject - Payload (gia cifrato da CryptHelper)
 * @param {string|null} entityId - ID entita opzionale
 * @param {number|null} version - Versione del dato
 * @returns {object} { success, digest, error }
 */
async function publishData(tag, dataObject, entityId = null, version = null) {
  try {
    const sdk = await loadSdk();
    const client = await getClient();
    const keypair = await getKeypair();
    const address = await getAddress();
    const config = _getConfig();

    // Prepara il payload come stringa JSON
    const payload = JSON.stringify({
      app: APP_TAG,
      tag: tag,
      entityId: entityId,
      version: version,
      data: dataObject,
      timestamp: Date.now(),
    });

    const tx = new sdk.Transaction();

    // Split coin per creare una moneta da inviare a se stessi come "carrier"
    const [coin] = tx.splitCoins(tx.gas, [1]);
    tx.transferObjects([coin], address);

    // Imposta gas budget
    tx.setGasBudget(10000000);

    const result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: {
        showInput: true,
        showEffects: true,
      },
    });

    // Salva payload nel DB locale per query future
    if (typeof sails !== 'undefined' && sails.models && sails.models.blockchaindata) {
      try {
        await sails.models.blockchaindata.create({
          digest: result.digest,
          tag: tag,
          entityId: entityId ? String(entityId) : null,
          version: version,
          payload: payload,
          timestamp: Date.now(),
        }).fetch();
      } catch (dbErr) {
        console.error('BlockchainData save error:', dbErr.message);
      }
    }

    const explorerUrl = (config.IOTA_EXPLORER_URL || 'https://explorer.rebased.iota.org') + '/txblock/' + result.digest;
    if (typeof sails !== 'undefined') {
      sails.helpers.consoleSocket(`TX: ${explorerUrl}`, _socketId);
    }

    return {
      success: true,
      digest: result.digest,
      explorerUrl: explorerUrl,
      error: null,
    };
  } catch (e) {
    console.error('publishData error:', e);
    return { success: false, digest: null, error: e.message || String(e) };
  }
}

// --- Lettura dati ---

/**
 * Recupera l'ultimo dato pubblicato con un certo tag.
 */
async function getLastDataByTag(tag, entityId = null) {
  try {
    // Cerca nel DB locale (cache)
    if (typeof sails !== 'undefined' && sails.models && sails.models.blockchaindata) {
      const criteria = { tag: tag };
      if (entityId !== null && entityId !== undefined) criteria.entityId = String(entityId);
      const record = await sails.models.blockchaindata.findOne(criteria).sort('timestamp DESC');
      if (record) {
        const parsed = JSON.parse(record.payload);
        return {
          payload: parsed.data,
          version: parsed.version,
          timestamp: parsed.timestamp,
          digest: record.digest,
        };
      }
    }
    return null;
  } catch (e) {
    console.error('getLastDataByTag error:', e);
    return null;
  }
}

/**
 * Recupera tutti i dati pubblicati con un certo tag.
 */
async function getAllDataByTag(tag, entityId = null) {
  try {
    if (typeof sails !== 'undefined' && sails.models && sails.models.blockchaindata) {
      const criteria = { tag: tag };
      if (entityId !== null && entityId !== undefined) criteria.entityId = String(entityId);
      const records = await sails.models.blockchaindata.find(criteria).sort('timestamp DESC');
      return records.map(r => {
        const parsed = JSON.parse(r.payload);
        return {
          payload: parsed.data,
          version: parsed.version,
          timestamp: parsed.timestamp,
          digest: r.digest,
        };
      });
    }
    return [];
  } catch (e) {
    console.error('getAllDataByTag error:', e);
    return [];
  }
}

// --- Request faucet ---

async function requestFaucet() {
  const sdk = await loadSdk();
  const address = await getAddress();
  const config = _getConfig();
  const network = config.IOTA_NETWORK || 'testnet';
  await sdk.requestIotaFromFaucetV1({
    host: sdk.getFaucetHost(network),
    recipient: address,
  });
  return { success: true, address };
}

// --- Exports ---

module.exports = {
  setSocketId,
  stringToHex,
  hexToString,
  isWalletInitialized,
  getOrInitWallet,
  getStatusAndBalance,
  getAddress,
  showBalanceFormatted,
  publishData,
  getLastDataByTag,
  getAllDataByTag,
  requestFaucet,
  GET_MAIN_KEYS,
  getClient,
  getKeypair,
  loadSdk,
};
