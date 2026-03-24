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
        const inCoda = await AssistitiListe.count({lista: lista.id, stato: 1, chiuso: false});
        const usciti = await AssistitiListe.count({lista: lista.id, chiuso: true});
        const totale = await AssistitiListe.count({lista: lista.id});

        // Tempo medio in lista (per chi e uscito con dataOraUscita)
        let tempoMedioGiorni = null;
        const completati = await AssistitiListe.find({lista: lista.id, chiuso: true})
          .select(['dataOraIngresso', 'dataOraUscita']);
        if (completati.length > 0) {
          let sommaMs = 0, count = 0;
          for (const c of completati) {
            if (c.dataOraIngresso && c.dataOraUscita) {
              sommaMs += (c.dataOraUscita - c.dataOraIngresso);
              count++;
            }
          }
          if (count > 0) tempoMedioGiorni = Math.round((sommaMs / count) / (1000 * 60 * 60 * 24) * 10) / 10;
        }

        lista.stats = { inCoda, usciti, totale, tempoMedioGiorni };
      }
    }
    return exits.success({strutture});
  }
};
