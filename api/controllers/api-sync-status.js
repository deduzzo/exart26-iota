module.exports = {
  friendlyName: 'API Sync Status',
  description: 'Ritorna lo stato della sincronizzazione blockchain.',
  inputs: {},
  exits: { success: {} },
  fn: async function () {
    return {
      syncing: sails.config.custom._syncInProgress || false,
      syncProgress: sails.config.custom._syncProgress || null,
    };
  }
};
