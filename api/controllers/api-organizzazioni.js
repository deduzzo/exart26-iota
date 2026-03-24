const db = require('../utility/db');

module.exports = {

  friendlyName: 'API Organizzazioni',

  description: 'Ritorna lista o dettaglio organizzazione con strutture.',

  inputs: {
    id: {
      type: 'number',
      required: false,
      description: 'ID organizzazione per dettaglio'
    }
  },

  exits: {
    success: {
      description: 'Dati organizzazioni.',
    },
    notFound: {
      responseType: 'notFound',
      description: 'Organizzazione non trovata.'
    }
  },

  fn: async function (inputs, exits) {
    if (inputs.id) {
      let organizzazione = db.Organizzazione.toJSON(db.Organizzazione.findOne({id: inputs.id}));
      if (!organizzazione) {
        return exits.notFound({error: 'Organizzazione non trovata.'});
      }
      organizzazione.strutture = db.Struttura.find({organizzazione: organizzazione.id});
      // Per ogni struttura, carica le liste
      for (let struttura of organizzazione.strutture) {
        struttura.liste = db.Lista.find({struttura: struttura.id});
      }
      return exits.success({organizzazione});
    }

    // Lista completa
    let organizzazioni = db.Organizzazione.find().map(o => db.Organizzazione.toJSON(o));
    for (let org of organizzazioni) {
      org.strutture = db.Struttura.find({organizzazione: org.id});
      for (let struttura of org.strutture) {
        struttura.liste = db.Lista.find({struttura: struttura.id});
      }
    }
    return exits.success({organizzazioni});
  }
};
