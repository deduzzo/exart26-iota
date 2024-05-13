let iota = require('../utility/iota');
const CryptHelper = require('../utility/CryptHelper');
const ListManager = require('../utility/ListManager');

const {
  STRUTTURE_LISTE_DATA,
  ORGANIZZAZIONE_DATA,
  MOVIMENTI_ASSISTITI_LISTA,
  LISTE_IN_CODA,
  ASSISTITI_IN_LISTA,
  MAIN_DATA,
  PRIVATE_KEY
} = require('../enums/TransactionDataType');

module.exports = {
  friendlyName: 'Add organizzazione',

  description: 'Aggiunge una nuova organizzazione al database',

  inputs: {
    // model of organizzazione
    /*    organizzazione: {
          type: 'json',
          required: true,
          custom: function (value) {
            let campiObbligatori = ['denominazione'];
            //return _.isObject(value) && has all required fields
            return _.isObject(value) && _.every(campiObbligatori, (campo) => _.has(value, campo));
          }
        }*/
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
              MAIN_DATA: {...res3}
            },
            error: null
          });
      } else {
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
      return exits.invalid({
        error: err.error,
      });
    }
  }
};
