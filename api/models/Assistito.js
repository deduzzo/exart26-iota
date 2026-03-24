/**
 * Assistito.js
 *
 * @description :: A model definition represents a database table/collection.
 * @docs        :: https://sailsjs.com/docs/concepts/models-and-orm/models
 */

const crypto = require('crypto');
const iota = require('../utility/iota');

/**
 * Genera un ID anonimo univoco di 8 caratteri dal codice fiscale.
 * SHA-256(CF) troncato a 8 hex uppercase. Deterministico: stesso CF = stesso ID.
 */
function generateAnonId(codiceFiscale) {
  return crypto.createHash('sha256')
    .update(codiceFiscale.toUpperCase().trim())
    .digest('hex')
    .substring(0, 8)
    .toUpperCase();
}

module.exports = {

  attributes: {

    anonId: {
      type: 'string',
      required: true,
      description: 'ID anonimo univoco (8 char hex da SHA-256 del CF). Usato nella vista pubblica. Unicita garantita nel beforeCreate.',
      maxLength: 8,
    },

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
  // Genera anonId univoco prima della creazione
  beforeCreate: async function (valuesToSet, proceed) {
    if (valuesToSet.codiceFiscale && !valuesToSet.anonId) {
      let candidate = generateAnonId(valuesToSet.codiceFiscale);
      // Verifica unicita - in caso di collisione (improbabile), aggiungi salt
      let salt = 0;
      while (await Assistito.findOne({ anonId: candidate })) {
        salt++;
        candidate = crypto.createHash('sha256')
          .update(valuesToSet.codiceFiscale.toUpperCase().trim() + ':' + salt)
          .digest('hex').substring(0, 8).toUpperCase();
      }
      valuesToSet.anonId = candidate;
    }
    return proceed();
  },

  // METODI
  generateAnonId: generateAnonId,

  getWalletIdAssistito: async function (opts) {
    let assistito = await Assistito.findOne({id: opts.id});
    if (assistito) {
      return iota.ASSISTITO_ACCOUNT_PREFIX + assistito.id;
    }
    return null;
  },
  customToJSON: function() {
    return _.omit(this, ['privateKey']);
  }
};

