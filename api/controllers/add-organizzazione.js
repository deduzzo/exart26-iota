const db = require('../utility/db');
let iota = require('../utility/iota');
const CryptHelper = require('../utility/CryptHelper');
const ListManager = require('../utility/ListManager');


module.exports = {
  friendlyName: 'Add organizzazione',

  description: 'Aggiunge una nuova organizzazione al database e pubblica su blockchain.',

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
      let nuovaOrganizzazione = db.Organizzazione.create({
        denominazione: inputs.denominazione,
        publicKey: keyPairOrg.publicKey,
        privateKey: keyPairOrg.privateKey,
        ultimaVersioneSuBlockchain: -1
      });

      // Pubblica tutto su blockchain (sincrono - attende completamento)
      // Le 3 pubblicazioni vanno in parallelo per velocizzare
      const manager = new ListManager();
      const orgId = nuovaOrganizzazione.id;
      const walletId = ListManager.getWalletIdOrganizzazione(orgId);

      sails.log.info(`[add-organizzazione] Pubblicazione blockchain per org #${orgId}...`);

      // Pubblicazioni SEQUENZIALI (IOTA non permette tx parallele dallo stesso wallet)
      const res1 = await manager.updateDatiOrganizzazioneToBlockchain(orgId);
      sails.log.info(`[add-organizzazione] Blockchain: ORG_DATA=${res1.success}`);

      const res2 = await manager.updatePrivateKey(walletId, keyPairOrg.privateKey);
      sails.log.info(`[add-organizzazione] Blockchain: PRIVATE_KEY=${res2.success}`);

      const res3 = await manager.updateOrganizzazioniStruttureListeToBlockchain();
      sails.log.info(`[add-organizzazione] Blockchain: MAIN_DATA=${res3.success}`);

      await sails.helpers.broadcastEvent('dataChanged', {
        action: 'ORGANIZZAZIONE_CREATA',
        entity: 'organizzazione',
        id: orgId,
        label: nuovaOrganizzazione.denominazione,
      });

      return exits.success({
        organizzazione: {...nuovaOrganizzazione, privateKey: undefined},
        blockchain: {
          orgData: res1.success,
          privateKey: res2.success,
          mainData: res3.success,
        },
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
