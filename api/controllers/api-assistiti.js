module.exports = {

  friendlyName: 'API Assistiti',

  description: 'Ritorna lista o dettaglio assistiti con le loro liste.',

  inputs: {
    id: {
      type: 'number',
      required: false,
      description: 'ID assistito per dettaglio'
    },
    search: {
      type: 'string',
      required: false,
      description: 'Ricerca per nome, cognome o codice fiscale'
    }
  },

  exits: {
    success: {
      description: 'Dati assistiti.',
    },
    notFound: {
      responseType: 'notFound',
      description: 'Assistito non trovato.'
    }
  },

  fn: async function (inputs, exits) {
    if (inputs.id) {
      let assistito = await Assistito.findOne({id: inputs.id});
      if (!assistito) {
        return exits.notFound({error: 'Assistito non trovato.'});
      }
      // Carica le liste in coda
      let listeAssistito = await AssistitiListe.find({assistito: inputs.id})
        .populate('lista');
      assistito.listeAssistito = listeAssistito;
      return exits.success({assistito});
    }

    // Lista con ricerca opzionale
    let criteria = {};
    if (inputs.search) {
      const searchTerm = inputs.search.trim();
      criteria = {
        or: [
          {nome: {contains: searchTerm}},
          {cognome: {contains: searchTerm}},
          {codiceFiscale: {contains: searchTerm.toUpperCase()}},
        ]
      };
    }
    let assistiti = await Assistito.find(criteria).sort('cognome ASC');
    return exits.success({assistiti});
  }
};
