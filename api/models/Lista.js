/**
 * Lista.js
 *
 * @description :: A model definition represents a database table/collection.
 * @docs        :: https://sailsjs.com/docs/concepts/models-and-orm/models
 */

module.exports = {

  attributes: {
    denominazione: {
      type: 'string',
      required: true
    },
    aperta: {
      type: 'boolean',
      defaultsTo: true
    },
    ultimaVersioneSuBlockchain: {
      type: 'number',
      columnType: 'int',
      defaultsTo: 0
    },
    struttura: {
      model: 'struttura',
    },
    assistiti: {
      collection: 'assistito',
      via: 'lista',
      through: 'assistitiliste'
    },

    //  ╔═╗╦═╗╦╔╦╗╦╔╦╗╦╦  ╦╔═╗╔═╗
    //  ╠═╝╠╦╝║║║║║ ║ ║╚╗╔╝║╣ ╚═╗
    //  ╩  ╩╚═╩╩ ╩╩ ╩ ╩ ╚╝ ╚═╝╚═╝


    //  ╔═╗╔╦╗╔╗ ╔═╗╔╦╗╔═╗
    //  ║╣ ║║║╠╩╗║╣  ║║╚═╗
    //  ╚═╝╩ ╩╚═╝╚═╝═╩╝╚═╝


    //  ╔═╗╔═╗╔═╗╔═╗╔═╗╦╔═╗╔╦╗╦╔═╗╔╗╔╔═╗
    //  ╠═╣╚═╗╚═╗║ ║║  ║╠═╣ ║ ║║ ║║║║╚═╗
    //  ╩ ╩╚═╝╚═╝╚═╝╚═╝╩╩ ╩ ╩ ╩╚═╝╝╚╝╚═╝

  },
  // METODI
  getWalletIdLista: async function (opts) {
    let lista = await Lista.findOne({id: opts.id}).populate('struttura');
    if (lista) {
      return lista.struttura.organizzazione + '_' + lista.struttura.id + '_' + lista.id;
    }
    return null;
  }

};

