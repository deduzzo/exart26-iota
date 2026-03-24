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
      let organizzazione = await Organizzazione.findOne({id: inputs.id}).populate('strutture');
      if (!organizzazione) {
        return exits.notFound({error: 'Organizzazione non trovata.'});
      }
      // Per ogni struttura, carica le liste
      for (let struttura of organizzazione.strutture) {
        struttura.liste = await Lista.find({struttura: struttura.id});
      }
      return exits.success({organizzazione});
    }

    // Lista completa
    let organizzazioni = await Organizzazione.find().populate('strutture');
    for (let org of organizzazioni) {
      for (let struttura of org.strutture) {
        struttura.liste = await Lista.find({struttura: struttura.id});
      }
    }
    return exits.success({organizzazioni});
  }
};
