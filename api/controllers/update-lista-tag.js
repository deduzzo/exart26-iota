module.exports = {
  friendlyName: 'Update lista tag',
  description: 'Aggiorna il tag di una lista esistente.',
  inputs: {
    id: { type: 'number', required: true },
    tag: { type: 'string', required: false, allowNull: true },
  },
  exits: {
    success: { description: 'Tag aggiornato.' },
    notFound: { responseType: 'notFound' },
  },
  fn: async function (inputs, exits) {
    const lista = await Lista.findOne({ id: inputs.id });
    if (!lista) return exits.notFound({ error: 'Lista non trovata.' });
    const updated = await Lista.updateOne({ id: inputs.id }).set({ tag: inputs.tag || null });
    sails.log.info(`[update-lista-tag] Lista #${inputs.id} tag: "${inputs.tag}"`);
    return exits.success({ lista: updated });
  }
};
