const ListManager = require('../utility/ListManager');
const CryptHelper = require('../utility/CryptHelper');
module.exports = {

  friendlyName: 'Add lista',

  description: 'Aggiunge una nuova lista al database',

  inputs: {
    denominazione: {
      type: 'string',
      required: true,
      minLength: 2,
      maxLength: 255,
    },
    struttura: {
      type: 'number',
      required: true
    },
    tag: {
      type: 'string',
      required: false,
      allowNull: true,
      description: 'Tag per categorizzare (es. riabilitazioneA, fisioterapia)',
    },
  },

  exits: {
    success: {
      description: 'Lista aggiunta con successo.'
    },
    invalid: {
      responseType: 'badRequest',
      description: 'I dati forniti non sono validi.'
    }
  },

  fn: async function (inputs, exits) {
    sails.log.info(`[add-lista] Creazione lista "${inputs.denominazione}" per struttura #${inputs.struttura}`);
    let keyPairList = await CryptHelper.RSAGenerateKeyPair();
    try {
      let nuovaLista = await Lista.create({
        denominazione: inputs.denominazione,
        tag: inputs.tag || null,
        publicKey: keyPairList.publicKey,
        privateKey: keyPairList.privateKey,
        struttura: inputs.struttura,
        ultimaVersioneSuBlockchain: 0
      }).fetch();
      sails.log.info(`[add-lista] Lista #${nuovaLista.id} creata nel DB`);

      // Blockchain publish in background (non-bloccante)
      const listaId = nuovaLista.id;
      const strutturaId = nuovaLista.struttura;
      setImmediate(async () => {
        try {
          const manager = new ListManager();
          sails.log.info(`[add-lista] Blockchain: pubblicazione PRIVATE_KEY per lista #${listaId}...`);
          const walletId = await Lista.getWalletIdLista({id: listaId});
          const res1 = await manager.updatePrivateKey(walletId, keyPairList.privateKey);
          sails.log.info(`[add-lista] Blockchain: PRIVATE_KEY ${res1.success ? 'OK' : 'FAILED'}`);

          sails.log.info(`[add-lista] Blockchain: pubblicazione STRUTTURA_DATA per struttura #${strutturaId}...`);
          const res2 = await manager.updateDatiStrutturaToBlockchain(strutturaId);
          sails.log.info(`[add-lista] Blockchain: STRUTTURA_DATA ${res2.success ? 'OK' : 'FAILED'}`);

          sails.log.info(`[add-lista] Blockchain: pubblicazione MAIN_DATA...`);
          const res3 = await manager.updateOrganizzazioniStruttureListeToBlockchain();
          sails.log.info(`[add-lista] Blockchain: MAIN_DATA ${res3.success ? 'OK' : 'FAILED'}`);
        } catch (err) {
          sails.log.warn('[add-lista] Blockchain publish error:', err.message || err);
        }
      });

      return exits.success({
        lista: {...nuovaLista, privateKey: undefined},
        blockchainStatus: 'publishing',
        error: null
      });
    } catch (err) {
      sails.log.error('[add-lista] DB error:', err.message || err);
      return exits.invalid({
        error: 'Errore durante la creazione della lista.',
      });
    }
  }

};
