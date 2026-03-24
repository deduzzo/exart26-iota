const db = require('../utility/db');

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
    // Pre-aggregate all AssistitiListe stats in a single query (eliminates N+1)
    const allAssistitiListe = db.AssistitiListe.find();
    const statsByLista = {};
    for (const al of allAssistitiListe) {
      const lid = al.lista;
      if (!statsByLista[lid]) {
        statsByLista[lid] = { inCoda: 0, usciti: 0, totale: 0, tempoTotaleMs: 0, tempoCount: 0 };
      }
      const s = statsByLista[lid];
      s.totale++;
      if (al.stato === 1 && !al.chiuso) {
        s.inCoda++;
      }
      if (al.chiuso) {
        s.usciti++;
        if (al.dataOraIngresso && al.dataOraUscita) {
          s.tempoTotaleMs += new Date(al.dataOraUscita) - new Date(al.dataOraIngresso);
          s.tempoCount++;
        }
      }
    }

    if (inputs.id) {
      let struttura = db.Struttura.findOne({id: inputs.id});
      if (!struttura) {
        return exits.notFound({error: 'Struttura non trovata.'});
      }
      // Add organizzazione
      struttura.organizzazione = db.Organizzazione.findOne({id: struttura.organizzazione});
      // Add liste
      struttura.liste = db.Lista.find({struttura: struttura.id});
      for (let lista of struttura.liste) {
        lista.assistitiInCoda = (statsByLista[lista.id] || {}).inCoda || 0;
      }
      return exits.success({struttura});
    }

    // Lista filtrata o completa
    let criteria = {};
    if (inputs.organizzazione) {
      criteria.organizzazione = inputs.organizzazione;
    }
    let strutture = db.Struttura.find(criteria);
    for (let str of strutture) {
      // Add organizzazione
      str.organizzazione = db.Organizzazione.findOne({id: str.organizzazione});
      // Add liste
      str.liste = db.Lista.find({struttura: str.id});
      for (let lista of str.liste) {
        const raw = statsByLista[lista.id] || { inCoda: 0, usciti: 0, totale: 0, tempoTotaleMs: 0, tempoCount: 0 };
        let tempoMedioGiorni = null;
        if (raw.tempoCount > 0) {
          tempoMedioGiorni = Math.round((raw.tempoTotaleMs / raw.tempoCount) / 86400000 * 10) / 10;
        }
        lista.stats = { inCoda: raw.inCoda, usciti: raw.usciti, totale: raw.totale, tempoMedioGiorni };
      }
    }
    return exits.success({strutture});
  }
};
