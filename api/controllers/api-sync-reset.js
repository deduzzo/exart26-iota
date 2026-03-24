const SyncCache = require('../utility/SyncCache');
const ListManager = require('../utility/ListManager');

module.exports = {
  friendlyName: 'Reset Sync Cache',
  description: 'Cancella la cache locale e riforza la sync dalla blockchain.',
  inputs: {},
  exits: { success: {} },
  fn: async function () {
    sails.log.info('[sync-reset] Reset cache e risync...');

    // 1. Cancella cache
    SyncCache.reset();

    // 2. Svuota DB in-memory
    await Organizzazione.destroy({});
    await Struttura.destroy({});
    await Lista.destroy({});
    await Assistito.destroy({});
    await AssistitiListe.destroy({});

    // 3. Risync dalla blockchain
    sails.config.custom._syncInProgress = true;
    sails.config.custom._syncProgress = { status: 'Reset: risincronizzazione dalla blockchain...', total: 0, processed: 0 };

    setImmediate(async () => {
      try {
        const manager = new ListManager();
        const result = await manager.updateDBfromBlockchain((progress) => {
          sails.config.custom._syncProgress = progress;
        });
        if (result.success) {
          await SyncCache.exportFromDB();
          sails.log.info('[sync-reset] Risync completata');
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
