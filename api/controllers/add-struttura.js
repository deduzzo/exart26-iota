const CryptHelper = require('../utility/CryptHelper');
const ListManager = require('../utility/ListManager');
module.exports = {


  friendlyName: 'Add struttura',


  description: '',

  example: {
    denominazione: 'string',
    indirizzo: 'string',
    attiva: 'boolean',
    organizzazione: 'number'
  },

  inputs: {
    denominazione: {
      type: 'string',
      required: true
    },
    indirizzo: {
      type: 'string',
      required: true
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
        id: await Struttura.nextId(),
        denominazione: inputs.denominazione,
        indirizzo: inputs.indirizzo,
        attiva: inputs.attiva,
        publicKey: keyPairStr.publicKey,
        privateKey: keyPairStr.privateKey,
        ultimaVersioneSuBlockchain: -1,
        organizzazione: inputs.organizzazione
      }).fetch();
      let manager = new ListManager();
      let res1 = await manager.updateDatiStrutturaToBlockchain(nuovaStruttura.id);
      let res2 = await manager.updatePrivateKey(await Struttura.getWalletIdStruttura({id: nuovaStruttura.id}), keyPairStr.privateKey);
      let res3 = await manager.updateOrganizzazioniStruttureListeToBlockchain();
      if (res1.success && res2.success && res3.success) {
        nuovaStruttura.ultimaVersioneSuBlockchain = nuovaStruttura.ultimaVersioneSuBlockchain + 1;
        return exits.success(
          {
            organizzazione: {...nuovaStruttura, privateKey: keyPairStr.privateKey},
            transactions: {
              STRUTTURA_DATA: {...res1},
              PRIVATE_KEY: {...res2},
              MAIN_DATA: {...res3}
            },
          error: null
          });
      } else {
        return exits.invalid({
          error: 'Errore durante la scrittura dei dati sulla blockchain.',
          transactions: {
            STRUTTURA_DATA: {...res1},
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
