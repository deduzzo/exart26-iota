module.exports = {

  friendlyName: 'API Assistiti',

  description: 'Ritorna lista o dettaglio assistiti con le loro liste assegnate.',

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

    // Per ogni assistito, carica le liste assegnate con posizione
    for (let i = 0; i < assistiti.length; i++) {
      const listeAss = await AssistitiListe.find({
        assistito: assistiti[i].id,
        chiuso: false
      }).populate('lista').sort('dataOraIngresso ASC');

      // Calcola posizione in ogni lista
      assistiti[i].listeAssegnate = [];
      for (const al of listeAss) {
        let posizione = null;
        if (al.stato === 1 && al.lista) { // INSERITO_IN_CODA
          // Conta quanti sono in coda in questa lista PRIMA di questo assistito
          const precedenti = await AssistitiListe.count({
            lista: typeof al.lista === 'object' ? al.lista.id : al.lista,
            stato: 1,
            chiuso: false,
            dataOraIngresso: { '<=': al.dataOraIngresso },
          });
          posizione = precedenti;
        }
        assistiti[i].listeAssegnate.push({
          id: al.id,
          listaId: typeof al.lista === 'object' ? al.lista.id : al.lista,
          listaNome: typeof al.lista === 'object' ? al.lista.denominazione : null,
          stato: al.stato,
          posizione: posizione,
          dataOraIngresso: al.dataOraIngresso,
        });
      }
    }

    return exits.success({assistiti});
  }
};
