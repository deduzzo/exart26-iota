/**
 * BlockchainData.js
 *
 * Cache locale dei dati pubblicati sulla blockchain IOTA 2.0.
 * Ogni record corrisponde a una transazione con il suo payload cifrato.
 */
module.exports = {
  attributes: {
    digest: {
      type: 'string',
      required: true,
      description: 'Transaction digest (hash) sulla blockchain IOTA',
    },
    tag: {
      type: 'string',
      required: true,
      description: 'Tipo di dato (TransactionDataType)',
    },
    entityId: {
      type: 'string',
      allowNull: true,
      description: 'ID entita associata (opzionale)',
    },
    version: {
      type: 'number',
      allowNull: true,
      description: 'Numero versione del dato',
    },
    payload: {
      type: 'string',
      required: true,
      columnType: 'longtext',
      description: 'Payload JSON completo (cifrato)',
    },
    timestamp: {
      type: 'number',
      required: true,
      description: 'Timestamp di pubblicazione',
    },
  },
};
