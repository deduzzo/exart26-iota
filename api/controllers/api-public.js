// L'anonId viene dal campo persistente nel modello Assistito
const db = require('../utility/db');

module.exports = {

  friendlyName: 'API Pubblico Liste',

  description: 'Ritorna tutte le liste con statistiche e coda anonimizzata. Endpoint pubblico senza autenticazione.',

  inputs: {},

  exits: {
    success: { description: 'Liste pubbliche con statistiche.' },
  },

  fn: async function (inputs, exits) {
    // Trova tutte le liste con struttura
    const liste = db.Lista.findWithStruttura();

    const result = [];

    for (const lista of liste) {
      // Popola organizzazione dalla struttura
      let organizzazione = null;
      if (lista.strOrganizzazione) {
        organizzazione = db.Organizzazione.toJSON(db.Organizzazione.findOne({ id: lista.strOrganizzazione }));
      }

      // Assistiti attualmente in coda (stato 1, non chiusi) with assistito details
      const inCoda = db.AssistitiListe.findWithDetails(
        {lista: lista.id, stato: 1, chiuso: false},
        { sort: 'al.dataOraIngresso ASC' }
      );

      // Tutti i record usciti (stato != 1)
      const usciti = db.raw.prepare(
        `SELECT * FROM assistiti_liste WHERE lista = ? AND stato != 1`
      ).all(lista.id);

      // Calcola tempo medio di attesa per chi e uscito (in giorni)
      let tempoMedioGiorni = 0;
      const conUscita = usciti.filter(al => al.dataOraUscita && al.dataOraIngresso);
      if (conUscita.length > 0) {
        const sommaGiorni = conUscita.reduce((sum, al) => {
          const diffMs = al.dataOraUscita - al.dataOraIngresso;
          return sum + (diffMs / (1000 * 60 * 60 * 24));
        }, 0);
        tempoMedioGiorni = Math.round(sommaGiorni / conUscita.length);
      }

      // Coda anonimizzata
      const codaAnonima = inCoda.map((al, i) => ({
        position: i + 1,
        anonId: al.assAnonId || '--------',
        stato: al.stato,
        dataOraIngresso: al.dataOraIngresso,
      }));

      // Storico completo anonimizzato (tutti i movimenti, anche chiusi)
      const tuttiMovimenti = db.AssistitiListe.findWithDetails(
        {lista: lista.id},
        { sort: 'al.createdAt DESC' }
      );

      const storicoAnonimo = tuttiMovimenti.map((al) => ({
        anonId: al.assAnonId || '--------',
        stato: al.stato,
        chiuso: al.chiuso,
        dataOraIngresso: al.dataOraIngresso,
        dataOraUscita: al.dataOraUscita || null,
      }));

      result.push({
        id: lista.id,
        denominazione: lista.denominazione,
        aperta: lista.aperta,
        struttura: lista.struttura ? {
          id: lista.struttura,
          denominazione: lista.strDenominazione,
        } : null,
        organizzazione: organizzazione ? {
          id: organizzazione.id,
          denominazione: organizzazione.denominazione,
        } : null,
        stats: {
          inCoda: inCoda.length,
          usciti: usciti.length,
          totale: tuttiMovimenti.length,
          tempoMedioGiorni,
        },
        coda: codaAnonima,
        storico: storicoAnonimo,
      });
    }

    return exits.success(result);
  }
};
