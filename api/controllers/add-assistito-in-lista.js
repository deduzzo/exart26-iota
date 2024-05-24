const ListManager = require('../utility/ListManager');
const {LISTE_IN_CODA, MOVIMENTI_ASSISTITI_LISTA, ASSISTITI_IN_LISTA} = require('../enums/TransactionDataType');
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
    let manager = new ListManager();
    let {res1,res2,res3} = await manager.aggiungiAssistitoInListaToBlockchain(inputs.idAssistito, inputs.idLista);
    if (res1.success && res2.success && res3.success) {
      return exits.success(
        {
          transactions: {
            LISTE_IN_CODA: {...res1},
            MOVIMENTI_ASSISTITI_LISTA: {...res2},
            ASSISTITI_IN_LISTA: {...res3}
          },
          error: null
        }
      );
    } else {
      return exits.invalid({
        error: 'Errore durante la scrittura dei dati sulla blockchain.',
        transactions: {
          LISTE_IN_CODA: {...res1},
          MOVIMENTI_ASSISTITI_LISTA: {...res2},
          ASSISTITI_IN_LISTA: {...res3}
        }
      });
    }
  }
};
