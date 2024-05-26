let iota = require('../utility/iota');
const CryptHelper = require('../utility/CryptHelper');
const ListManager = require('../utility/ListManager');


module.exports = {
  friendlyName: 'Add organizzazione',

  description: 'Aggiunge una nuova organizzazione al database',

  inputs: {
    denominazione: {
      type: 'string',
      required: true
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
        id: await Organizzazione.nextId(),
        denominazione: inputs.denominazione,
        publicKey: keyPairOrg.publicKey,
        privateKey: keyPairOrg.privateKey,
        ultimaVersioneSuBlockchain: -1
      }).fetch();
      let manager = new ListManager();
      let res1 = await manager.updateDatiOrganizzazioneToBlockchain(nuovaOrganizzazione.id);
      let res2 = await manager.updatePrivateKey(await Organizzazione.getWalletIdOrganizzazione({id: nuovaOrganizzazione.id}), keyPairOrg.privateKey);
      let res3 = await manager.updateOrganizzazioniStruttureListeToBlockchain();
      if (res1.success && res2.success && res3.success) {
        nuovaOrganizzazione.ultimaVersioneSuBlockchain = nuovaOrganizzazione.ultimaVersioneSuBlockchain + 1;
        return exits.success(
          {
            organizzazione: {...nuovaOrganizzazione, privateKey: keyPairOrg.privateKey},
            transactions: {
              ORGANIZZAZIONE_DATA: {...res1},
              PRIVATE_KEY: {...res2},
              MAIN_DATA: {...res3},
            },
            error: null
          });
      } else {
        // console to sails all the invalid res
        if (!res1.success)
          sails.log.error(res1);
        if (!res2.success)
          sails.log.error(res2);
        if (!res3.success)
          sails.log.error(res3);
        return exits.invalid({
          error: 'Errore durante la scrittura dei dati sulla blockchain.',
          transactions: {
            ORGANIZZAZIONE_DATA: {...res1},
            PRIVATE_KEY: {...res2},
            MAIN_DATA: {...res3}
          }
        });
      }
    } catch (err) {
      //log error to sails console
      sails.log.error(err);
      return exits.invalid({
        error: err.error,
      });
    }
  }
};
