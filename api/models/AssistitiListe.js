/**
 * AssistitiListe.js
 *
 * @description :: A model definition represents a database table/collection.
 * @docs        :: https://sailsjs.com/docs/concepts/models-and-orm/models
 */


const {INSERITO_IN_CODA} = require('../enums/StatoLista');

module.exports = {

  attributes: {

    //  ╔═╗╦═╗╦╔╦╗╦╔╦╗╦╦  ╦╔═╗╔═╗
    //  ╠═╝╠╦╝║║║║║ ║ ║╚╗╔╝║╣ ╚═╗
    //  ╩  ╩╚═╩╩ ╩╩ ╩ ╩ ╚╝ ╚═╝╚═╝

    assistito: {
      model: 'assistito',
    },
    lista: {
      model: 'lista',
    },
    stato: {
      type: 'number',
      columnType: 'tinyint',
      defaultsTo: INSERITO_IN_CODA
    },
    dataOraIngresso: {
      type: 'number',
      defaultsTo: Date.now()
    },
    dataOraUscita: {
      type: 'number',
      required: false,
    },
    chiuso: {
      type: 'boolean',
      defaultsTo: false
    },

    //  ╔═╗╔╦╗╔╗ ╔═╗╔╦╗╔═╗
    //  ║╣ ║║║╠╩╗║╣  ║║╚═╗
    //  ╚═╝╩ ╩╚═╝╚═╝═╩╝╚═╝


    //  ╔═╗╔═╗╔═╗╔═╗╔═╗╦╔═╗╔╦╗╦╔═╗╔╗╔╔═╗
    //  ╠═╣╚═╗╚═╗║ ║║  ║╠═╣ ║ ║║ ║║║║╚═╗
    //  ╩ ╩╚═╝╚═╝╚═╝╚═╝╩╩ ╩ ╩ ╩╚═╝╝╚╝╚═╝

  },
  nextId: async function() {
    let max = await AssistitiListe.find({select: ['id'], sort: 'id DESC', limit: 1});
    if (max.length === 0)
      return 1;
    return max[0].id;
  }

};

