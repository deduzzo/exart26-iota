const ListManager = require('../utility/ListManager');
const CryptHelper = require('../utility/CryptHelper');
module.exports = {


  friendlyName: 'Add lista',


  description: 'Aggiunge una nuova lista al database',


  inputs: {
    denominazione: {
      type: 'string',
      required: true
    },
    struttura: {
      type: 'number',
      required: true
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
    let keyPairList = await CryptHelper.RSAGenerateKeyPair();
    try {
      let nuovaLista = await Lista.create({
        denominazione: inputs.denominazione,
        publicKey: keyPairList.publicKey,
        privateKey: keyPairList.privateKey,
        struttura: inputs.struttura,
        ultimaVersioneSuBlockchain: 0
      }).fetch();
      let manager = new ListManager();
      let res1 = await manager.updatePrivateKey(await Lista.getWalletIdLista({id: nuovaLista.id}), keyPairList.privateKey);
      let res2 = await manager.updateDatiStrutturaToBlockchain(nuovaLista.struttura);
      let res3 = await manager.updateOrganizzazioniStruttureListeToBlockchain();
      if (res1.success && res2.success && res3.success) {
        return exits.success(
          {
            lista: {...nuovaLista, privateKey: keyPairList.privateKey},
            transactions: {
              LISTA_DATA: {...res1},
              PRIVATE_KEY: {...res2},
              MAIN_DATA: {...res3},
            },
            error: null
          });
      } else {
        return exits.invalid({
          error: 'Errore durante la scrittura dei dati sulla blockchain.',
          transactions: {
            LISTA_DATA: {...res1},
            PRIVATE_KEY: {...res2},
            MAIN_DATA: {...res3},
          }
        });
      }
    } catch (err) {
      return exits.invalid({
        error: 'Errore durante la scrittura dei dati sul database.',
        transactions: {
          LISTA_DATA: null,
          PRIVATE_KEY: null,
          MAIN_DATA: null
        }
      });
    }
  }


};
