const db = require('../utility/db');

module.exports = {

  friendlyName: 'Verify snapshot',
  description: 'Confronta uno snapshot JSON precedente con lo stato attuale del DB.',

  inputs: {
    snapshot: {
      type: 'ref',
      required: true,
      description: 'Il contenuto JSON dello snapshot da verificare',
    },
  },

  exits: {
    success: { description: 'Risultato verifica.' },
    invalid: { responseType: 'badRequest' },
  },

  fn: async function (inputs, exits) {
    const snapshot = inputs.snapshot;
    if (!snapshot || !snapshot.data || !snapshot.stats) {
      return exits.invalid({ error: 'Formato snapshot non valido. Deve contenere "data" e "stats".' });
    }

    // Esporta lo stato attuale (stessa logica di export-data)
    const organizzazioni = db.Organizzazione.find().sort((a, b) => a.id - b.id);
    const strutture = db.Struttura.find().sort((a, b) => a.id - b.id);
    const liste = db.Lista.find().sort((a, b) => a.id - b.id);
    const assistiti = db.Assistito.find().sort((a, b) => a.id - b.id);
    const assistitiListe = db.AssistitiListe.find().sort((a, b) => a.id - b.id);

    const sanitize = (arr) => arr.map(item => {
      const copy = { ...item };
      delete copy.privateKey;
      return copy;
    });

    const currentData = {
      organizzazioni: sanitize(organizzazioni),
      strutture: sanitize(strutture),
      liste: sanitize(liste),
      assistiti: sanitize(assistiti),
      assistitiListe: assistitiListe,
    };

    const currentStats = {
      organizzazioni: organizzazioni.length,
      strutture: strutture.length,
      liste: liste.length,
      assistiti: assistiti.length,
      assistitiListe: assistitiListe.length,
      assistitiInCoda: assistitiListe.filter(al => al.stato === 1 && !al.chiuso).length,
      assistitiUsciti: assistitiListe.filter(al => al.stato > 1 || al.chiuso).length,
    };

    // Confronta conteggi
    const statsDiffs = [];
    const statsKeys = ['organizzazioni', 'strutture', 'liste', 'assistiti', 'assistitiListe', 'assistitiInCoda', 'assistitiUsciti'];
    for (const k of statsKeys) {
      const orig = snapshot.stats[k];
      const curr = currentStats[k];
      if (orig !== curr) {
        statsDiffs.push({ campo: k, originale: orig, attuale: curr });
      }
    }

    // Confronta record per record
    const recordDiffs = [];
    const tables = ['organizzazioni', 'strutture', 'liste', 'assistiti', 'assistitiListe'];

    for (const table of tables) {
      const origRecords = snapshot.data[table] || [];
      const currRecords = currentData[table] || [];

      // Record mancanti nel DB attuale
      for (const orig of origRecords) {
        const curr = currRecords.find(r => r.id === orig.id);
        if (!curr) {
          recordDiffs.push({ tabella: table, id: orig.id, tipo: 'MANCANTE', dettaglio: 'Record presente nello snapshot ma non nel DB attuale' });
          continue;
        }
        // Confronta campi (escludi publicKey e updatedAt)
        const fieldsToCompare = Object.keys(orig).filter(k => k !== 'publicKey' && k !== 'updatedAt');
        for (const f of fieldsToCompare) {
          if (JSON.stringify(orig[f]) !== JSON.stringify(curr[f])) {
            recordDiffs.push({
              tabella: table,
              id: orig.id,
              tipo: 'DIVERSO',
              campo: f,
              originale: orig[f],
              attuale: curr[f],
            });
          }
        }
      }

      // Record extra nel DB attuale
      for (const curr of currRecords) {
        const orig = origRecords.find(r => r.id === curr.id);
        if (!orig) {
          recordDiffs.push({ tabella: table, id: curr.id, tipo: 'EXTRA', dettaglio: 'Record nel DB attuale ma non nello snapshot' });
        }
      }
    }

    const identical = statsDiffs.length === 0 && recordDiffs.length === 0;

    return exits.success({
      identical,
      snapshotDate: snapshot.exportedAt,
      statsComparison: {
        allMatch: statsDiffs.length === 0,
        diffs: statsDiffs,
        originale: snapshot.stats,
        attuale: currentStats,
      },
      recordComparison: {
        allMatch: recordDiffs.length === 0,
        totalDiffs: recordDiffs.length,
        diffs: recordDiffs.slice(0, 50), // Max 50 differenze per non sovraccaricare
      },
      summary: identical
        ? 'Lo snapshot e IDENTICO allo stato attuale del database. La ricostruzione e perfetta.'
        : `Trovate ${statsDiffs.length} differenze nei conteggi e ${recordDiffs.length} differenze nei record.`,
    });
  }
};
