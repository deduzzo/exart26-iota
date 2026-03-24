let iota = require('../utility/iota');
const CryptHelper = require('../utility/CryptHelper');
const ListManager = require('../utility/ListManager');


module.exports = {
  friendlyName: 'Add organizzazione',

  description: 'Aggiunge una nuova organizzazione al database',

  inputs: {
    denominazione: {
      type: 'string',
      required: true,
      minLength: 2,
      maxLength: 255,
    },
  },

  exits: {
    success: {
      description: 'Organizzazione aggiunta con successo.',
    },
    invalid: {
      responseType: 'badRequest',
      description: 'I dati forniti non sono validi.'
    }
  },

  fn: async function (inputs, exits) {
    let keyPairOrg = await CryptHelper.RSAGenerateKeyPair();
    try {
      let nuovaOrganizzazione = await Organizzazione.create({
        denominazione: inputs.denominazione,
        publicKey: keyPairOrg.publicKey,
        privateKey: keyPairOrg.privateKey,
        ultimaVersioneSuBlockchain: -1
      }).fetch();

      // Blockchain publish in background (non-bloccante)
      const manager = new ListManager();
      const orgId = nuovaOrganizzazione.id;
      setImmediate(async () => {
        try {
          const res1 = await manager.updateDatiOrganizzazioneToBlockchain(orgId);
          if (res1.success) sails.log.info('Blockchain: ORGANIZZAZIONE_DATA OK');
          else sails.log.warn('Blockchain: ORGANIZZAZIONE_DATA failed', res1.error);

          const walletId = await Organizzazione.getWalletIdOrganizzazione({id: orgId});
          const res2 = await manager.updatePrivateKey(walletId, keyPairOrg.privateKey);
          if (res2.success) sails.log.info('Blockchain: PRIVATE_KEY OK');
          else sails.log.warn('Blockchain: PRIVATE_KEY failed', res2.error);

          const res3 = await manager.updateOrganizzazioniStruttureListeToBlockchain();
          if (res3.success) sails.log.info('Blockchain: MAIN_DATA OK');
          else sails.log.warn('Blockchain: MAIN_DATA failed', res3.error);
        } catch (err) {
          sails.log.warn('Blockchain publish error (organizzazione):', err.message || err);
        }
      });

      return exits.success({
        organizzazione: {...nuovaOrganizzazione, privateKey: undefined},
        blockchainStatus: 'publishing',
        error: null
      });
    } catch (err) {
      sails.log.error(err);
      return exits.invalid({
        error: err.message || err.error,
      });
    }
  }
};
