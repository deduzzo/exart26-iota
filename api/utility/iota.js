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
const zlib = require('zlib');

const CONFIG_PATH = path.resolve(__dirname, '../../config/private_iota_conf.js');

// Lazy-loaded SDK modules
let _sdk = null;
let _keypair = null;
let _client = null;
let _address = null;
let _socketId = undefined;

// Lock sequenziale per TX: IOTA non permette TX parallele dallo stesso wallet
let _txQueue = Promise.resolve();
function _enqueueTx(fn) {
  _txQueue = _txQueue.then(fn, fn);
  return _txQueue;
}

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

function _encodePayloadToChunks(payload) {
  const payloadBytes = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf8');
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

function _decodeChunksToBuffer(u64Values, payloadLength) {
  const buffers = u64Values.map(val => {
    const hex = BigInt(val).toString(16).padStart(16, '0');
    return Buffer.from(hex, 'hex');
  });
  // New format: 2-byte index (Big Endian) + 6 bytes data
  buffers.sort((a, b) => ((a[0] << 8) | a[1]) - ((b[0] << 8) | b[1]));
  const combined = Buffer.concat(buffers.map(b => b.subarray(2)));
  return combined.subarray(0, payloadLength);
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
// Contatore TX pending per monitoraggio
let _pendingTxCount = 0;

async function publishData(tag, dataObject, entityId = null, version = null) {
  // Serializza le TX: IOTA non permette TX parallele dallo stesso wallet
  _pendingTxCount++;
  try {
    const result = await _enqueueTx(() => _publishDataWithRetry(tag, dataObject, entityId, version));
    return result;
  } finally {
    _pendingTxCount--;
  }
}

function getPendingTxCount() { return _pendingTxCount; }

async function _publishDataWithRetry(tag, dataObject, entityId = null, version = null, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await _publishDataImpl(tag, dataObject, entityId, version);
    if (result.success) return result;

    // Se e un errore di equivocation/conflict, aspetta e riprova
    const retryable = result.error && (
      result.error.includes('equivocation') ||
      result.error.includes('ObjectVersionUnavailableForConsumption') ||
      result.error.includes('Could not find the referenced object')
    );

    if (retryable && attempt < maxRetries) {
      const wait = attempt * 2000;
      sails.log.warn(`[iota] publishData retry ${attempt}/${maxRetries} per ${tag}:${entityId} tra ${wait}ms (${result.error.substring(0, 80)})`);
      await new Promise(r => setTimeout(r, wait));
    } else {
      if (attempt > 1) sails.log.warn(`[iota] publishData FALLITA dopo ${attempt} tentativi per ${tag}:${entityId}`);
      return result;
    }
  }
}

// Max chunks per singola TX (1024 comandi - overhead splitCoins batch - transfers)
const MAX_CHUNKS_PER_TX = 500;
// Max payload compresso per singola "parte" di una chain (con margine per wrapper)
const MAX_PART_BYTES = MAX_CHUNKS_PER_TX * CHUNK_DATA_SIZE - 200;

/**
 * Pubblica una singola TX on-chain (senza chain-linking).
 * Usata internamente sia per TX normali che per parti di una chain.
 */
async function _publishSingleTx(marker, payloadBuf) {
  const sdk = await loadSdk();
  const client = await getClient();
  const keypair = await getKeypair();
  const address = await getAddress();
  const config = _getConfig();

  const { chunks, length: payloadLength } = _encodePayloadToChunks(payloadBuf);
  const tx = new sdk.Transaction();

  const allAmounts = [BigInt(marker), BigInt(payloadLength), ...chunks];
  const BATCH_SIZE = 500;
  const allCoins = [];
  for (let i = 0; i < allAmounts.length; i += BATCH_SIZE) {
    const batch = allAmounts.slice(i, i + BATCH_SIZE);
    const coins = tx.splitCoins(tx.gas, batch.map(a => tx.pure.u64(a)));
    if (Array.isArray(coins)) {
      for (let j = 0; j < batch.length; j++) allCoins.push(coins[j]);
    } else {
      allCoins.push(coins);
    }
  }
  for (let i = 0; i < allCoins.length; i++) {
    tx.transferObjects([allCoins[i]], address);
  }
  tx.setGasBudget(Math.max(10000000, chunks.length * 500000));

  const result = await client.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: { showInput: true, showEffects: true },
  });
  await client.waitForTransaction({ digest: result.digest });

  const network = config.IOTA_NETWORK || 'testnet';
  const explorerUrl = `https://explorer.iota.org/txblock/${result.digest}${network !== 'mainnet' ? '?network=' + network : ''}`;
  if (typeof sails !== 'undefined') {
    try { sails.helpers.consoleSocket(`TX: ${explorerUrl}`, _socketId); } catch (e) { /* */ }
  }

  return { digest: result.digest, explorerUrl, chunks: chunks.length, bytes: payloadLength };
}

