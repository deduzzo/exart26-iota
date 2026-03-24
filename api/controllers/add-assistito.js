const SyncCache = require('../utility/SyncCache');
const CryptHelper = require('../utility/CryptHelper');
const moment = require('moment');
const ListManager = require('../utility/ListManager');

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

    if (await Assistito.findOne({codiceFiscale: inputs.codiceFiscale.toUpperCase().trim()})) {
      return exits.invalid({error: 'Assistito gia presente'});
    }

    let keyPairAss = await CryptHelper.RSAGenerateKeyPair();
    let dataNascita = moment(inputs.dataNascita, 'YYYY-MM-DD');

    // Genera anonId (il beforeCreate potrebbe non funzionare con inMemoryOnly)
    const anonId = Assistito.generateAnonId(inputs.codiceFiscale);

    let assistito;
    try {
      assistito = await Assistito.create({
        nome: inputs.nome,
        cognome: inputs.cognome,
        codiceFiscale: inputs.codiceFiscale.toUpperCase().trim(),
        anonId: anonId,
        dataNascita: dataNascita.isValid() ? dataNascita.format('YYYY-MM-DD') : null,
        email: inputs.email,
        telefono: inputs.telefono,
        indirizzo: inputs.indirizzo,
        publicKey: keyPairAss.publicKey,
        privateKey: keyPairAss.privateKey,
        ultimaVersioneSuBlockchain: -1
      }).fetch();
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

    SyncCache.scheduleSave();
      return exits.success({
      assistito: {...assistito, privateKey: undefined},
      blockchain: { assData: res1.success, privateKey: res2.success },
      error: null
    });
  }
};
