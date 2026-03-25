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

    const recordAssistito = db.Assistito.findOne({id: record.assistito});
    const recordLista = db.Lista.findOne({id: record.lista});

    const assistitoNome = recordAssistito ? `${recordAssistito.cognome} ${recordAssistito.nome}` : `#${record.assistito}`;
    sails.log.info(`[rimuovi] ${assistitoNome} rimosso da lista #${record.lista} con stato ${inputs.stato}`);

    // 1. Aggiorna il record principale
    const dataOraUscita = Date.now();
    const updated = db.AssistitiListe.updateOne({id: inputs.idAssistitoListe}).set({
      stato: inputs.stato,
      chiuso: true,
      dataOraUscita,
    });

    // 2. Gestisci le altre liste
    const azioniAltreListe = inputs.azioniAltreListe || [];
    const risultatiAltreListe = [];

    for (const azione of azioniAltreListe) {
      if (azione.azione === 'rimuovi' && azione.idAssistitoListe) {
        const statoRimozione = azione.statoRimozione || 4;
        const altroRecord = db.AssistitiListe.findOne({id: azione.idAssistitoListe});
        if (altroRecord && altroRecord.stato === 1) {
          db.AssistitiListe.updateOne({id: azione.idAssistitoListe}).set({
            stato: statoRimozione,
            chiuso: true,
            dataOraUscita,
          });
          sails.log.info(`[rimuovi] ${assistitoNome} rimosso anche da lista #${altroRecord.lista} con stato ${statoRimozione}`);
          risultatiAltreListe.push({ id: azione.idAssistitoListe, azione: 'rimosso', stato: statoRimozione });
        }
      } else {
        risultatiAltreListe.push({ id: azione.idAssistitoListe, azione: 'mantenuto' });
      }
    }

    // 3. Blockchain publish SINCRONO — garantisce registrazione
    let blockchainOk = false;
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
          dataOraUscita,
          azioniAltreListe: risultatiAltreListe,
        };
        const entityId = `${struttura.organizzazione || 0}_${struttura.id}_${lista.id}`;
        sails.log.info(`[rimuovi] Blockchain: entityId=${entityId}`);
        const encrypted = await CryptHelper.encryptAndSend(JSON.stringify(movimentoData), null, struttura.publicKey);
        const res = await iota.publishData(MOVIMENTI_ASSISTITI_LISTA, encrypted.data, entityId);
        blockchainOk = res.success;
        sails.log.info(`[rimuovi] Blockchain: MOVIMENTI ${res.success ? 'OK' : 'FAILED'}${res.error ? ' err:'+res.error : ''}`);
      }
    } catch (err) {
      sails.log.warn('[rimuovi] Blockchain error:', err.message || err);
    }

    const statiNomi = {2:'in assistenza',3:'completato',4:'cambio lista',5:'rinuncia',6:'annullato'};
    await sails.helpers.broadcastEvent('dataChanged', {
      action: 'USCITA_DA_LISTA',
      entity: 'assistitoLista',
      id: record.id,
      label: `${assistitoNome} → ${recordLista?.denominazione || ''} (${statiNomi[inputs.stato] || inputs.stato})`,
    });

    return exits.success({
      record: updated,
      altreListe: risultatiAltreListe,
      blockchain: { movimenti: blockchainOk },
      error: null,
    });
  }
};
