// Helper to remove heavy RSA keys (~2.2KB per record)
function stripKeys(records) {
  return records.map(r => {
    const o = { ...r };
    delete o.privateKey;
    delete o.publicKey;
    return o;
  });
}

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
    // Carica tutte le entita (stripKeys rimuove privateKey/publicKey che sails-disk non filtra con .select())
    let organizzazioni = await Organizzazione.find().populate('strutture');
    let strutture = (await Struttura.find().populate('organizzazione').populate('liste'))
      .map(s => {
        const o = { ...s };
        delete o.privateKey;
        delete o.publicKey;
        return o;
      });
    let assistiti = stripKeys(await Assistito.find());
    let assistitiListe = await AssistitiListe.find({ chiuso: false })
      .populate('assistito')
      .populate('lista')
      .limit(5000);

    return {
      organizzazioni,
      strutture,
      assistiti,
      assistitiListe,
    };
  }
};
