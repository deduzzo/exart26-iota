const db = require('../utility/db');

module.exports = {

  friendlyName: 'API Liste Dettaglio',

  description: 'Ritorna il dettaglio di una lista con assistiti in coda (con posizione) e storico movimenti.',

  inputs: {
    idLista: {
      type: 'number',
      required: true,
    }
  },

  exits: {
    success: { description: 'Dettaglio lista.' },
    notFound: { responseType: 'notFound' },
  },

  fn: async function (inputs, exits) {
    const lista = db.Lista.findOne({id: inputs.idLista});
    if (!lista) return exits.notFound({error: 'Lista non trovata.'});

    // Add struttura info
    lista.struttura = lista.struttura ? db.Struttura.findOne({id: lista.struttura}) : null;

    // Assistiti attualmente in coda (stato 1) ordinati per ingresso, with assistito details
    const inCoda = db.AssistitiListe.findWithDetails(
      {lista: inputs.idLista, stato: 1, chiuso: false},
      { sort: 'al.dataOraIngresso ASC' }
    );

    // Aggiungi posizione
    const codaConPosizione = inCoda.map((al, i) => ({
      id: al.id,
      posizione: i + 1,
      assistito: {
        id: al.assistito,
        nome: al.assNome,
        cognome: al.assCognome,
        codiceFiscale: al.assCF,
        anonId: al.assAnonId,
      },
      stato: al.stato,
      dataOraIngresso: al.dataOraIngresso,
    }));

    // Storico completo (tutti gli stati, anche chiusi) with assistito details
    const storico = db.AssistitiListe.findWithDetails(
      {lista: inputs.idLista},
      { sort: 'al.createdAt DESC' }
    );

    const storicoFormattato = storico.map(al => ({
      id: al.id,
      assistito: {
        id: al.assistito,
        nome: al.assNome,
        cognome: al.assCognome,
        codiceFiscale: al.assCF,
        anonId: al.assAnonId,
      },
      stato: al.stato,
      chiuso: al.chiuso,
      dataOraIngresso: al.dataOraIngresso,
      dataOraUscita: al.dataOraUscita || null,
      createdAt: al.createdAt,
    }));

    return exits.success({
      lista: {
        id: lista.id,
        denominazione: lista.denominazione,
        aperta: lista.aperta,
        struttura: lista.struttura,
        publicKey: lista.publicKey,
        ultimaVersioneSuBlockchain: lista.ultimaVersioneSuBlockchain,
      },
      coda: codaConPosizione,
      totaleInCoda: codaConPosizione.length,
      storico: storicoFormattato,
    });
  }
};
