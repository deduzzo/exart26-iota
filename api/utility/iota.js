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

// Prefisso entityId per assistiti (compatibilita con Assistito.getWalletIdAssistito)
const ASSISTITO_ACCOUNT_PREFIX = 'ASS#';

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
  const { wordlist } = await import('@scure/bip39/wordlists/english.js');
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

// --- Encoding/Decoding payload in transazioni ---
// I dati vengono codificati come u64 split-coin amounts nella transazione.
// Ogni chunk: 1 byte indice + 7 bytes dati = 8 bytes = 1 u64
// Il primo split ha amount = 1 (marker), il secondo = lunghezza payload.
// I successivi contengono i chunks del payload codificati.

const CHUNK_DATA_SIZE = 6; // 6 bytes dati + 2 bytes indice = 8 bytes = 1 u64

function _encodePayloadToChunks(payloadStr) {
  const payloadBytes = Buffer.from(payloadStr);
  const chunks = [];
  for (let i = 0; i < payloadBytes.length; i += CHUNK_DATA_SIZE) {
    const chunk = payloadBytes.subarray(i, i + CHUNK_DATA_SIZE);
    const buf = Buffer.alloc(8, 0);
    // 2 bytes per indice (Big Endian) - supporta fino a 65535 chunks (~393KB)
    const chunkIdx = Math.floor(i / CHUNK_DATA_SIZE);
    buf[0] = (chunkIdx >> 8) & 0xFF;
    buf[1] = chunkIdx & 0xFF;
    chunk.copy(buf, 2);
    chunks.push(BigInt('0x' + buf.toString('hex')));
  }
  return { chunks, length: payloadBytes.length };
}

function _decodeChunksToPayload(u64Values, payloadLength) {
  const buffers = u64Values.map(val => {
    const hex = BigInt(val).toString(16).padStart(16, '0');
    return Buffer.from(hex, 'hex');
  });
  // New format: 2-byte index (Big Endian) + 6 bytes data
  buffers.sort((a, b) => ((a[0] << 8) | a[1]) - ((b[0] << 8) | b[1]));
  const combined = Buffer.concat(buffers.map(b => b.subarray(2)));
  return combined.subarray(0, payloadLength).toString();
}

/**
 * Pubblica dati cifrati sulla blockchain IOTA 2.0.
 * Il payload viene codificato interamente negli amounts delle split-coin
 * della transazione. ZERO database locale - tutto on-chain.
 *
 * Struttura transazione:
 *  - split[0] amount=1 (marker exart26)
 *  - split[1] amount=payloadLength
 *  - split[2..N] amount=chunk (7 bytes dati + 1 byte indice)
 *  - Tutti trasferiti a se stessi
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

    const payload = JSON.stringify({
      app: APP_TAG,
      tag: tag,
      entityId: entityId,
      version: version,
      data: dataObject,
      timestamp: Date.now(),
    });

    const { chunks, length: payloadLength } = _encodePayloadToChunks(payload);

    const tx = new sdk.Transaction();

    // Amounts: [1 (marker), payloadLength, ...dataChunks]
    const allAmounts = [BigInt(1), BigInt(payloadLength), ...chunks];
    const coins = tx.splitCoins(tx.gas, allAmounts.map(a => tx.pure.u64(a)));

    // Trasferisci tutti a noi stessi
    for (let i = 0; i < allAmounts.length; i++) {
      tx.transferObjects([coins[i]], address);
    }

    // Gas budget proporzionale alla dimensione dei dati
    tx.setGasBudget(Math.max(10000000, chunks.length * 500000));

    sails.log.info(`[iota] publishData: tag=${tag} entityId=${entityId} payload=${payloadLength}bytes chunks=${chunks.length}`);

    const result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: { showInput: true, showEffects: true },
    });

    // Aspetta conferma
    await client.waitForTransaction({ digest: result.digest });

    const explorerUrl = (config.IOTA_EXPLORER_URL || 'https://explorer.rebased.iota.org') + '/txblock/' + result.digest;
    sails.log.info(`[iota] publishData OK: digest=${result.digest}`);
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
    console.error('[iota] publishData error:', e.message || e);
    return { success: false, digest: null, error: e.message || String(e) };
  }
}

// --- Lettura dati dalla blockchain ---

/**
 * Decodifica il payload da una transazione IOTA 2.0.
 * Legge gli input u64 della transazione e ricostruisce il JSON.
 */
function _decodeTransactionPayload(txDetail) {
  try {
    const inputs = txDetail.transaction?.data?.transaction?.inputs || [];
    const u64Inputs = inputs.filter(i => i.valueType === 'u64').map(i => BigInt(i.value));

    // Verifica marker (primo u64 deve essere 1)
    if (u64Inputs.length < 3 || u64Inputs[0] !== BigInt(1)) return null;

    const payloadLength = Number(u64Inputs[1]);
    const dataChunks = u64Inputs.slice(2);

    const payloadStr = _decodeChunksToPayload(dataChunks, payloadLength);
    const parsed = JSON.parse(payloadStr);

    // Verifica che sia una nostra transazione
    if (parsed.app !== APP_TAG) return null;

    return parsed;
  } catch (e) {
    return null;
  }
}

/**
 * Recupera tutte le transazioni exart26 dalla blockchain per il nostro indirizzo.
 * Filtra per tag e entityId.
 */
async function _queryTransactionsFromChain(tag = null, entityId = null, maxResults = 500) {
  try {
    const client = await getClient();
    const address = await getAddress();

    const results = [];
    let cursor = null;
    let hasMore = true;

    // Paginazione: continua a chiedere finche ci sono risultati
    while (hasMore && results.length < maxResults) {
      const opts = {
        filter: { FromAddress: address },
        options: { showInput: true },
        limit: 50,
        order: 'descending',
      };
      if (cursor) opts.cursor = cursor;

      const txBlocks = await client.queryTransactionBlocks(opts);

      for (const tx of txBlocks.data) {
        const decoded = _decodeTransactionPayload(tx);
        if (!decoded) continue;
        if (tag && decoded.tag !== tag) continue;
        if (entityId !== null && entityId !== undefined && String(decoded.entityId) !== String(entityId)) continue;
        results.push({
          payload: decoded.data,
          version: decoded.version,
          timestamp: decoded.timestamp,
          digest: tx.digest,
          tag: decoded.tag,
          entityId: decoded.entityId,
        });
      }

      hasMore = txBlocks.hasNextPage;
      cursor = txBlocks.nextCursor;
    }

    return results;
  } catch (e) {
    console.error('[iota] _queryTransactionsFromChain error:', e.message);
    return [];
  }
}

/**
 * Recupera l'ultimo dato pubblicato con un certo tag dalla blockchain.
 * ZERO database locale - legge direttamente dalla chain.
 */
async function getLastDataByTag(tag, entityId = null) {
  const results = await _queryTransactionsFromChain(tag, entityId, 50);
  return results.length > 0 ? results[0] : null;
}

/**
 * Recupera tutti i dati pubblicati con un certo tag dalla blockchain.
 */
async function getAllDataByTag(tag, entityId = null) {
  return await _queryTransactionsFromChain(tag, entityId, 100);
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

/**
 * Reset dello stato runtime (per reinizializzazione wallet).
 */
function _resetRuntime() {
  _keypair = null;
  _client = null;
  _address = null;
  _config = null;
  // Forza il reload del config alla prossima chiamata
  delete require.cache[require.resolve('../../config/private_iota_conf')];
}

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
  _resetRuntime,
  ASSISTITO_ACCOUNT_PREFIX,
};
