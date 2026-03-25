module.exports = {

  friendlyName: 'Broadcast event',
  description: 'Invia un evento real-time a tutti i client connessi via Socket.io.',

  inputs: {
    event: { type: 'string', required: true },
    data: { type: 'ref', required: false, defaultsTo: {} },
  },

  fn: async function (inputs) {
    if (!sails.hooks || !sails.hooks.sockets) return;
    try {
      sails.sockets.blast(inputs.event, {
        ...inputs.data,
        timestamp: Date.now(),
      });
    } catch (e) {
      sails.log.verbose('[broadcast] Errore:', e.message);
    }
  }
};
