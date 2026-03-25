const db = require('../utility/db');

module.exports = {

  friendlyName: 'Export data',
  description: 'Esporta tutti i dati del sistema in formato JSON per backup/verifica.',

  exits: {
    success: { description: 'Dati esportati.' },
  },

  fn: async function (inputs, exits) {
    // Raccogli tutti i dati dal DB ordinati per id
    const organizzazioni = db.Organizzazione.find().sort((a, b) => a.id - b.id);
    const strutture = db.Struttura.find().sort((a, b) => a.id - b.id);
    const liste = db.Lista.find().sort((a, b) => a.id - b.id);
    const assistiti = db.Assistito.find().sort((a, b) => a.id - b.id);
    const assistitiListe = db.AssistitiListe.find().sort((a, b) => a.id - b.id);

    // Rimuovi le chiavi private dai dati esportati (sensibili)
    const sanitize = (arr) => arr.map(item => {
      const copy = { ...item };
      delete copy.privateKey;
      return copy;
    });

    const snapshot = {
      exportedAt: new Date().toISOString(),
      stats: {
        organizzazioni: organizzazioni.length,
        strutture: strutture.length,
        liste: liste.length,
        assistiti: assistiti.length,
        assistitiListe: assistitiListe.length,
        assistitiInCoda: assistitiListe.filter(al => al.stato === 1 && !al.chiuso).length,
        assistitiUsciti: assistitiListe.filter(al => al.stato > 1 || al.chiuso).length,
      },
      data: {
        organizzazioni: sanitize(organizzazioni),
        strutture: sanitize(strutture),
        liste: sanitize(liste),
        assistiti: sanitize(assistiti),
        assistitiListe: assistitiListe,
      },
    };

    this.res.set('Content-Disposition', `attachment; filename="exart26-export-${Date.now()}.json"`);
    this.res.set('Content-Type', 'application/json');
    return this.res.json(snapshot);
  }
};
