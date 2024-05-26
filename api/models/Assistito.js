/**
 * Assistito.js
 *
 * @description :: A model definition represents a database table/collection.
 * @docs        :: https://sailsjs.com/docs/concepts/models-and-orm/models
 */

const iota = require('../utility/iota');

module.exports = {

  attributes: {

    //  ╔═╗╦═╗╦╔╦╗╦╔╦╗╦╦  ╦╔═╗╔═╗
    //  ╠═╝╠╦╝║║║║║ ║ ║╚╗╔╝║╣ ╚═╗
    //  ╩  ╩╚═╩╩ ╩╩ ╩ ╩ ╚╝ ╚═╝╚═╝

    nome: {
      type: 'string',
      required: true
    },
    cognome: {
      type: 'string',
      required: true
    },
    codiceFiscale: {
      type: 'string',
      required: true,
      unique: true
    },
    dataNascita: {
      type: 'string',
      columnType: 'date',
      required: false,
      allowNull: true
    },
    email: {
      type: 'string',
      required: false
    },
    telefono: {
      type: 'string',
      required: false
    },
    indirizzo: {
      type: 'string',
      required: false
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
    liste: {
      collection: 'lista',
      via: 'assistito',
      through: 'assistitiliste'
    }

    //  ╔═╗╔╦╗╔╗ ╔═╗╔╦╗╔═╗
    //  ║╣ ║║║╠╩╗║╣  ║║╚═╗
    //  ╚═╝╩ ╩╚═╝╚═╝═╩╝╚═╝


    //  ╔═╗╔═╗╔═╗╔═╗╔═╗╦╔═╗╔╦╗╦╔═╗╔╗╔╔═╗
    //  ╠═╣╚═╗╚═╗║ ║║  ║╠═╣ ║ ║║ ║║║║╚═╗
    //  ╩ ╩╚═╝╚═╝╚═╝╚═╝╩╩ ╩ ╩ ╩╚═╝╝╚╝╚═╝

  },
  // METODI
  getWalletIdAssistito: async function (opts) {
    let assistito = await Assistito.findOne({id: opts.id});
    if (assistito) {
      return iota.ASSISTITO_ACCOUNT_PREFIX + assistito.id;
    }
    return null;
  },
  customToJSON: function() {
    return _.omit(this, ['privateKey']);
  },
  nextId: async function() {
    let max = await Assistito.find({select: ['id'], sort: 'id DESC', limit: 1});
    if (max.length === 0)
      return 1;
    return max[0].id;
  }
};

