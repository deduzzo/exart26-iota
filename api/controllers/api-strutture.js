module.exports = {

  friendlyName: 'API Strutture',

  description: 'Ritorna strutture filtrabili per organizzazione.',

  inputs: {
    organizzazione: {
      type: 'number',
      required: false,
      description: 'Filtra per ID organizzazione'
    },
    id: {
      type: 'number',
      required: false,
      description: 'ID struttura per dettaglio'
    }
  },

  exits: {
    success: {
      description: 'Dati strutture.',
    },
    notFound: {
      responseType: 'notFound',
      description: 'Struttura non trovata.'
    }
  },

  fn: async function (inputs, exits) {
    if (inputs.id) {
      let struttura = await Struttura.findOne({id: inputs.id})
        .populate('organizzazione')
        .populate('liste');
      if (!struttura) {
        return exits.notFound({error: 'Struttura non trovata.'});
      }
      // Per ogni lista, carica il conteggio assistiti in coda
      for (let lista of struttura.liste) {
        lista.assistitiInCoda = await AssistitiListe.count({lista: lista.id, stato: 1, chiuso: false});
      }
      return exits.success({struttura});
    }

    // Lista filtrata o completa
    let criteria = {};
    if (inputs.organizzazione) {
      criteria.organizzazione = inputs.organizzazione;
    }
    let strutture = await Struttura.find(criteria).populate('organizzazione').populate('liste');
    for (let str of strutture) {
      for (let lista of str.liste) {
        lista.assistitiInCoda = await AssistitiListe.count({lista: lista.id, stato: 1, chiuso: false});
      }
    }
    return exits.success({strutture});
  }
};
