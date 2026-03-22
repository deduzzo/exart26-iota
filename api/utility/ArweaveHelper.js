const Arweave = require('arweave');

const APP_NAME = 'exart26-iota';

let _arweave = null;
let _wallet = null;
let _enabled = false;

try {
  const config = require('../../config/private_arweave_conf');
  if (config.ARWEAVE_WALLET_JWK) {
    _arweave = Arweave.init({
      host: config.ARWEAVE_HOST || 'arweave.net',
      port: config.ARWEAVE_PORT || 443,
      protocol: config.ARWEAVE_PROTOCOL || 'https',
    });
    _wallet = config.ARWEAVE_WALLET_JWK;
    _enabled = true;
  }
} catch (e) {
  // Config non presente - Arweave disabilitato
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
   */
  static async uploadData(dataType, encryptedPayload, entityId = null, version = null) {
    if (!_enabled) {
      return {success: false, error: 'Arweave non configurato'};
    }

    try {
      const dataString = typeof encryptedPayload === 'string'
        ? encryptedPayload
        : JSON.stringify(encryptedPayload);

      const transaction = await _arweave.createTransaction({
        data: dataString,
      }, _wallet);

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

      await _arweave.transactions.sign(transaction, _wallet);
      const response = await _arweave.transactions.post(transaction);

      if (response.status === 200 || response.status === 208) {
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
        {name: 'App-Name', values: [APP_NAME]},
        {name: 'Data-Type', values: [dataType]},
      ];
      if (entityId !== null && entityId !== undefined) {
        tags.push({name: 'Entity-Id', values: [entityId.toString()]});
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
      const data = await _arweave.transactions.getData(txId, {decode: true, string: true});

      return {
        txId: txId,
        data: JSON.parse(data),
        tags: edges[0].node.tags,
      };
    } catch (e) {
      sails.log.warn('Arweave downloadByTag error:', e.message);
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
      sails.log.warn('Arweave getAllByTag error:', e.message);
      return [];
    }
  }

  /**
   * Scarica e ritorna i dati di una transazione specifica per txId.
   */
  static async getDataByTxId(txId) {
    if (!_enabled) return null;

    try {
      const data = await _arweave.transactions.getData(txId, {decode: true, string: true});
      return JSON.parse(data);
    } catch (e) {
      sails.log.warn('Arweave getDataByTxId error:', e.message);
      return null;
    }
  }
}

module.exports = ArweaveHelper;
