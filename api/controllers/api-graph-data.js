const db = require('../utility/db');

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
    // Carica tutte le entita
    let organizzazioni = db.Organizzazione.find();
    // Add strutture to each org
    for (const org of organizzazioni) {
      org.strutture = db.Struttura.find({organizzazione: org.id});
    }

    let strutture = db.Struttura.find();
    for (let s of strutture) {
      s.organizzazione = db.Organizzazione.findOne({id: s.organizzazione});
      s.liste = db.Lista.find({struttura: s.id});
      delete s.privateKey;
      delete s.publicKey;
    }

    let assistiti = stripKeys(db.Assistito.find());

    let assistitiListe = db.AssistitiListe.findWithDetails({ chiuso: false }, { limit: 5000 });
    // Reshape to match expected format (assistito/lista as objects)
    assistitiListe = assistitiListe.map(al => ({
      id: al.id,
      assistito: {
        id: al.assistito,
        nome: al.assNome,
        cognome: al.assCognome,
        codiceFiscale: al.assCF,
        anonId: al.assAnonId,
      },
      lista: {
        id: al.lista,
        denominazione: al.listaDenominazione,
        struttura: al.listaStruttura,
      },
      stato: al.stato,
      chiuso: al.chiuso,
      dataOraIngresso: al.dataOraIngresso,
      dataOraUscita: al.dataOraUscita,
    }));

    return {
      organizzazioni,
      strutture,
      assistiti,
      assistitiListe,
    };
  }
};
