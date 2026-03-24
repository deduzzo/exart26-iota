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
      required: true,
      regex: /^[A-Za-z]{6}[0-9]{2}[A-Za-z][0-9]{2}[A-Za-z][0-9]{3}[A-Za-z]$/,
      description: 'Codice Fiscale italiano (16 caratteri)'
    },
    dataNascita: {
      type: 'string',
      required: false,
      format: 'YYYY-MM-DD',
      description: 'Formato: YYYY-MM-DD'
    },
    email: {
      type: 'string',
      required: false,
      isEmail: true,
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
      description: 'Assistito aggiunto con successo.',
    },
    invalid: {
      responseType: 'badRequest',
      description: 'I dati forniti non sono validi o l\'assistito e gia presente.'
    }
  },
  fn: async function (inputs, exits) {
    const isSocketRequest = this.req.isSocket;
    let socketId;

    if (isSocketRequest) {
      socketId = this.req.socket.id;
      await sails.helpers.consoleSocket('Inizio aggiunta assistito...', socketId);
    }

    sails.log.info(`[add-assistito] Creazione "${inputs.nome} ${inputs.cognome}" CF:${inputs.codiceFiscale}`);

    if (await Assistito.findOne({codiceFiscale: inputs.codiceFiscale.toUpperCase().trim()})) {
      sails.log.warn(`[add-assistito] CF duplicato: ${inputs.codiceFiscale}`);
      if (isSocketRequest) {
        await sails.helpers.consoleSocket('Errore: assistito gia esistente', socketId);
        await sails.helpers.consoleSocket('ko', socketId, 'processCompleted', {success: false});
      }
      return exits.invalid({error: 'Assistito gia presente'});
    }

    sails.log.info('[add-assistito] Generazione chiavi RSA...');
    if (isSocketRequest) await sails.helpers.consoleSocket('Generazione coppia di chiavi RSA', socketId);
    let keyPairAss = await CryptHelper.RSAGenerateKeyPair();

    let dataNascita = moment(inputs.dataNascita, 'YYYY-MM-DD');
    if (!dataNascita.isValid() && inputs.dataNascita !== '' && inputs.dataNascita !== undefined) {
      sails.log.warn('[add-assistito] Formato data di nascita non valido:', inputs.dataNascita);
      return exits.invalid({error: 'Formato data di nascita non corretto.'});
    }

    let assistito = null;
    try {
      assistito = await Assistito.create({
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
      sails.log.info(`[add-assistito] Assistito #${assistito.id} creato nel DB`);
    } catch (err) {
      sails.log.error('[add-assistito] DB error:', err.message);
      if (isSocketRequest) {
        await sails.helpers.consoleSocket('Errore nella creazione del record: ' + err.message, socketId);
        await sails.helpers.consoleSocket('ko', socketId, 'processCompleted', {success: false});
      }
      return exits.invalid({error: 'Errore durante la creazione dell\'assistito.'});
    }

    // Blockchain publish in background (non-bloccante)
    const assistitoId = assistito.id;
    setImmediate(async () => {
      try {
        const manager = new ListManager(socketId);
        if (isSocketRequest) await sails.helpers.consoleSocket('Pubblicazione dati sulla blockchain...', socketId);

        sails.log.info(`[add-assistito] Blockchain: pubblicazione ASSISTITO_DATA per #${assistitoId}...`);
        const res1 = await manager.updateDatiAssistitoToBlockchain(assistitoId);
        sails.log.info(`[add-assistito] Blockchain: ASSISTITO_DATA ${res1.success ? 'OK digest:' + res1.digest : 'FAILED'}`);
        if (isSocketRequest && res1.success) {
          await sails.helpers.consoleSocket('ASSISTITO_DATA OK, digest: ' + res1.digest, socketId);
        }

        sails.log.info(`[add-assistito] Blockchain: pubblicazione PRIVATE_KEY per #${assistitoId}...`);
        const walletId = await Assistito.getWalletIdAssistito({id: assistitoId});
        const res2 = await manager.updatePrivateKey(walletId, keyPairAss.privateKey);
        sails.log.info(`[add-assistito] Blockchain: PRIVATE_KEY ${res2.success ? 'OK digest:' + res2.digest : 'FAILED'}`);
        if (isSocketRequest && res2.success) {
          await sails.helpers.consoleSocket('PRIVATE_KEY OK, digest: ' + res2.digest, socketId);
        }

        if (isSocketRequest) {
          await sails.helpers.consoleSocket(res1.success && res2.success ? 'Operazione completata' : 'Completata con errori', socketId);
          await sails.helpers.consoleSocket(res1.success && res2.success ? 'ok' : 'ko', socketId, 'processCompleted', {success: res1.success && res2.success});
        }
      } catch (err) {
        sails.log.warn('[add-assistito] Blockchain publish error:', err.message || err);
        if (isSocketRequest) {
          await sails.helpers.consoleSocket('Errore blockchain: ' + (err.message || err), socketId);
          await sails.helpers.consoleSocket('ko', socketId, 'processCompleted', {success: false});
        }
      }
    });

    return exits.success({
      assistito: {...assistito, privateKey: undefined},
      blockchainStatus: 'publishing',
      error: null
    });
  }
};
