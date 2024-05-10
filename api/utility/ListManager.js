const iota = require('./iota');
const CryptHelper = require('./CryptHelper');
const {
  STRUTTURE_LISTE_DATA,
  ORGANIZZAZIONE_DATA,
  MOVIMENTI_ASSISTITI_LISTA,
  LISTE_IN_CODA,
  ASSISTITI_IN_LISTA,
  MAIN_DATA,
  PRIVATE_KEY
} = require('../enums/TransactionDataType');
const {INSERITO_IN_CODA} = require('../enums/StatoLista');

class ListManager {

  async updateDBfromBlockchain() {
    let mainAccount = await iota.getMainAccount();
    let transazione = await iota.getLastTransactionOfAccountWithTag(mainAccount, MAIN_DATA);
    if (transazione) {

    }
  }

  async updatePrivateKey(walletId, privateKey) {
    let account = await iota.getOrCreateWalletAccount(walletId);
    let lastPrivateKey = await this.getLastPrivateKeyOfWalletId(walletId);
    let lastVersion = lastPrivateKey ? (lastPrivateKey.messageVersion + 1) : 0;
    let data = await CryptHelper.encryptAndSend(JSON.stringify({privateKey: privateKey}), lastVersion, iota.GET_MAIN_KEYS().publicKey);
    return await iota.makeTransactionWithText(account, await iota.getFirstAddressOfAnAccount(account), PRIVATE_KEY, data.data);
  }

  async getLastPrivateKeyOfWalletId(walletId) {
    let account = await iota.getOrCreateWalletAccount(walletId);
    let transazione = await iota.getLastTransactionOfAccountWithTag(account, PRIVATE_KEY);
    if (transazione) {
      let data = JSON.parse(iota.hexToString(transazione.payload.essence.payload.data));
      let clearData = await CryptHelper.receiveAndDecrypt(data, iota.GET_MAIN_KEYS().privateKey);
      data.clearData = JSON.parse(clearData);
      return data;
    }
    return null;
  }

  async updateDatiOrganizzazioneToBlockchain(idOrganizzazione) {
    if (idOrganizzazione) {
      let orgAccount = await iota.getOrCreateWalletAccount(await Organizzazione.getWalletIdOrganizzazione({id: idOrganizzazione}));
      let organizzazioneStrutture = await Organizzazione.findOne({id: idOrganizzazione})
        .select(['id', 'denominazione', 'publicKey', 'ultimaVersioneSuBlockchain']);
      if (organizzazioneStrutture) {
        organizzazioneStrutture.ultimaVersioneSuBlockchain = organizzazioneStrutture.ultimaVersioneSuBlockchain + 1;
        let data = await CryptHelper.encryptAndSend(JSON.stringify(organizzazioneStrutture), organizzazioneStrutture.ultimaVersioneSuBlockchain, organizzazioneStrutture.publicKey);
        let res = await iota.makeTransactionWithText(orgAccount, await iota.getFirstAddressOfAnAccount(orgAccount), ORGANIZZAZIONE_DATA, data.data);
        if (res.success) {
          await Organizzazione.updateOne({id: idOrganizzazione}).set({ultimaVersioneSuBlockchain: organizzazioneStrutture.ultimaVersioneSuBlockchain});
        }
        return res;
      }
    }
    return {success: false};
  }

  async getLastDatiOrganizzazioneFromBlockchain(idOrganizzazione) {
    let organizzazione = await Organizzazione.findOne({id: idOrganizzazione});
    if (organizzazione) {
      let orgAccount = await iota.getOrCreateWalletAccount(await Organizzazione.getWalletIdOrganizzazione({id: idOrganizzazione}));
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
      let strutturaAccount = await iota.getOrCreateWalletAccount(await Struttura.getWalletIdStruttura({id: idStruttura}));
      let strutturaCode = await Struttura.findOne({id: idStruttura})
        .populate('liste',
          {
            select: ['id', 'denominazione', 'aperta', 'ultimaVersioneSuBlockchain', 'struttura']
          })
        .select(['id', 'denominazione', 'attiva', 'indirizzo', 'publicKey', 'ultimaVersioneSuBlockchain']);
      if (strutturaCode) {
        strutturaCode.ultimaVersioneSuBlockchain = strutturaCode.ultimaVersioneSuBlockchain + 1;
        let data = await CryptHelper.encryptAndSend(JSON.stringify(strutturaCode), strutturaCode.ultimaVersioneSuBlockchain, strutturaCode.publicKey);
        let res = await iota.makeTransactionWithText(strutturaAccount, await iota.getFirstAddressOfAnAccount(strutturaAccount), STRUTTURE_LISTE_DATA, data.data);
        if (res.success) {
          await Struttura.updateOne({id: idStruttura}).set({ultimaVersioneSuBlockchain: strutturaCode.ultimaVersioneSuBlockchain});
        }
        return res.success;
      }
    }
  }

