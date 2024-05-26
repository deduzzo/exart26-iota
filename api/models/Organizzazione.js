/**
 * Organizzazione.js
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
      required: true
    },
    privateKey: {
      type: 'string',
      columnType: 'text',
    },
    publicKey: {
      type: 'string',
      columnType: 'text',
    },
    strutture: {
      collection: 'struttura',
      via: 'organizzazione'
    },
    ultimaVersioneSuBlockchain: {
      type: 'number',
      columnType: 'int',
      defaultsTo: 0
    },
    //  ╔═╗╔╦╗╔╗ ╔═╗╔╦╗╔═╗
    //  ║╣ ║║║╠╩╗║╣  ║║╚═╗
    //  ╚═╝╩ ╩╚═╝╚═╝═╩╝╚═╝


    //  ╔═╗╔═╗╔═╗╔═╗╔═╗╦╔═╗╔╦╗╦╔═╗╔╗╔╔═╗
    //  ╠═╣╚═╗╚═╗║ ║║  ║╠═╣ ║ ║║ ║║║║╚═╗
    //  ╩ ╩╚═╝╚═╝╚═╝╚═╝╩╩ ╩ ╩ ╩╚═╝╝╚╝╚═╝

  },
  getWalletIdOrganizzazione: async function (opts) {
    return opts.id.toString();
  },
  customToJSON: function() {
    return _.omit(this, ['privateKey']);
  },
  nextId: async function() {
    let max = await Organizzazione.find({select: ['id'], sort: 'id DESC', limit: 1});
    if (max.length === 0)
      return 1;
    return max[0].id +1;
  }

};

