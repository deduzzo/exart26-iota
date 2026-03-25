module.exports = {

  friendlyName: 'Broadcast event',
  description: 'Invia un evento real-time a tutti i client connessi via Socket.io.',

  inputs: {
    event: { type: 'string', required: true },
    data: { type: 'ref', required: false, defaultsTo: {} },
  },

  fn: async function (inputs) {
    if (!sails.hooks || !sails.hooks.sockets) {
      sails.log.verbose('[broadcast] sails-hook-sockets non disponibile, skip');
      return;
    }
    try {
      sails.sockets.blast(inputs.event, {
        ...inputs.data,
        timestamp: Date.now(),
      });
      sails.log.verbose(`[broadcast] ${inputs.event}: ${inputs.data?.action || ''} ${inputs.data?.label || ''}`);
    } catch (e) {
      sails.log.warn('[broadcast] Errore:', e.message);
    }
  }
};