async function _publishDataImpl(tag, dataObject, entityId = null, version = null) {
  try {
    const payloadJson = JSON.stringify({
      app: APP_TAG,
      tag: tag,
      entityId: entityId,
      version: version,
      data: dataObject,
      timestamp: Date.now(),
    });

    // Comprimi con gzip
    const compressedBuf = zlib.gzipSync(payloadJson);
    const compressionRatio = ((1 - compressedBuf.length / payloadJson.length) * 100).toFixed(0);

    // Se entra in una singola TX → pubblica direttamente
    if (compressedBuf.length <= MAX_PART_BYTES) {
      sails.log.info(`[iota] publishData: tag=${tag} entityId=${entityId} json=${payloadJson.length}B gz=${compressedBuf.length}B (-${compressionRatio}%)`);
      const result = await _publishSingleTx(2, compressedBuf);
      sails.log.info(`[iota] publishData OK: ${result.digest} (${result.chunks} chunks)`);
      return { success: true, digest: result.digest, explorerUrl: result.explorerUrl, error: null };
    }

    // Chain-linking: payload troppo grande, divide in parti collegate con prev
    sails.log.info(`[iota] publishData CHAIN: tag=${tag} entityId=${entityId} gz=${compressedBuf.length}B supera ${MAX_PART_BYTES}B, splitting...`);

    // Dividi il buffer compresso in parti
    const parts = [];
    for (let i = 0; i < compressedBuf.length; i += MAX_PART_BYTES) {
      parts.push(compressedBuf.subarray(i, i + MAX_PART_BYTES));
    }

    sails.log.info(`[iota] publishData CHAIN: ${parts.length} parti da pubblicare`);

    // Pubblica ogni parte come TX separata
    // Ogni parte e un JSON wrapper: {app, _chain: {part, total, prev?}, _data: base64(bytes)}
    let prevDigest = null;
    let lastResult = null;

    for (let i = 0; i < parts.length; i++) {
      const partWrapper = JSON.stringify({
        app: APP_TAG,
        _chain: {
          tag: tag,
          entityId: entityId,
          version: version,
          part: i,
          total: parts.length,
          prev: prevDigest,
        },
        _data: parts[i].toString('base64'),
        timestamp: Date.now(),
      });

      // Le parti wrapper sono piccole (base64 di ~2.8KB = ~3.7KB + overhead < 5KB)
      const partBuf = zlib.gzipSync(partWrapper);
      const result = await _publishSingleTx(2, partBuf);
      sails.log.info(`[iota] publishData CHAIN part ${i+1}/${parts.length}: ${result.digest} (${result.chunks} chunks)`);
      prevDigest = result.digest;
      lastResult = result;
    }

    sails.log.info(`[iota] publishData CHAIN OK: ${parts.length} parti, ultimo digest=${lastResult.digest}`);
    return { success: true, digest: lastResult.digest, explorerUrl: lastResult.explorerUrl, error: null, chainParts: parts.length };
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
// Markers: 1 = legacy (JSON non compresso), 2 = gzip compresso
const MARKER_LEGACY = BigInt(1);
const MARKER_GZIP = BigInt(2);

function _decodeTransactionPayload(txDetail) {
  try {
    const inputs = txDetail.transaction?.data?.transaction?.inputs || [];
    const u64Inputs = inputs.filter(i => i.valueType === 'u64').map(i => BigInt(i.value));

    if (u64Inputs.length < 3) return null;
    const marker = u64Inputs[0];
    if (marker !== MARKER_LEGACY && marker !== MARKER_GZIP) return null;

    const payloadLength = Number(u64Inputs[1]);
    const dataChunks = u64Inputs.slice(2);
    const rawBuf = _decodeChunksToBuffer(dataChunks, payloadLength);

    let payloadStr;
    if (marker === MARKER_GZIP) {
      payloadStr = zlib.gunzipSync(rawBuf).toString('utf8');
    } else {
      payloadStr = rawBuf.toString('utf8');
    }

    const parsed = JSON.parse(payloadStr);
    if (parsed.app !== APP_TAG) return null;

    return parsed;
  } catch (e) {
    return null;
  }
}

/**
 * Riassembla le TX chain-linked.
 * Se una TX ha `_chain`, cerca tutte le parti, le ordina, concatena i buffer,
 * decomprime e restituisce il payload originale completo.
 */
function _reassembleChainedTxs(decodedTxs) {
  const normal = [];
  const chainParts = {}; // key: tag_entityId_version → parts[]

  for (const tx of decodedTxs) {
    if (tx.decoded._chain) {
      const chain = tx.decoded._chain;
      const chainKey = `${chain.tag}_${chain.entityId}_${chain.version}`;
      if (!chainParts[chainKey]) chainParts[chainKey] = [];
      chainParts[chainKey].push({
        part: chain.part,
        total: chain.total,
        data: tx.decoded._data,
        digest: tx.digest,
        timestamp: tx.decoded.timestamp,
        chain: chain,
      });
    } else {
      normal.push(tx);
    }
  }

  // Riassembla ogni chain
  for (const [chainKey, parts] of Object.entries(chainParts)) {
    parts.sort((a, b) => a.part - b.part);

    // Verifica completezza
    if (parts.length !== parts[0].total) {
      sails.log.warn(`[iota] Chain ${chainKey}: ${parts.length}/${parts[0].total} parti trovate (incompleta)`);
      continue;
    }

    try {
      // Concatena i buffer base64 delle parti
      const combinedBuf = Buffer.concat(parts.map(p => Buffer.from(p.data, 'base64')));
      // Decomprimi il payload originale (era stato gzippato prima di essere diviso)
      const payloadStr = zlib.gunzipSync(combinedBuf).toString('utf8');
      const parsed = JSON.parse(payloadStr);

      if (parsed.app !== APP_TAG) continue;

      // Aggiungi come TX normale con il digest dell'ultima parte
      normal.push({
        decoded: parsed,
        digest: parts[parts.length - 1].digest,
        _chainParts: parts.length,
      });

      sails.log.verbose(`[iota] Chain ${chainKey}: riassemblata da ${parts.length} parti`);
    } catch (e) {
      sails.log.warn(`[iota] Chain ${chainKey}: errore riassemblaggio: ${e.message}`);
    }
  }

  return normal;
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

// --- Cache per sync bulk (evita query multiple della stessa chain) ---
let _bulkCache = null;

/**
 * Scarica TUTTE le transazioni dalla chain UNA SOLA VOLTA e le partiziona per tag.
 * Evita di ri-scaricare e ri-decodificare tutte le TX per ogni chiamata getAllDataByTag.
 * Chiama clearBulkCache() quando la sync e finita per liberare memoria.
 */
async function getAllTransactionsCached() {
  if (_bulkCache) return _bulkCache;

  const client = await getClient();
  const address = await getAddress();

  const byTag = {};
  let cursor = null;
  let hasMore = true;
  let totalDecoded = 0;
  let totalFetched = 0;
  let totalSkipped = 0;
  let pages = 0;

  while (hasMore) {
    const opts = {
      filter: { FromAddress: address },
      options: { showInput: true },
      limit: 50,
      order: 'descending',
    };
    if (cursor) opts.cursor = cursor;

    const txBlocks = await client.queryTransactionBlocks(opts);
    pages++;
    totalFetched += txBlocks.data.length;

    // Prima passata: decodifica tutte le TX (normali + chain parts)
    const allDecodedInPage = [];
    for (const tx of txBlocks.data) {
      const decoded = _decodeTransactionPayload(tx);
      if (!decoded) {
        totalSkipped++;
        continue;
      }
      allDecodedInPage.push({ decoded, digest: tx.digest });
      totalDecoded++;
    }

    // Riassembla eventuali chain-linked TX
    const reassembled = _reassembleChainedTxs(allDecodedInPage);

    for (const tx of reassembled) {
      const d = tx.decoded;
      const t = d.tag || d._chain?.tag || '_unknown';
      if (!byTag[t]) byTag[t] = [];
      byTag[t].push({
        payload: d.data,
        version: d.version,
        timestamp: d.timestamp,
        digest: tx.digest,
        tag: d.tag,
        entityId: d.entityId,
      });
    }

    hasMore = txBlocks.hasNextPage;
    cursor = txBlocks.nextCursor;
  }

  const tagSummary = Object.entries(byTag).map(([t, arr]) => `${t}:${arr.length}`).join(', ');
  sails.log.info(`[iota] Bulk cache: ${pages} pagine, ${totalFetched} TX scaricate, ${totalDecoded} decodificate, ${totalSkipped} skippate, tag: [${tagSummary}]`);
  _bulkCache = byTag;
  return _bulkCache;
}

/**
 * Recupera TX per tag dalla bulk cache (se disponibile) o dalla chain.
 */
async function getByTagFromCache(tag, entityId = null) {
  if (_bulkCache) {
    let results = _bulkCache[tag] || [];
    if (entityId !== null && entityId !== undefined) {
      results = results.filter(r => String(r.entityId) === String(entityId));
    }
    return results;
  }
  return await _queryTransactionsFromChain(tag, entityId, 100);
}

/**
 * Libera la bulk cache dalla memoria.
 */
function clearBulkCache() {
  _bulkCache = null;
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
  getPendingTxCount,
  getLastDataByTag,
  getAllDataByTag,
  getAllTransactionsCached,
  getByTagFromCache,
  clearBulkCache,
  requestFaucet,
  GET_MAIN_KEYS,
  getClient,
  getKeypair,
  loadSdk,
  _resetRuntime,
  ASSISTITO_ACCOUNT_PREFIX,
};
