const iota = require('./iota');
const CryptHelper = require('./CryptHelper');
const {STRUTTURE_DATA} = require('../enums/TransactionDataType');

class ListManager {
    constructor(wallet) {
        this.wallet = wallet;
    }

    async updateDatiStruttureToBlockchain(idOrganizzazione) {
      if (idOrganizzazione) {
        let orgAccount = await iota.getOrCreateWalletAccount(this.wallet, await Organizzazione.getWalletIdOrganizzazione({id: idOrganizzazione}));
        let organizzazioneStrutture = await Organizzazione.findOne({id: idOrganizzazione})
          .populate('strutture',
            {
              select: ['id', 'denominazione', 'indirizzo', 'publicKey', 'organizzazione']
            })
          .select(['id', 'denominazione', 'publicKey']);
        if (organizzazioneStrutture) {
          let data = await CryptHelper.encryptAndSend(JSON.stringify(organizzazioneStrutture));
          await iota.makeTransactionWithText(this.wallet, orgAccount, await iota.getFirstAddressOfAnAccount(orgAccount), STRUTTURE_DATA, data.data);
        }
      }
      return null;
    }
    async getLastTransactionDataFromBlockchain(idOrganizzazione) {
      let organizzazione = await Organizzazione.findOne({id: idOrganizzazione});
      if (organizzazione) {
        let orgAccount = await iota.getOrCreateWalletAccount(this.wallet, await Organizzazione.getWalletIdOrganizzazione({id: idOrganizzazione}));
        let transazione = await iota.getLastTransactionOfAccountWithTag(orgAccount, STRUTTURE_DATA);
        if (transazione) {
          let data = JSON.parse(iota.hexToString(transazione.payload.essence.payload.data));
          let clearData = await CryptHelper.receiveAndDecrypt(data,organizzazione.privateKey);
          console.log(clearData);
          return await CryptHelper.decryptData(data);
        }
      }
      return null;
    }
}

module.exports = ListManager;
