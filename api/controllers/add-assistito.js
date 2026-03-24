const crypto = require('crypto');
const db = require('../utility/db');
const CryptHelper = require('../utility/CryptHelper');
const moment = require('moment');
const ListManager = require('../utility/ListManager');

function generateAnonId(codiceFiscale) {
  return crypto.createHash('sha256')
    .update(codiceFiscale.toUpperCase().trim())
    .digest('hex')
    .substring(0, 8)
    .toUpperCase();
}

module.exports = {
  friendlyName: 'Add assistito',
  description: 'Crea un assistito e pubblica su blockchain.',
  inputs: {
    nome: { type: 'string', required: true },
    cognome: { type: 'string', required: true },
    codiceFiscale: { type: 'string', required: true, regex: /^[A-Za-z]{6}[0-9]{2}[A-Za-z][0-9]{2}[A-Za-z][0-9]{3}[A-Za-z]$/ },
    dataNascita: { type: 'string', required: false },
    email: { type: 'string', required: false, isEmail: true },
    telefono: { type: 'string', required: false },
    indirizzo: { type: 'string', required: false },
  },
  exits: {
    success: { description: 'Assistito aggiunto con successo.' },
    invalid: { responseType: 'badRequest' }
  },
  fn: async function (inputs, exits) {
    sails.log.info(`[add-assistito] Creazione "${inputs.nome} ${inputs.cognome}" CF:${inputs.codiceFiscale}`);

    if (db.Assistito.findOne({codiceFiscale: inputs.codiceFiscale.toUpperCase().trim()})) {
      return exits.invalid({error: 'Assistito gia presente'});
    }

    let keyPairAss = await CryptHelper.RSAGenerateKeyPair();
    let dataNascita = moment(inputs.dataNascita, 'YYYY-MM-DD');

    // Genera anonId con uniqueness check
    const anonId = generateAnonId(inputs.codiceFiscale);
    let candidate = anonId;
    let salt = 0;
    while (db.Assistito.findOne({ anonId: candidate })) {
      salt++;
      candidate = crypto.createHash('sha256')
        .update(inputs.codiceFiscale.toUpperCase().trim() + ':' + salt)
        .digest('hex')
        .substring(0, 8)
        .toUpperCase();
    }

    let assistito;
    try {
      assistito = db.Assistito.create({
        nome: inputs.nome,
        cognome: inputs.cognome,
        codiceFiscale: inputs.codiceFiscale.toUpperCase().trim(),
        anonId: candidate,
        dataNascita: dataNascita.isValid() ? dataNascita.format('YYYY-MM-DD') : null,
        email: inputs.email,
        telefono: inputs.telefono,
        indirizzo: inputs.indirizzo,
        publicKey: keyPairAss.publicKey,
        privateKey: keyPairAss.privateKey,
        ultimaVersioneSuBlockchain: -1
      });
      sails.log.info(`[add-assistito] Assistito #${assistito.id} anonId:${assistito.anonId} creato`);
    } catch (err) {
      sails.log.error('[add-assistito] DB error:', err.message);
      return exits.invalid({error: 'Errore durante la creazione.'});
    }

    // Pubblica su blockchain (sincrono, parallelo)
    const manager = new ListManager();
    const walletId = await Assistito.getWalletIdAssistito({id: assistito.id});

    sails.log.info(`[add-assistito] Pubblicazione blockchain...`);

    const res1 = await manager.updateDatiAssistitoToBlockchain(assistito.id);
    sails.log.info(`[add-assistito] Blockchain: ASS_DATA=${res1.success}`);
    const res2 = await manager.updatePrivateKey(walletId, keyPairAss.privateKey);
    sails.log.info(`[add-assistito] Blockchain: PK=${res2.success}`);
    // MAIN_DATA non aggiornato per velocita - gli assistiti vengono trovati via discovery

    return exits.success({
      assistito: {...assistito, privateKey: undefined},
      blockchain: { assData: res1.success, privateKey: res2.success },
      error: null
    });
  }
};
