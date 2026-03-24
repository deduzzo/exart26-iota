const Arweave = require('arweave');
const fs = require('fs');
const path = require('path');

const APP_NAME = 'exart26-iota';
const RUNTIME_STATE_PATH = path.resolve(__dirname, '../../.tmp/arweave-runtime-state.json');

// Module-level state
let _arweave = null;
let _wallet = null;
let _enabled = false;
let _mode = null; // 'production' | 'test' | null
let _arLocalInstance = null;
let _inflightUploads = 0;
let _productionConfig = null;

// Try to load production config at module load (optional)
try {
  const config = require('../../config/private_arweave_conf');
  if (config.ARWEAVE_WALLET_JWK) {
    _productionConfig = config;
  }
} catch (e) {
  // Config non presente - ok
}

// --- Internal helpers ---

function _loadRuntimeState() {
  try {
    if (fs.existsSync(RUNTIME_STATE_PATH)) {
      const raw = fs.readFileSync(RUNTIME_STATE_PATH, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    // corrupted or missing - ignore
  }
  return null;
}

function _saveRuntimeState(state) {
  try {
    const dir = path.dirname(RUNTIME_STATE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(RUNTIME_STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    if (typeof sails !== 'undefined') sails.log.warn('[ArweaveHelper] Errore salvataggio runtime state:', e.message);
  }
}

function _getLocalPort() {
  const state = _loadRuntimeState();
  return (state && state.localPort) || 1984;
}

async function _initProduction() {
  if (!_productionConfig || !_productionConfig.ARWEAVE_WALLET_JWK) {
    _enabled = false;
    _mode = null;
    return false;
  }

  _arweave = Arweave.init({
    host: _productionConfig.ARWEAVE_HOST || 'arweave.net',
    port: _productionConfig.ARWEAVE_PORT || 443,
    protocol: _productionConfig.ARWEAVE_PROTOCOL || 'https',
  });
  _wallet = _productionConfig.ARWEAVE_WALLET_JWK;
  _enabled = true;
  _mode = 'production';
  return true;
}

async function _initTest() {
  const port = _getLocalPort();

  // Try to start ArLocal, handle EADDRINUSE
  try {
    const ArLocal = require('arlocal').default;
    _arLocalInstance = new ArLocal(port, false);
    await _arLocalInstance.start();
    if (typeof sails !== 'undefined') sails.log.info(`[ArweaveHelper] ArLocal avviato su porta ${port}`);
  } catch (e) {
    if (e.code === 'EADDRINUSE' || (e.message && e.message.includes('EADDRINUSE'))) {
      // Check if an existing ArLocal instance is running on that port
      try {
        const resp = await fetch(`http://localhost:${port}/info`);
        if (resp.ok) {
          if (typeof sails !== 'undefined') sails.log.info(`[ArweaveHelper] ArLocal gia attivo su porta ${port}, riuso istanza esistente`);
          _arLocalInstance = null; // Not ours to manage
        } else {
          throw new Error(`ArLocal porta ${port} non raggiungibile`);
        }
      } catch (fetchErr) {
        throw new Error(`Porta ${port} occupata ma ArLocal non raggiungibile: ${fetchErr.message}`);
      }
    } else {
      throw e;
    }
  }

  _arweave = Arweave.init({
    host: 'localhost',
    port: port,
    protocol: 'http',
  });

  // Load or generate test wallet
  const state = _loadRuntimeState();
  if (state && state.testWalletJwk) {
    _wallet = state.testWalletJwk;
  } else {
    _wallet = await _arweave.wallets.generate();
    _saveRuntimeState({
      mode: 'test',
      testWalletJwk: _wallet,
      localPort: port,
    });
  }

  // Fund test wallet
  const address = await _arweave.wallets.jwkToAddress(_wallet);
  try {
    await _arweave.api.get(`mint/${address}/1000000000000`);
  } catch (e) {
    if (typeof sails !== 'undefined') sails.log.warn('[ArweaveHelper] Errore funding test wallet:', e.message);
  }

  _enabled = true;
  _mode = 'test';
  return true;
}


class ArweaveHelper {

  static isEnabled() {
    return _enabled;
  }

  static async getWalletAddress() {
    if (!_enabled) return null;
    return await _arweave.wallets.jwkToAddress(_wallet);
  }

  static async getBalance() {
    if (!_enabled) return null;
    const address = await this.getWalletAddress();
    const winstonBalance = await _arweave.wallets.getBalance(address);
    return {
      winston: winstonBalance,
      ar: _arweave.ar.winstonToAr(winstonBalance),
    };
  }

  /**
   * Carica dati cifrati su Arweave con tag metadata.
   * Non-bloccante: ritorna il txId appena la transazione e inviata,
   * senza attendere la conferma (~20 min).
   *
   * Inflight safety: cattura snapshot di _arweave/_wallet all'inizio,
   * incrementa contatore inflight per drain sicuro durante switchMode.
   */
  static async uploadData(dataType, encryptedPayload, entityId = null, version = null) {
    if (!_enabled) {
      return { success: false, error: 'Arweave non configurato' };
    }

    // Snapshot current state for inflight safety
    const arweaveSnapshot = _arweave;
    const walletSnapshot = _wallet;
    const modeSnapshot = _mode;

    _inflightUploads++;
    try {
      const dataString = typeof encryptedPayload === 'string'
        ? encryptedPayload
        : JSON.stringify(encryptedPayload);

      const transaction = await arweaveSnapshot.createTransaction({
        data: dataString,
      }, walletSnapshot);

      transaction.addTag('App-Name', APP_NAME);
      transaction.addTag('Content-Type', 'application/json');
      transaction.addTag('Data-Type', dataType);
      if (entityId !== null && entityId !== undefined) {
        transaction.addTag('Entity-Id', entityId.toString());
      }
      if (version !== null && version !== undefined) {
        transaction.addTag('Version', version.toString());
      }
      transaction.addTag('Timestamp', Date.now().toString());

      await arweaveSnapshot.transactions.sign(transaction, walletSnapshot);
      const response = await arweaveSnapshot.transactions.post(transaction);

      if (response.status === 200 || response.status === 208) {
        // In test mode, mine a block to make the transaction available immediately
        if (modeSnapshot === 'test') {
          try {
            await arweaveSnapshot.api.get('mine');
          } catch (e) {
            // Mining failure is non-critical
          }
        }

        return {
          success: true,
          txId: transaction.id,
          error: null,
        };
      } else {
        return {
          success: false,
          txId: null,
          error: `Arweave POST status: ${response.status}`,
        };
      }
    } catch (e) {
      return {
        success: false,
        txId: null,
        error: e.message,
      };
    } finally {
      _inflightUploads--;
    }
  }

  /**
   * Cerca transazioni su Arweave per tag usando GraphQL.
   * Ritorna l'ultima transazione che corrisponde ai filtri.
   */
  static async downloadByTag(dataType, entityId = null) {
    if (!_enabled) return null;

    try {
      const tags = [
        { name: 'App-Name', values: [APP_NAME] },
        { name: 'Data-Type', values: [dataType] },
      ];
      if (entityId !== null && entityId !== undefined) {
        tags.push({ name: 'Entity-Id', values: [entityId.toString()] });
      }

      const query = {
        query: `{
          transactions(
            tags: [${tags.map(t => `{name: "${t.name}", values: ${JSON.stringify(t.values)}}`).join(', ')}],
            sort: HEIGHT_DESC,
            first: 1
          ) {
            edges {
              node {
                id
                tags {
                  name
                  value
                }
              }
            }
          }
        }`,
      };

      const response = await _arweave.api.post('graphql', query);
      const edges = response.data.data.transactions.edges;

      if (edges.length === 0) {
        return null;
      }

      const txId = edges[0].node.id;
      const data = await _arweave.transactions.getData(txId, { decode: true, string: true });

      return {
        txId: txId,
        data: JSON.parse(data),
        tags: edges[0].node.tags,
      };
    } catch (e) {
      if (typeof sails !== 'undefined') sails.log.warn('Arweave downloadByTag error:', e.message);
      return null;
    }
  }

  /**
   * Ritorna tutte le transazioni per un dato tag/tipo.
   */
  static async getAllByTag(dataType, limit = 100) {
    if (!_enabled) return [];

    try {
      const query = {
        query: `{
          transactions(
            tags: [
              {name: "App-Name", values: ["${APP_NAME}"]},
              {name: "Data-Type", values: ["${dataType}"]}
            ],
            sort: HEIGHT_DESC,
            first: ${limit}
          ) {
            edges {
              node {
                id
                tags {
                  name
                  value
                }
              }
            }
          }
        }`,
      };

      const response = await _arweave.api.post('graphql', query);
      return response.data.data.transactions.edges.map(edge => ({
        txId: edge.node.id,
        tags: edge.node.tags,
      }));
    } catch (e) {
      if (typeof sails !== 'undefined') sails.log.warn('Arweave getAllByTag error:', e.message);
      return [];
    }
  }

  /**
   * Scarica e ritorna i dati di una transazione specifica per txId.
   */
  static async getDataByTxId(txId) {
    if (!_enabled) return null;

    try {
      const data = await _arweave.transactions.getData(txId, { decode: true, string: true });
      return JSON.parse(data);
    } catch (e) {
      if (typeof sails !== 'undefined') sails.log.warn('Arweave getDataByTxId error:', e.message);
      return null;
    }
  }

  // --- New methods ---

  /**
   * Switch between 'production' and 'test' mode.
   * Drains inflight uploads (max 10s), stops ArLocal if active, then switches.
   */
  static async switchMode(mode) {
    if (mode !== 'production' && mode !== 'test') {
      return { success: false, error: `Modalita non valida: ${mode}. Usa "production" o "test"` };
    }

    if (mode === 'production' && (!_productionConfig || !_productionConfig.ARWEAVE_WALLET_JWK)) {
      return { success: false, error: 'JWK non configurato in private_arweave_conf.js' };
    }

    // Drain inflight uploads (max 10s)
    const drainStart = Date.now();
    while (_inflightUploads > 0 && (Date.now() - drainStart) < 10000) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    if (_inflightUploads > 0) {
      if (typeof sails !== 'undefined') sails.log.warn(`[ArweaveHelper] switchMode: ${_inflightUploads} upload ancora in corso dopo drain timeout`);
    }

    // Stop ArLocal if we own it
    if (_arLocalInstance) {
      try {
        await _arLocalInstance.stop();
        if (typeof sails !== 'undefined') sails.log.info('[ArweaveHelper] ArLocal fermato');
      } catch (e) {
        if (typeof sails !== 'undefined') sails.log.warn('[ArweaveHelper] Errore stop ArLocal:', e.message);
      }
      _arLocalInstance = null;
    }

    // Reset state
    _arweave = null;
    _wallet = null;
    _enabled = false;

    // Initialize new mode
    let result;
    if (mode === 'production') {
      result = await _initProduction();
      _saveRuntimeState({ mode: 'production', testWalletJwk: null });
    } else {
      result = await _initTest();
      // _initTest saves its own state with testWalletJwk
    }

    return { success: result, mode: _mode };
  }

  /**
   * Returns current mode string.
   */
  static getMode() {
    return _mode;
  }

  /**
   * Returns detailed status info for debug/dashboard.
   */
  static async getDetailedStatus() {
    const status = {
      mode: _mode,
      enabled: _enabled,
      address: null,
      balance: null,
      arLocalRunning: _arLocalInstance !== null,
      host: null,
      port: null,
    };

    if (_enabled && _arweave) {
      try {
        status.address = await _arweave.wallets.jwkToAddress(_wallet);
      } catch (e) { /* ignore */ }

      try {
        const winstonBalance = await _arweave.wallets.getBalance(status.address);
        status.balance = {
          winston: winstonBalance,
          ar: _arweave.ar.winstonToAr(winstonBalance),
        };
      } catch (e) { /* ignore */ }

      status.host = _arweave.api.config.host;
      status.port = _arweave.api.config.port;
    }

    return status;
  }

  /**
   * Upload a dummy test payload, returns { success, txId }.
   */
  static async testUpload() {
    const payload = {
      test: true,
      timestamp: Date.now(),
      message: 'ArweaveHelper test upload',
    };
    return await this.uploadData('TEST_DATA', JSON.stringify(payload));
  }

  /**
   * Download and verify a transaction by ID.
   */
  static async testVerify(txId) {
    if (!_enabled) {
      return { success: false, error: 'Arweave non abilitato' };
    }

    try {
      const data = await _arweave.transactions.getData(txId, { decode: true, string: true });
      const status = await _arweave.transactions.getStatus(txId);
      return {
        success: true,
        txId: txId,
        data: JSON.parse(data),
        status: status,
      };
    } catch (e) {
      return {
        success: false,
        error: e.message,
      };
    }
  }

  /**
   * Fetch transactions for a specific DataType with full data, for debug.
   */
  static async getTransactionsForDebug(dataType, limit = 10) {
    if (!_enabled) return [];

    try {
      const txList = await this.getAllByTag(dataType, limit);
      const results = [];

      for (const tx of txList) {
        try {
          const data = await _arweave.transactions.getData(tx.txId, { decode: true, string: true });
          results.push({
            txId: tx.txId,
            tags: tx.tags,
            data: JSON.parse(data),
          });
        } catch (e) {
          results.push({
            txId: tx.txId,
            tags: tx.tags,
            data: null,
            error: e.message,
          });
        }
      }

      return results;
    } catch (e) {
      if (typeof sails !== 'undefined') sails.log.warn('Arweave getTransactionsForDebug error:', e.message);
      return [];
    }
  }

  /**
   * Compare IOTA transactions vs Arweave metadata for consistency check.
   * @param {Array} iotaTransactions - Array of { tag, entityId, version, digest }
   * @returns {Object} { matched, missingOnArweave, missingOnIota, mismatched }
   */
  static async getConsistency(iotaTransactions) {
    if (!_enabled) {
      return { matched: [], missingOnArweave: iotaTransactions, missingOnIota: [], mismatched: [] };
    }

    const matched = [];
    const missingOnArweave = [];
    const mismatched = [];

    for (const iotaTx of iotaTransactions) {
      try {
        const arweaveTx = await this.downloadByTag(iotaTx.tag, iotaTx.entityId);
        if (!arweaveTx) {
          missingOnArweave.push(iotaTx);
        } else {
          // Extract version from arweave tags
          const versionTag = arweaveTx.tags.find(t => t.name === 'Version');
          const arweaveVersion = versionTag ? versionTag.value : null;

          if (iotaTx.version && arweaveVersion && iotaTx.version.toString() !== arweaveVersion.toString()) {
            mismatched.push({
              entityId: iotaTx.entityId,
              tag: iotaTx.tag,
              iotaVersion: iotaTx.version,
              arweaveVersion: arweaveVersion,
            });
          } else {
            matched.push({
              entityId: iotaTx.entityId,
              tag: iotaTx.tag,
              arweaveTxId: arweaveTx.txId,
            });
          }
        }
      } catch (e) {
        missingOnArweave.push(iotaTx);
      }
    }

    return { matched, missingOnArweave, missingOnIota: [], mismatched };
  }

  /**
   * Bootstrap: reads runtime state and initializes appropriate mode.
   * Called at server startup.
   */
  static async bootstrap() {
    const state = _loadRuntimeState();

    if (state && state.mode === 'test') {
      try {
        await _initTest();
        if (typeof sails !== 'undefined') sails.log.info('[ArweaveHelper] Bootstrap: modalita test');
        return;
      } catch (e) {
        if (typeof sails !== 'undefined') sails.log.warn('[ArweaveHelper] Bootstrap test fallito:', e.message);
      }
    }

    // Default: try production
    if (_productionConfig && _productionConfig.ARWEAVE_WALLET_JWK) {
      await _initProduction();
      if (typeof sails !== 'undefined') sails.log.info('[ArweaveHelper] Bootstrap: modalita production');
    } else {
      if (typeof sails !== 'undefined') sails.log.info('[ArweaveHelper] Bootstrap: Arweave non configurato (nessun JWK)');
    }
  }

  /**
   * Shutdown: stops ArLocal if active.
   */
  static async shutdown() {
    if (_arLocalInstance) {
      try {
        await _arLocalInstance.stop();
        if (typeof sails !== 'undefined') sails.log.info('[ArweaveHelper] ArLocal fermato (shutdown)');
      } catch (e) {
        if (typeof sails !== 'undefined') sails.log.warn('[ArweaveHelper] Errore shutdown ArLocal:', e.message);
      }
      _arLocalInstance = null;
    }
    _enabled = false;
    _mode = null;
  }
}

// Static fields (CommonJS pattern - outside class)
ArweaveHelper._inflightUploads = () => _inflightUploads;

module.exports = ArweaveHelper;
