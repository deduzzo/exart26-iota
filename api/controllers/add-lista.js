const SyncCache = require('../utility/SyncCache');
const ListManager = require('../utility/ListManager');
const CryptHelper = require('../utility/CryptHelper');
module.exports = {

  friendlyName: 'Add lista',
  description: 'Aggiunge una nuova lista al database e pubblica su blockchain.',

  inputs: {
    denominazione: { type: 'string', required: true, minLength: 2, maxLength: 255 },
    struttura: { type: 'number', required: true },
    tag: { type: 'string', required: false, allowNull: true },
  },

  exits: {
    success: { description: 'Lista aggiunta con successo.' },
    invalid: { responseType: 'badRequest', description: 'I dati forniti non sono validi.' }
  },

  fn: async function (inputs, exits) {
    sails.log.info(`[add-lista] Creazione lista "${inputs.denominazione}" per struttura #${inputs.struttura}`);
    let keyPairList = await CryptHelper.RSAGenerateKeyPair();
    try {
      let nuovaLista = await Lista.create({
        denominazione: inputs.denominazione,
        tag: inputs.tag || null,
        publicKey: keyPairList.publicKey,
        privateKey: keyPairList.privateKey,
        struttura: inputs.struttura,
        ultimaVersioneSuBlockchain: 0
      }).fetch();

      const manager = new ListManager();
      const listaId = nuovaLista.id;
      const strutturaId = nuovaLista.struttura;
      const walletId = await Lista.getWalletIdLista({id: listaId});

      sails.log.info(`[add-lista] Pubblicazione blockchain per lista #${listaId}...`);

      const res1 = await manager.updatePrivateKey(walletId, keyPairList.privateKey);
      sails.log.info(`[add-lista] Blockchain: PK=${res1.success}`);
      const res2 = await manager.updateDatiStrutturaToBlockchain(strutturaId);
      sails.log.info(`[add-lista] Blockchain: STR=${res2.success}`);
      const res3 = await manager.updateOrganizzazioniStruttureListeToBlockchain();
      sails.log.info(`[add-lista] Blockchain: MAIN=${res3.success}`);

      SyncCache.markDirty('Lista');
      return exits.success({
        lista: {...nuovaLista, privateKey: undefined},
        blockchain: { privateKey: res1.success, strData: res2.success, mainData: res3.success },
        error: null
      });
    } catch (err) {
      sails.log.error('[add-lista] error:', err.message || err);
      return exits.invalid({ error: 'Errore durante la creazione della lista.' });
    }
  }
};
