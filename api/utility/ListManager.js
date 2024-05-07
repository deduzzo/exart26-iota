const iota = require('./iota');
const CryptHelper = require('./CryptHelper');
const {STRUTTURE_LISTE_DATA, ORGANIZZAZIONE_DATA} = require('../enums/TransactionDataType');

class ListManager {
  constructor(wallet) {
    this.wallet = wallet;
  }

  async updateDatiOrganizzazioneToBlockchain(idOrganizzazione) {
    if (idOrganizzazione) {
      let orgAccount = await iota.getOrCreateWalletAccount(this.wallet, await Organizzazione.getWalletIdOrganizzazione({id: idOrganizzazione}));
      let organizzazioneStrutture = await Organizzazione.findOne({id: idOrganizzazione})
        .populate('strutture',
          {
            select: ['id', 'denominazione', 'indirizzo', 'publicKey', 'organizzazione']
          })
        .select(['id', 'denominazione', 'publicKey', 'ultimaVersioneSuBlockchain']);
      if (organizzazioneStrutture) {
        organizzazioneStrutture.ultimaVersioneSuBlockchain = organizzazioneStrutture.ultimaVersioneSuBlockchain + 1;
        let data = await CryptHelper.encryptAndSend(JSON.stringify(organizzazioneStrutture), organizzazioneStrutture.ultimaVersioneSuBlockchain, organizzazioneStrutture.publicKey);
        let res = await iota.makeTransactionWithText(this.wallet, orgAccount, await iota.getFirstAddressOfAnAccount(orgAccount), ORGANIZZAZIONE_DATA, data.data);
        if (res.success) {
          await Organizzazione.updateOne({id: idOrganizzazione}).set({ultimaVersioneSuBlockchain: organizzazioneStrutture.ultimaVersioneSuBlockchain});
        }
        return res.success;
      }
    }
    return false;
  }

  async getLastDatiOrganizzazioneFromBlockchain(idOrganizzazione) {
    let organizzazione = await Organizzazione.findOne({id: idOrganizzazione});
    if (organizzazione) {
      let orgAccount = await iota.getOrCreateWalletAccount(this.wallet, await Organizzazione.getWalletIdOrganizzazione({id: idOrganizzazione}));
      let transazione = await iota.getLastTransactionOfAccountWithTag(orgAccount, ORGANIZZAZIONE_DATA);
      if (transazione) {
        let data = JSON.parse(iota.hexToString(transazione.payload.essence.payload.data));
        let clearData = await CryptHelper.receiveAndDecrypt(data, organizzazione.privateKey);
        data.clearData = JSON.parse(clearData);
        return data;
      }
    }
    return null;
  }

  async updateDatiStrutturaToBlockchain(idStruttura) {
    if (idStruttura) {
      let strutturaAccount = await iota.getOrCreateWalletAccount(this.wallet, await Struttura.getWalletIdStruttura({id: idStruttura}));
      let strutturaCode = await Struttura.findOne({id: idStruttura})
        .populate('liste',
          {
            select: ['id', 'denominazione', 'aperta', 'ultimaVersioneSuBlockchain', 'struttura']
          })
        .select(['id', 'denominazione', 'attiva', 'indirizzo', 'publicKey', 'ultimaVersioneSuBlockchain']);
      if (strutturaCode) {
        strutturaCode.ultimaVersioneSuBlockchain = strutturaCode.ultimaVersioneSuBlockchain + 1;
        let data = await CryptHelper.encryptAndSend(JSON.stringify(strutturaCode), strutturaCode.ultimaVersioneSuBlockchain, strutturaCode.publicKey);
        let res = await iota.makeTransactionWithText(this.wallet, strutturaAccount, await iota.getFirstAddressOfAnAccount(strutturaAccount), STRUTTURE_LISTE_DATA, data.data);
        if (res.success) {
          await Struttura.updateOne({id: idStruttura}).set({ultimaVersioneSuBlockchain: strutturaCode.ultimaVersioneSuBlockchain});
        }
        return res.success;
      }
    }
  }

  async getLastDatiStrutturaFromBlockchain(idStruttura) {
    let struttura = await Struttura.findOne({id: idStruttura});
    if (struttura) {
      let strAccount = await iota.getOrCreateWalletAccount(this.wallet, await Struttura.getWalletIdStruttura({id: idStruttura}));
      let transazione = await iota.getLastTransactionOfAccountWithTag(strAccount, STRUTTURE_LISTE_DATA);
      if (transazione) {
        let data = JSON.parse(iota.hexToString(transazione.payload.essence.payload.data));
        let clearData = await CryptHelper.receiveAndDecrypt(data, struttura.privateKey);
        data.clearData = JSON.parse(clearData);
        return data;
      }
    }
    return null;
  }
}

module.exports = ListManager;
