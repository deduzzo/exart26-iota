const CryptHelper = require('../utility/CryptHelper');
const moment = require('moment');
const ListManager = require('../utility/ListManager');
module.exports = {


  friendlyName: 'Add assistito',


  description: '',


  inputs: {
    nome : {
      type: 'string',
      required: true
    },
    cognome : {
      type: 'string',
      required: true
    },
    codiceFiscale : {
      type: 'string',
      required: true
    },
    dataNascita : {
      type: 'string',
      required: false,
      format: 'YYYY-MM-DD',
      description: 'Formato: YYYY-MM-DD'
    },
    email : {
      type: 'string',
      required: false
    },
    telefono : {
      type: 'string',
      required: false
    },
    indirizzo : {
      type: 'string',
      required: false
    },
  },


  exits: {
    success: {
      description: 'Assistito aggiunta con successo.',
    },
    invalid: {
      responseType: 'badRequest',
      description: 'I dati forniti non sono validi o l\'assistito è già presente.'
    }
  },


  fn: async function (inputs, exits) {
    if (await Assistito.findOne({codiceFiscale: inputs.codiceFiscale.toUpperCase().trim()})) {
      return exits.invalid({error: 'Assistito già presente'});
    }
    else {
      let keyPairAss = await CryptHelper.RSAGenerateKeyPair();
      let dataNascita = moment(inputs.dataNascita, 'YYYY-MM-DD');
      if (dataNascita.isValid()) {

        let assistito = await Assistito.create({
          nome: inputs.nome,
          cognome: inputs.cognome,
          codiceFiscale: inputs.codiceFiscale.toUpperCase().trim(),
          dataNascita: dataNascita.format('YYYY-MM-DD'),
          email: inputs.email,
          telefono: inputs.telefono,
          indirizzo: inputs.indirizzo,
          publicKey: keyPairAss.publicKey,
          privateKey: keyPairAss.privateKey,
          ultimaVersioneSuBlockchain: -1
        }).fetch();
        let manager = new ListManager();
        let res1 = await manager.updateDatiAssistitoToBlockchain(assistito.id);
        let res2 = await manager.updatePrivateKey(await Assistito.getWalletIdAssistito({id: assistito.id}), keyPairAss.privateKey);
        if (res1.success && res2.success) {
          assistito.ultimaVersioneSuBlockchain = assistito.ultimaVersioneSuBlockchain + 1;
          return exits.success(
            {
              assistito: {...assistito, privateKey: keyPairAss.privateKey},
              transactions: {
                ASSISTITO_DATA: {...res1},
                PRIVATE_KEY: {...res2}
              },
              error: null
            });
        } else {
          return exits.invalid({
            error: 'Errore durante la scrittura dei dati sulla blockchain.',
            transactions: {
              ASSISTITO_DATA: {...res1},
              PRIVATE_KEY: {...res2}
            }
          });
        }
      }
        return exits.invalid({
          error: 'Errore durante l\'inserimento dell\'assistito.',
          transactions: {
            ASSISTITO_DATA: null,
            PRIVATE_KEY: null
          }
        });
    }
  }


};
