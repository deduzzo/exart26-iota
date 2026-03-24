const db = require('../utility/db');

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
      let assistito = db.Assistito.toJSON(db.Assistito.findOne({id: inputs.id}));
      if (!assistito) {
        return exits.notFound({error: 'Assistito non trovato.'});
      }
      // Load liste with details
      let listeAssistito = db.AssistitiListe.findWithDetails({assistito: inputs.id});
      assistito.listeAssistito = listeAssistito;
      return exits.success({assistito});
    }

    // Lista con ricerca opzionale
    let assistiti;
    if (inputs.search) {
      const searchTerm = inputs.search.trim();
      const searchUpper = searchTerm.toUpperCase();
      const likeTerm = `%${searchTerm}%`;
      const likeTermUpper = `%${searchUpper}%`;
      // Use raw SQL for LIKE search (db.js find doesn't support 'contains')
      assistiti = db.raw.prepare(
        `SELECT * FROM assistiti WHERE nome LIKE ? OR cognome LIKE ? OR codiceFiscale LIKE ? ORDER BY cognome ASC`
      ).all(likeTerm, likeTerm, likeTermUpper);
    } else {
      assistiti = db.Assistito.find({}, { sort: 'cognome ASC' });
    }

    // Strip privateKey for response
    assistiti = assistiti.map(a => db.Assistito.toJSON(a));

    // Per ogni assistito, carica le liste assegnate con posizione
    for (let i = 0; i < assistiti.length; i++) {
      const listeAss = db.AssistitiListe.findWithDetails(
        {assistito: assistiti[i].id, chiuso: false},
        { sort: 'al.dataOraIngresso ASC' }
      );

      // Calcola posizione in ogni lista
      assistiti[i].listeAssegnate = [];
      for (const al of listeAss) {
        let posizione = null;
        if (al.stato === 1 && al.listaDenominazione) { // INSERITO_IN_CODA and lista exists
          // Conta quanti sono in coda in questa lista PRIMA di questo assistito
          const precedenti = db.raw.prepare(
            `SELECT COUNT(*) as cnt FROM assistiti_liste WHERE lista = ? AND stato = 1 AND chiuso = 0 AND dataOraIngresso <= ?`
          ).get(al.lista, al.dataOraIngresso);
          posizione = precedenti.cnt;
        }
        assistiti[i].listeAssegnate.push({
          id: al.id,
          listaId: al.lista,
          listaNome: al.listaDenominazione || null,
          stato: al.stato,
          posizione: posizione,
          dataOraIngresso: al.dataOraIngresso,
        });
      }
    }

    return exits.success({assistiti});
  }
};
