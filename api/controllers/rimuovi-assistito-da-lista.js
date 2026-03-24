const db = require('../utility/db');
const ListManager = require('../utility/ListManager');
const CryptHelper = require('../utility/CryptHelper');

module.exports = {

  friendlyName: 'Rimuovi assistito da lista',

  description: 'Rimuove un assistito dalla lista con gestione multi-lista.',

  inputs: {
    idAssistitoListe: {
      type: 'number',
      required: true,
      description: 'ID del record AssistitiListe principale da aggiornare',
    },
    stato: {
      type: 'number',
      required: true,
      description: 'Nuovo stato: 2=in assistenza, 3=completato, 4=cambio lista, 5=rinuncia, 6=annullato',
    },
    azioniAltreListe: {
      type: 'json',
      required: false,
      description: 'Array di azioni per le altre liste: [{ idAssistitoListe, azione: "mantieni"|"rimuovi", statoRimozione? }]',
    },
  },

  exits: {
    success: { description: 'Assistito rimosso dalla lista.' },
    invalid: { responseType: 'badRequest' },
  },

  fn: async function (inputs, exits) {
    const statiValidi = [2, 3, 4, 5, 6];
    if (!statiValidi.includes(inputs.stato)) {
      return exits.invalid({error: 'Stato non valido.'});
    }

    const record = db.AssistitiListe.findOne({id: inputs.idAssistitoListe});
    if (!record) {
      return exits.invalid({error: 'Record non trovato.'});
    }
    if (record.stato !== 1) {
      return exits.invalid({error: 'L\'assistito non e in coda.'});
    }

    // Fetch related assistito and lista for logging and blockchain
    const recordAssistito = db.Assistito.findOne({id: record.assistito});
    const recordLista = db.Lista.findOne({id: record.lista});

    const assistitoNome = recordAssistito ? `${recordAssistito.cognome} ${recordAssistito.nome}` : `#${record.assistito}`;
    sails.log.info(`[rimuovi] ${assistitoNome} rimosso da lista #${record.lista} con stato ${inputs.stato}`);

    // 1. Aggiorna il record principale
    const updated = db.AssistitiListe.updateOne({id: inputs.idAssistitoListe}).set({
      stato: inputs.stato,
      chiuso: true,
      dataOraUscita: Date.now(),
    });

    // 2. Gestisci le altre liste
    const azioniAltreListe = inputs.azioniAltreListe || [];
    const risultatiAltreListe = [];

    for (const azione of azioniAltreListe) {
      if (azione.azione === 'rimuovi' && azione.idAssistitoListe) {
        const statoRimozione = azione.statoRimozione || 4; // default: cambio lista
        const altroRecord = db.AssistitiListe.findOne({id: azione.idAssistitoListe});
        if (altroRecord && altroRecord.stato === 1) {
          db.AssistitiListe.updateOne({id: azione.idAssistitoListe}).set({
            stato: statoRimozione,
            chiuso: true,
            dataOraUscita: Date.now(),
          });
          sails.log.info(`[rimuovi] ${assistitoNome} rimosso anche da lista #${altroRecord.lista} con stato ${statoRimozione}`);
          risultatiAltreListe.push({ id: azione.idAssistitoListe, azione: 'rimosso', stato: statoRimozione });
        }
      } else {
        risultatiAltreListe.push({ id: azione.idAssistitoListe, azione: 'mantenuto' });
      }
    }

    // 3. Blockchain publish in background
    setImmediate(async () => {
      try {
        const iota = require('../utility/iota');
        const {MOVIMENTI_ASSISTITI_LISTA} = require('../enums/TransactionDataType');
        const lista = db.Lista.findOne({id: record.lista});
        const struttura = lista ? db.Struttura.findOne({id: lista.struttura}) : null;
        if (lista && struttura) {
          const movimentoData = {
            idAssistitoListe: record.id,
            assistito: record.assistito,
            lista: lista.id,
            statoOld: 1,
            statoNew: inputs.stato,
            dataOraUscita: Date.now(),
            azioniAltreListe: risultatiAltreListe,
          };
          const entityId = await Lista.getWalletIdLista({id: lista.id});
          const encrypted = await CryptHelper.encryptAndSend(JSON.stringify(movimentoData), null, struttura.publicKey);
          const res = await iota.publishData(MOVIMENTI_ASSISTITI_LISTA, encrypted.data, entityId);
          sails.log.info(`[rimuovi] Blockchain: MOVIMENTI ${res.success ? 'OK' : 'FAILED'}`);
        }
      } catch (err) {
        sails.log.warn('[rimuovi] Blockchain error:', err.message || err);
      }
    });

    return exits.success({
      record: updated,
      altreListe: risultatiAltreListe,
      blockchainStatus: 'publishing',
      error: null,
    });
  }
};
