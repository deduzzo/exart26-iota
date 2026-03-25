const db = require('../utility/db');
const ListManager = require('../utility/ListManager');
const {INSERITO_IN_CODA} = require('../enums/StatoLista');
module.exports = {

  friendlyName: 'Add assistito in lista',

  description: 'Aggiunge un assistito in una lista.',

  inputs: {
    idAssistito: {
      type: 'number',
      required: true
    },
    idLista: {
      type: 'number',
      required: true
    }
  },

  exits: {
    success: {
      description: 'Assistito aggiunto in lista con successo.',
    },
    invalid: {
      responseType: 'badRequest',
      description: 'I dati forniti non sono validi'
    }
  },

  fn: async function (inputs, exits) {
    sails.log.info(`[add-assistito-in-lista] Assistito #${inputs.idAssistito} -> Lista #${inputs.idLista}`);

    let assistito = db.Assistito.findOne({id: inputs.idAssistito});
    if (!assistito) {
      return exits.invalid({error: 'Assistito non trovato.'});
    }
    let lista = db.Lista.findOne({id: inputs.idLista});
    if (!lista) {
      return exits.invalid({error: 'Lista non trovata.'});
    }

    // Verifica se gia in coda in questa lista
    let giaInCoda = db.AssistitiListe.findOne({
      assistito: inputs.idAssistito,
      lista: inputs.idLista,
      stato: INSERITO_IN_CODA,
      chiuso: false
    });
    if (giaInCoda) {
      return exits.invalid({error: 'Assistito gia presente in questa lista.'});
    }

    // Crea il record nel DB locale
    let assistitoLista = null;
    try {
      assistitoLista = db.AssistitiListe.create({
        assistito: inputs.idAssistito,
        lista: inputs.idLista,
        stato: INSERITO_IN_CODA,
        dataOraIngresso: Date.now(),
      });
      sails.log.info(`[add-assistito-in-lista] Record #${assistitoLista.id} creato nel DB`);
    } catch (err) {
      sails.log.error('[add-assistito-in-lista] DB error:', err.message);
      return exits.invalid({error: 'Errore durante l\'inserimento.'});
    }

    // Blockchain publish SINCRONO con retry — garantisce che la TX venga registrata
    const manager = new ListManager();
    let blockchainResult = null;
    try {
      sails.log.info(`[add-assistito-in-lista] Blockchain: pubblicazione ASS#${inputs.idAssistito} -> Lista#${inputs.idLista} (record #${assistitoLista.id})...`);
      blockchainResult = await manager.aggiungiAssistitoInListaToBlockchain(inputs.idAssistito, inputs.idLista);
      if (blockchainResult) {
        const {res1, res2, res3} = blockchainResult;
        sails.log.info(`[add-assistito-in-lista] Blockchain: LIC=${res1?.success} MOV=${res2?.success} AIL=${res3?.success}`);

        // Se qualche TX fallisce, logga errore ma non annullare il record locale
        if (!res1?.success || !res2?.success) {
          sails.log.warn(`[add-assistito-in-lista] ATTENZIONE: TX parzialmente fallita LIC=${res1?.success} MOV=${res2?.success} AIL=${res3?.success}`);
        }
      } else {
        sails.log.warn(`[add-assistito-in-lista] Blockchain: nessuna TX pubblicata`);
      }
    } catch (err) {
      sails.log.warn('[add-assistito-in-lista] Blockchain error:', err.message || err);
    }

    const assistitoRec = db.Assistito.findOne({id: inputs.idAssistito});
    const listaRec = db.Lista.findOne({id: inputs.idLista});
    await sails.helpers.broadcastEvent('dataChanged', {
      action: 'INGRESSO_IN_LISTA',
      entity: 'assistitoLista',
      id: assistitoLista.id,
      label: `${assistitoRec?.cognome || ''} ${assistitoRec?.nome || ''} → ${listaRec?.denominazione || ''}`,
    });

    return exits.success({
      assistitoLista,
      blockchain: blockchainResult ? {
        listeInCoda: blockchainResult.res1?.success || false,
        movimenti: blockchainResult.res2?.success || false,
        assistitiInLista: blockchainResult.res3?.success || false,
      } : null,
      error: null
    });
  }
};
