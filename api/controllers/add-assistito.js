const CryptHelper = require('../utility/CryptHelper');
const moment = require('moment');
const ListManager = require('../utility/ListManager');

module.exports = {
  friendlyName: 'Add assistito',
  description: '',
  inputs: {
    nome: {
      type: 'string',
      required: true
    },
    cognome: {
      type: 'string',
      required: true
    },
    codiceFiscale: {
      type: 'string',
      required: true
    },
    dataNascita: {
      type: 'string',
      required: false,
      format: 'YYYY-MM-DD',
      description: 'Formato: YYYY-MM-DD'
    },
    email: {
      type: 'string',
      required: false
    },
    telefono: {
      type: 'string',
      required: false
    },
    indirizzo: {
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
    const isSocketRequest = this.req.isSocket;
    let socketId;

    if (isSocketRequest) {
      socketId = this.req.socket.id;

      await sails.helpers.consoleSocket("Inizio aggiunta assistito..", socketId);
    }

    if (await Assistito.findOne({codiceFiscale: inputs.codiceFiscale.toUpperCase().trim()})) {

      await sails.helpers.consoleSocket('Errore: assistito già esistente', socketId);
      await sails.helpers.consoleSocket('ko', socketId, 'processCompleted', {success: false});

      return exits.invalid({error: 'Assistito già presente'});
    } else {
      await sails.helpers.consoleSocket('Generazione coppia di chiavi RSA', socketId);

      let keyPairAss = await CryptHelper.RSAGenerateKeyPair();

      let dataNascita = moment(inputs.dataNascita, 'YYYY-MM-DD');
      if (dataNascita.isValid() || inputs.dataNascita === '') {

        await sails.helpers.consoleSocket('Creazione record assistito', socketId);

        let assistito = null;
        try {
          assistito = await Assistito.create({
            id: await Assistito.nextId(),
            nome: inputs.nome,
            cognome: inputs.cognome,
            codiceFiscale: inputs.codiceFiscale.toUpperCase().trim(),
            dataNascita: dataNascita.isValid() ? dataNascita.format('YYYY-MM-DD') : null,
            email: inputs.email,
            telefono: inputs.telefono,
            indirizzo: inputs.indirizzo,
            publicKey: keyPairAss.publicKey,
            privateKey: keyPairAss.privateKey,
            ultimaVersioneSuBlockchain: -1
          }).fetch();
        } catch (err) {
          await sails.helpers.consoleSocket('Errore nella creazione del record assistito:' + err.message, socketId);
          await sails.helpers.consoleSocket('ko', socketId, 'processCompleted', {success: false});
          return exits.invalid({error: 'Errore durante la creazione dell\'assistito.'});
        }
        await sails.helpers.consoleSocket('Updating blockchain data...', socketId);
        let manager = new ListManager(socketId);
        let res1 = await manager.updateDatiAssistitoToBlockchain(assistito.id);
        if (res1.success) {
          await sails.helpers.consoleSocket('updateDatiAssistitoToBlockchain Transaction OK, blockId: ' + res1.blockId, socketId);
          await sails.helpers.consoleSocket('url: <a href="' + res1.url + '" target="_blank">' + res1.url + '</a>', socketId);

        } else {
          await sails.helpers.consoleSocket('updateDatiAssistitoToBlockchain Transaction KO', socketId);
        }
        let res2 = await manager.updatePrivateKey(await Assistito.getWalletIdAssistito({id: assistito.id}), keyPairAss.privateKey);
        if (res2.success) {
          await sails.helpers.consoleSocket('updatePrivateKey Transaction OK, blockId: ' + res2.blockId, socketId);
          await sails.helpers.consoleSocket('url: <a href="' + res2.url + '" target="_blank">' + res2.url + '</a>', socketId);
        } else {
          await sails.helpers.consoleSocket('Aggiornamento chiave privata non riuscito', socketId);
        }
        if (res1.success && res2.success) {
          assistito.ultimaVersioneSuBlockchain = assistito.ultimaVersioneSuBlockchain + 1;
          await sails.helpers.consoleSocket('Operazione completata con successo', socketId);
          await sails.helpers.consoleSocket('ok', socketId, 'processCompleted', {success: true});

          return exits.success({
            assistito: {...assistito, privateKey: keyPairAss.privateKey},
            transactions: {
              ASSISTITO_DATA: {...res1},
              PRIVATE_KEY: {...res2}
            },
            error: null
          });
        } else {
          await sails.helpers.consoleSocket('Errore nella scrittura nella blockchain', socketId);
          await sails.helpers.consoleSocket('ko', socketId, 'processCompleted', {success: false});
          return exits.invalid({
            error: 'Errore durante la scrittura dei dati sulla blockchain.',
            transactions: {
              ASSISTITO_DATA: {...res1},
              PRIVATE_KEY: {...res2}
            }
          });
        }
      }

      await sails.helpers.consoleSocket('Formato data di nascita non corretto', socketId);
      await sails.helpers.consoleSocket('ko', socketId, 'processCompleted', {success: false});

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
