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
    const lista = await Lista.findOne({id: inputs.idLista}).populate('struttura');
    if (!lista) return exits.notFound({error: 'Lista non trovata.'});

    // Assistiti attualmente in coda (stato 1) ordinati per ingresso
    const inCoda = await AssistitiListe.find({
      lista: inputs.idLista,
      stato: 1, // INSERITO_IN_CODA
      chiuso: false,
    }).populate('assistito').sort('dataOraIngresso ASC');

    // Aggiungi posizione
    const codaConPosizione = inCoda.map((al, i) => ({
      id: al.id,
      posizione: i + 1,
      assistito: al.assistito,
      stato: al.stato,
      dataOraIngresso: al.dataOraIngresso,
    }));

    // Storico completo (tutti gli stati, anche chiusi)
    const storico = await AssistitiListe.find({
      lista: inputs.idLista,
    }).populate('assistito').sort('createdAt DESC');

    const storicoFormattato = storico.map(al => ({
      id: al.id,
      assistito: al.assistito,
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