  async getLastDatiStrutturaFromBlockchain(idStruttura) {
    let walletId = await Struttura.getWalletIdStruttura({id: idStruttura});
    let strAccount = await iota.getWalletAccount(walletId);
    if (strAccount) {
      let strutturaPrivateKey = await this.getLastPrivateKeyOfWalletId(walletId);
      let transazione = await iota.getLastTransactionOfAccountWithTag(strAccount, STRUTTURE_LISTE_DATA);
      if (transazione) {
        let data = JSON.parse(iota.hexToString(transazione.payload.essence.payload.data));
        let clearData = await CryptHelper.receiveAndDecrypt(data, strutturaPrivateKey.clearData.privateKey);
        data.clearData = JSON.parse(clearData);
        return data;
      }
    }
    return null;
  }

  async getOrganizzazioniFromBlockchain() {
    let mainAccount = await iota.getMainAccount();
    let transazione = await iota.getLastTransactionOfAccountWithTag(mainAccount, MAIN_DATA);
    if (transazione) {
      let data = JSON.parse(iota.hexToString(transazione.payload.essence.payload.data));
      let clearData = await CryptHelper.receiveAndDecrypt(data.data, iota.GET_MAIN_KEYS().privateKey);
      data.clearData = JSON.parse(clearData);
      return data;
    }
    return null;
  }

  async updateOrganizzazioniToBlockchain() {
    let lastData = await this.getOrganizzazioniFromBlockchain();
    let mainAccount = await iota.getMainAccount();
    let organizzazioni = await Organizzazione.find().populate('strutture');
    let dataToStore = [];
    for (let organizzazione of organizzazioni) {
      for (let struttura of organizzazione.strutture) {
        delete struttura.privateKey;
        let liste = await Lista.find({struttura: struttura.id});
        struttura.liste = liste;
      }
      delete organizzazioni.privateKey;
      dataToStore.push(organizzazione);
    }
    let data2 = await CryptHelper.encryptAndSend(JSON.stringify(dataToStore), (lastData ? (lastData.messageVersion + 1) : 0), iota.GET_MAIN_KEYS().publicKey);
    let res = await iota.makeTransactionWithText(mainAccount, await iota.getFirstAddressOfAnAccount(mainAccount), MAIN_DATA, data2);
    return res;
  }


  async aggiungiAssistitoInListaToBlockchain(idAssistito, idLista) {
    if (idAssistito && idLista) {
      let lista = await Lista.findOne({id: idLista}).populate('struttura');
      let assistito = await Assistito.findOne({id: idAssistito});
      if (lista && assistito) {
        let res = {success: false};
        let res2 = {success: false};
        let listaAccount = await iota.getOrCreateWalletAccount(await Lista.getWalletIdLista({id: idLista}));
        let assistitoAccount = await iota.getOrCreateWalletAccount(await Assistito.getWalletIdAssistito({id: idAssistito}));
        let listeInCoda = await AssistitiListe.find({assistito: idAssistito, stato: INSERITO_IN_CODA, chiuso: false});
        if ((listeInCoda.length > 0 && (listeInCoda.find((l) => l.lista === idLista)) === undefined) || listeInCoda.length === 0) {
          let assistitoLista = null;
          try {
            assistitoLista = await AssistitiListe.create({
              assistito: idAssistito,
              lista: idLista,
              stato: INSERITO_IN_CODA,
            }).fetch();
            let data = await CryptHelper.encryptAndSend(JSON.stringify([assistitoLista, ...listeInCoda]), null, assistito.publicKey);
            res = await iota.makeTransactionWithText(assistitoAccount, await iota.getFirstAddressOfAnAccount(assistitoAccount), LISTE_IN_CODA, data.data);
            if (!res.success) {
              await AssistitiListe.destroy({id: assistitoLista.id});
            } else {
              let data2 = await CryptHelper.encryptAndSend(JSON.stringify(assistitoLista), null, lista.struttura.publicKey);
              res2 = await iota.makeTransactionWithText(listaAccount, await iota.getFirstAddressOfAnAccount(listaAccount), MOVIMENTI_ASSISTITI_LISTA, data2.data);
              if (!res2.success) {
                await AssistitiListe.destroy({id: assistitoLista.id});
              }
            }
          } catch (e) {
            if (assistitoLista) {
              await AssistitiListe.destroy({id: assistitoLista.id});
            }
          }
          let res3 = {success: false};
          let listaFromBlockchain = null;
          if (res.success && res2.success) {
            let listaTransaction = await iota.getLastTransactionOfAccountWithTag(listaAccount, ASSISTITI_IN_LISTA);
            if (listaTransaction) {
              let data = JSON.parse(iota.hexToString(listaTransaction.payload.essence.payload.data));
              let clearData = await CryptHelper.receiveAndDecrypt(data, lista.struttura.privateKey);
              data.clearData = JSON.parse(clearData);
              // version and lista
              data.clearData.version = data.clearData.version + 1;
              data.clearData.lista.push(assistitoLista);
              listaFromBlockchain = data.clearData;
            } else {
              listaFromBlockchain = {
                version: 1,
                lista: [assistitoLista]
              };
            }
            let data = await CryptHelper.encryptAndSend(JSON.stringify(listaFromBlockchain), listaFromBlockchain.version, lista.struttura.publicKey);
            res3 = await iota.makeTransactionWithText(listaAccount, await iota.getFirstAddressOfAnAccount(listaAccount), ASSISTITI_IN_LISTA, data.data);
          }
          return res.success && res2.success && res3.success;
        } else {
          return null;
        }
      }
    }

  }

}

module.exports = ListManager;
