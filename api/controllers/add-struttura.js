const CryptHelper = require('../utility/CryptHelper');
const ListManager = require('../utility/ListManager');
module.exports = {

  friendlyName: 'Add struttura',

  description: '',

  inputs: {
    denominazione: {
      type: 'string',
      required: true,
      minLength: 2,
      maxLength: 255,
    },
    indirizzo: {
      type: 'string',
      required: true,
      minLength: 2,
    },
    organizzazione: {
      type: 'number',
      required: true
    },
    attiva: {
      type: 'boolean',
      required: false,
      defaultsTo: true
    },
  },

  exits: {
    success: {
      description: 'Struttura aggiunta con successo.'
    },
    invalid: {
      responseType: 'badRequest',
      description: 'I dati forniti non sono validi.'
    }
  },

  fn: async function (inputs, exits) {
    let keyPairStr = await CryptHelper.RSAGenerateKeyPair();
    try {
      let organizzazione = await Organizzazione.findOne({id: inputs.organizzazione});
      if (!organizzazione) {
        return exits.invalid('Organizzazione non trovata.');
      }
      let nuovaStruttura = await Struttura.create({
        denominazione: inputs.denominazione,
        indirizzo: inputs.indirizzo,
        attiva: inputs.attiva,
        publicKey: keyPairStr.publicKey,
        privateKey: keyPairStr.privateKey,
        ultimaVersioneSuBlockchain: -1,
        organizzazione: inputs.organizzazione
      }).fetch();

      // Blockchain publish in background (non-bloccante)
      const strutturaId = nuovaStruttura.id;
      setImmediate(async () => {
        try {
          const manager = new ListManager();
          const res1 = await manager.updateDatiStrutturaToBlockchain(strutturaId);
          if (res1.success) sails.log.info('Blockchain: STRUTTURA_DATA OK');
          else sails.log.warn('Blockchain: STRUTTURA_DATA failed', res1.error);

          const walletId = await Struttura.getWalletIdStruttura({id: strutturaId});
          const res2 = await manager.updatePrivateKey(walletId, keyPairStr.privateKey);
          if (res2.success) sails.log.info('Blockchain: PRIVATE_KEY OK');
          else sails.log.warn('Blockchain: PRIVATE_KEY failed', res2.error);

          const res3 = await manager.updateOrganizzazioniStruttureListeToBlockchain();
          if (res3.success) sails.log.info('Blockchain: MAIN_DATA OK');
          else sails.log.warn('Blockchain: MAIN_DATA failed', res3.error);
        } catch (err) {
          sails.log.warn('Blockchain publish error (struttura):', err.message || err);
        }
      });

      return exits.success({
        struttura: {...nuovaStruttura, privateKey: undefined},
        blockchainStatus: 'publishing',
        error: null
      });
    } catch (err) {
      return exits.invalid({
        error: err.message || JSON.stringify(err),
      });
    }
  }

};
