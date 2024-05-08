const iota = require('./iota');
const CryptHelper = require('./CryptHelper');
const {
  STRUTTURE_LISTE_DATA,
  ORGANIZZAZIONE_DATA,
  MOVIMENTI_ASSISTITI_LISTA,
  LISTE_IN_CODA,
  ASSISTITI_IN_LISTA
} = require('../enums/TransactionDataType');
const {INSERITO_IN_CODA} = require('../enums/StatoLista');

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

  async aggiungiAssistitoInLista(idAssistito, idLista) {
    if (idAssistito && idLista) {
      let lista = await Lista.findOne({id: idLista}).populate('struttura');
      let assistito = await Assistito.findOne({id: idAssistito});
      if (lista && assistito) {
        let res = {success: false};
        let res2 = {success: false};
        let listaAccount = await iota.getOrCreateWalletAccount(this.wallet, await Lista.getWalletIdLista({id: idLista}));
        let assistitoAccount = await iota.getOrCreateWalletAccount(this.wallet, await Assistito.getWalletIdAssistito({id: idAssistito}));
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
            res = await iota.makeTransactionWithText(this.wallet, assistitoAccount, await iota.getFirstAddressOfAnAccount(assistitoAccount), LISTE_IN_CODA, data.data);
            if (!res.success)
              await AssistitiListe.destroy({id: assistitoLista.id});
            else {
              let data2 = await CryptHelper.encryptAndSend(JSON.stringify(assistitoLista), null, lista.struttura.publicKey);
              res2 = await iota.makeTransactionWithText(this.wallet, listaAccount, await iota.getFirstAddressOfAnAccount(listaAccount), MOVIMENTI_ASSISTITI_LISTA, data2.data);
              if (!res2.success)
                await AssistitiListe.destroy({id: assistitoLista.id});
            }
          } catch (e) {
            if (assistitoLista)
              await AssistitiListe.destroy({id: assistitoLista.id});
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
              data.clearData.version = data.clearData.version +1;
              data.clearData.lista.push(assistitoLista);
              listaFromBlockchain = data.clearData;
            }
            else
              listaFromBlockchain = {
                version: 1,
                lista: [assistitoLista]
              };
            let data = await CryptHelper.encryptAndSend(JSON.stringify(listaFromBlockchain), listaFromBlockchain.version, lista.struttura.publicKey);
            res3 = await iota.makeTransactionWithText(this.wallet, listaAccount, await iota.getFirstAddressOfAnAccount(listaAccount), ASSISTITI_IN_LISTA, data.data);
          }
          return res.success && res2.success && res3.success;
        } else return null;
      }
    }

  }

}

module.exports = ListManager;
