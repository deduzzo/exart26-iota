const db = require('../utility/db');
const CryptHelper = require('../utility/CryptHelper');
const ListManager = require('../utility/ListManager');
module.exports = {

  friendlyName: 'Add struttura',
  description: 'Aggiunge una nuova struttura e pubblica su blockchain.',

  inputs: {
    denominazione: { type: 'string', required: true, minLength: 2, maxLength: 255 },
    indirizzo: { type: 'string', required: true, minLength: 2 },
    organizzazione: { type: 'number', required: true },
    attiva: { type: 'boolean', required: false, defaultsTo: true },
  },

  exits: {
    success: { description: 'Struttura aggiunta con successo.' },
    invalid: { responseType: 'badRequest', description: 'I dati forniti non sono validi.' }
  },

  fn: async function (inputs, exits) {
    let keyPairStr = await CryptHelper.RSAGenerateKeyPair();
    try {
      let organizzazione = db.Organizzazione.findOne({id: inputs.organizzazione});
      if (!organizzazione) return exits.invalid('Organizzazione non trovata.');

      let nuovaStruttura = db.Struttura.create({
        denominazione: inputs.denominazione,
        indirizzo: inputs.indirizzo,
        attiva: inputs.attiva,
        publicKey: keyPairStr.publicKey,
        privateKey: keyPairStr.privateKey,
        ultimaVersioneSuBlockchain: -1,
        organizzazione: inputs.organizzazione
      });

      const manager = new ListManager();
      const strId = nuovaStruttura.id;
      const walletId = await Struttura.getWalletIdStruttura({id: strId});

      sails.log.info(`[add-struttura] Pubblicazione blockchain per struttura #${strId}...`);

      const res1 = await manager.updateDatiStrutturaToBlockchain(strId);
      sails.log.info(`[add-struttura] Blockchain: STR_DATA=${res1.success}`);
      const res2 = await manager.updatePrivateKey(walletId, keyPairStr.privateKey);
      sails.log.info(`[add-struttura] Blockchain: PK=${res2.success}`);
      const res3 = await manager.updateOrganizzazioniStruttureListeToBlockchain();
      sails.log.info(`[add-struttura] Blockchain: MAIN=${res3.success}`);

      return exits.success({
        struttura: {...nuovaStruttura, privateKey: undefined},
        blockchain: { strData: res1.success, privateKey: res2.success, mainData: res3.success },
        error: null
      });
    } catch (err) {
      return exits.invalid({ error: err.message || JSON.stringify(err) });
    }
  }
};
