const db = require('../utility/db');
const ListManager = require('../utility/ListManager');

module.exports = {
  friendlyName: 'Reset Sync Cache',
  description: 'Cancella la cache locale e riforza la sync dalla blockchain.',
  inputs: {},
  exits: { success: {} },
  fn: async function () {
    sails.log.info('[sync-reset] Reset cache e risync...');

    // 1. Svuota DB locale
    db.raw.exec('DELETE FROM blockchain_data; DELETE FROM sync_state; DELETE FROM assistiti_liste; DELETE FROM assistiti; DELETE FROM liste; DELETE FROM strutture; DELETE FROM organizzazioni;');

    // 2. Risync dalla blockchain
    sails.config.custom._syncInProgress = true;
    sails.config.custom._syncProgress = { status: 'Reset: risincronizzazione dalla blockchain...', total: 0, processed: 0 };

    setImmediate(async () => {
      try {
        const manager = new ListManager();
        const result = await manager.updateDBfromBlockchain((progress) => {
          sails.config.custom._syncProgress = progress;
        });
        if (result.success) {
          sails.log.info('[sync-reset] Risync completata');
          await sails.helpers.broadcastEvent('dataChanged', { action: 'SYNC_COMPLETATA', entity: 'system' });
        }
      } catch (err) {
        sails.log.warn('[sync-reset] Risync fallita:', err.message);
      } finally {
        sails.config.custom._syncInProgress = false;
        sails.config.custom._syncProgress = null;
      }
    });

    return { success: true, message: 'Cache resettata, risincronizzazione in corso...' };
  }
};
