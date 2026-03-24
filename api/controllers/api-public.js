// L'anonId viene dal campo persistente nel modello Assistito

module.exports = {

  friendlyName: 'API Pubblico Liste',

  description: 'Ritorna tutte le liste con statistiche e coda anonimizzata. Endpoint pubblico senza autenticazione.',

  inputs: {},

  exits: {
    success: { description: 'Liste pubbliche con statistiche.' },
  },

  fn: async function (inputs, exits) {
    // Trova tutte le liste con struttura e organizzazione
    const liste = await Lista.find().populate('struttura');

    const result = [];

    for (const lista of liste) {
      // Popola organizzazione dalla struttura
      let organizzazione = null;
      if (lista.struttura && lista.struttura.organizzazione) {
        organizzazione = await Organizzazione.findOne({ id: lista.struttura.organizzazione });
      }

      // Assistiti attualmente in coda (stato 1, non chiusi)
      const inCoda = await AssistitiListe.find({
        lista: lista.id,
        stato: 1, // INSERITO_IN_CODA
        chiuso: false,
      }).populate('assistito').sort('dataOraIngresso ASC');

      // Tutti i record usciti (stato != 1 oppure chiusi)
      const usciti = await AssistitiListe.find({
        lista: lista.id,
        stato: { '!=': 1 },
      });

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
        anonId: al.assistito?.anonId || '--------',
        stato: al.stato,
        dataOraIngresso: al.dataOraIngresso,
      }));

      // Storico completo anonimizzato (tutti i movimenti, anche chiusi)
      const tuttiMovimenti = await AssistitiListe.find({
        lista: lista.id,
      }).populate('assistito').sort('createdAt DESC');

      const storicoAnonimo = tuttiMovimenti.map((al) => ({
        anonId: al.assistito?.anonId || '--------',
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
          id: lista.struttura.id,
          denominazione: lista.struttura.denominazione,
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
