module.exports = {

  friendlyName: 'API Graph Data',

  description: 'Ritorna tutti i dati necessari per il grafo interattivo: entita e relazioni.',

  inputs: {},

  exits: {
    success: {
      description: 'Dati per il grafo.',
    },
  },

  fn: async function () {
    // Carica tutte le entita
    let organizzazioni = await Organizzazione.find().populate('strutture');
    let strutture = await Struttura.find().populate('organizzazione').populate('liste');
    let assistiti = await Assistito.find();
    let assistitiListe = await AssistitiListe.find({chiuso: false})
      .populate('assistito')
      .populate('lista');

    return {
      organizzazioni,
      strutture,
      assistiti,
      assistitiListe,
    };
  }
};
