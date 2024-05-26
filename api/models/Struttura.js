/**
 * Struttura.js
 *
 * @description :: A model definition represents a database table/collection.
 * @docs        :: https://sailsjs.com/docs/concepts/models-and-orm/models
 */

module.exports = {
  attributes: {

    //  ╔═╗╦═╗╦╔╦╗╦╔╦╗╦╦  ╦╔═╗╔═╗
    //  ╠═╝╠╦╝║║║║║ ║ ║╚╗╔╝║╣ ╚═╗
    //  ╩  ╩╚═╩╩ ╩╩ ╩ ╩ ╚╝ ╚═╝╚═╝
    denominazione: {
      type: 'string',
      columnName: 'denominazione',
      required: false
    },
    attiva: {
      type: 'boolean',
      defaultsTo: true
    },
    indirizzo: {
      type: 'string',
      columnName: 'indirizzo',
    },
    privateKey: {
      type: 'string',
      columnType: 'text',
    },
    publicKey: {
      type: 'string',
      columnType: 'text',
    },
    ultimaVersioneSuBlockchain: {
      type: 'number',
      columnType: 'int',
      defaultsTo: 0
    },
    organizzazione: {
      model: 'organizzazione',
    },
    liste: {
      collection: 'lista',
      via: 'struttura',
    }


    //  ╔═╗╔╦╗╔╗ ╔═╗╔╦╗╔═╗
    //  ║╣ ║║║╠╩╗║╣  ║║╚═╗
    //  ╚═╝╩ ╩╚═╝╚═╝═╩╝╚═╝

    //  ╔═╗╔═╗╔═╗╔═╗╔═╗╦╔═╗╔╦╗╦╔═╗╔╗╔╔═╗
    //  ╠═╣╚═╗╚═╗║ ║║  ║╠═╣ ║ ║║ ║║║║╚═╗
    //  ╩ ╩╚═╝╚═╝╚═╝╚═╝╩╩ ╩ ╩ ╩╚═╝╝╚╝╚═╝
  },

  // METODI
  getWalletIdStruttura: async function (opts) {
    let struttura = await Struttura.findOne({ id: opts.id }).populate('organizzazione');
    if (struttura) {
      return struttura.organizzazione.id + '_' + struttura.id;
    }
    return null;
  },
  customToJSON: function() {
    return _.omit(this, ['privateKey']);
  },
  nextId: async function() {
    let max = await Struttura.find({select: ['id'], sort: 'id DESC', limit: 1});
    if (max.length === 0)
      return 1;
    return max[0].id;
  }

};

