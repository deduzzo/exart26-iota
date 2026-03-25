const iota = require('../utility/iota');
const TransactionDataType = require('../enums/TransactionDataType');

module.exports = {
  friendlyName: 'API Entity Transactions',
  description: 'Ritorna tutte le transazioni blockchain per una entita specifica.',
  inputs: {
    type: { type: 'string', required: true },
    entityId: { type: 'string', required: true },
  },
  exits: { success: {} },
  fn: async function (inputs, exits) {
    const { type, entityId } = inputs;
    const tagsToSearch = [];

    switch (type) {
      case 'ORGANIZZAZIONE':
        tagsToSearch.push(
          { tag: TransactionDataType.ORGANIZZAZIONE_DATA, eid: entityId },
          { tag: TransactionDataType.PRIVATE_KEY, eid: entityId },
        );
        break;
      case 'STRUTTURA':
        tagsToSearch.push(
          { tag: TransactionDataType.STRUTTURE_LISTE_DATA, eid: entityId },
          { tag: TransactionDataType.PRIVATE_KEY, eid: entityId },
        );
        break;
      case 'ASSISTITO':
        tagsToSearch.push(
          { tag: TransactionDataType.ASSISTITI_DATA, eid: entityId },
          { tag: TransactionDataType.PRIVATE_KEY, eid: entityId },
        );
        break;
      case 'ASSISTITO_LISTA':
        tagsToSearch.push(
          { tag: TransactionDataType.ASSISTITI_IN_LISTA, eid: entityId },
          { tag: TransactionDataType.MOVIMENTI_ASSISTITI_LISTA, eid: entityId },
        );
        break;
      default:
        return exits.success({ entityType: type, entityId, transactions: [] });
    }

    const transactions = [];
    let explorerBase = 'https://explorer.rebased.iota.org';
    try {
      const status = await iota.getStatusAndBalance();
      if (status.explorerUrl) explorerBase = status.explorerUrl;
    } catch (e) { /* use default */ }

    for (const { tag, eid } of tagsToSearch) {
      try {
        const txs = await iota.getAllDataByTag(tag, eid);
        for (const tx of txs) {
          transactions.push({
            tag: tx.tag || tag,
            digest: tx.digest,
            version: tx.version || null,
            timestamp: tx.timestamp || null,
            timestampFormatted: tx.timestamp ? new Date(tx.timestamp).toLocaleString('it-IT') : null,
            explorerUrl: `${explorerBase}/txblock/${tx.digest}`,
          });
        }
      } catch (e) { /* skip */ }
    }

    transactions.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return exits.success({ entityType: type, entityId, transactions });
  }
};
