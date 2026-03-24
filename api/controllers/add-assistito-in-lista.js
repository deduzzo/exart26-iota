const SyncCache = require('../utility/SyncCache');
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

    let assistito = await Assistito.findOne({id: inputs.idAssistito});
    if (!assistito) {
      return exits.invalid({error: 'Assistito non trovato.'});
    }
    let lista = await Lista.findOne({id: inputs.idLista});
    if (!lista) {
      return exits.invalid({error: 'Lista non trovata.'});
    }

    // Verifica se gia in coda in questa lista
    let giaInCoda = await AssistitiListe.findOne({
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
      assistitoLista = await AssistitiListe.create({
        assistito: inputs.idAssistito,
        lista: inputs.idLista,
        stato: INSERITO_IN_CODA,
        dataOraIngresso: Date.now(),
      }).fetch();
      sails.log.info(`[add-assistito-in-lista] Record #${assistitoLista.id} creato nel DB`);
    } catch (err) {
      sails.log.error('[add-assistito-in-lista] DB error:', err.message);
      return exits.invalid({error: 'Errore durante l\'inserimento.'});
    }

    // Blockchain publish in background (non-bloccante)
    const idAssistito = inputs.idAssistito;
    const idLista = inputs.idLista;
    setImmediate(async () => {
      try {
        const manager = new ListManager();
        sails.log.info(`[add-assistito-in-lista] Blockchain: pubblicazione...`);
        const result = await manager.aggiungiAssistitoInListaToBlockchain(idAssistito, idLista);
        if (result) {
          const {res1, res2, res3} = result;
          sails.log.info(`[add-assistito-in-lista] Blockchain: LISTE_IN_CODA=${res1?.success} MOVIMENTI=${res2?.success} ASSISTITI_IN_LISTA=${res3?.success}`);
        }
      } catch (err) {
        sails.log.warn('[add-assistito-in-lista] Blockchain error:', err.message || err);
      }
    });

    SyncCache.scheduleSave();
      return exits.success({
      assistitoLista,
      blockchainStatus: 'publishing',
      error: null
    });
  }
};
