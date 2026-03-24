const iota = require('./iota');
const CryptHelper = require('./CryptHelper');
const ArweaveHelper = require('./ArweaveHelper');
const {
  STRUTTURE_LISTE_DATA,
  ORGANIZZAZIONE_DATA,
  ASSISTITI_DATA,
  MOVIMENTI_ASSISTITI_LISTA,
  LISTE_IN_CODA,
  ASSISTITI_IN_LISTA,
  MAIN_DATA,
  PRIVATE_KEY
} = require('../enums/TransactionDataType');
const {INSERITO_IN_CODA} = require('../enums/StatoLista');

class ListManager {

  constructor(socketId = null) {
    this._socketId = socketId;
    if (socketId)
      iota.setSocketId(socketId);
  }

  /**
   * Backup non-bloccante su Arweave. Se fallisce, logga warning ma non blocca.
   */
  _backupToArweave(dataType, encryptedData, entityId = null, version = null) {
    if (!ArweaveHelper.isEnabled()) return;
    ArweaveHelper.uploadData(dataType, encryptedData, entityId, version)
      .then(res => {
        if (res.success) {
          sails.log.info(`Arweave backup OK [${dataType}${entityId ? '#' + entityId : ''}] txId: ${res.txId}`);
        } else {
          sails.log.warn(`Arweave backup FAILED [${dataType}]: ${res.error}`);
        }
      })
      .catch(err => sails.log.warn('Arweave backup error:', err.message));
  }

  /**
   * Tenta di recuperare dati da Arweave come fallback quando IOTA non ha il dato.
   */
  async _fallbackFromArweave(dataType, entityId = null, privateKey = null) {
    if (!ArweaveHelper.isEnabled()) return null;
    try {
      let result = await ArweaveHelper.downloadByTag(dataType, entityId);
      if (result && result.data) {
        sails.log.info(`Arweave fallback OK [${dataType}${entityId ? '#' + entityId : ''}]`);
        if (privateKey) {
          let clearData = await CryptHelper.receiveAndDecrypt(result.data, privateKey);
          result.data.clearData = JSON.parse(clearData);
        }
        return result.data;
      }
    } catch (e) {
      sails.log.warn('Arweave fallback error:', e.message);
    }
    return null;
  }

  async updateDBfromBlockchain() {
    let record = await iota.getLastDataByTag(MAIN_DATA);
    if (record && record.payload) {
      let data = record.payload;
      let clearData = await CryptHelper.receiveAndDecrypt(data, iota.GET_MAIN_KEYS().privateKey);
      data.clearData = JSON.parse(clearData);
      await this.syncDBFromJsonData(data.clearData);
      return {success: true, data: data.clearData, source: 'iota'};
    }
    // Fallback: cerca su Arweave
    let arweaveData = await this._fallbackFromArweave(MAIN_DATA, null, iota.GET_MAIN_KEYS().privateKey);
    if (arweaveData && arweaveData.clearData) {
      await this.syncDBFromJsonData(arweaveData.clearData);
      return {success: true, data: arweaveData.clearData, source: 'arweave'};
    }
    return {success: false, data: []};
  }

  async updateListeAssistitiFromBlockchain(idLista) {
    let liste = null;
    if (idLista) {
      liste = await Lista.find({id: idLista});
    } else {
      liste = await Lista.find();
    }
    if (liste && liste.length > 0) {
      for (let lista of liste) {
        let listaEntityId = await Lista.getWalletIdLista({id: lista.id});
        let record = await iota.getLastDataByTag(ASSISTITI_IN_LISTA, listaEntityId);
        let privateKeyData = await this.getLastPrivateKeyOfEntityId(await Struttura.getWalletIdStruttura({id: lista.struttura}));
        if (record && record.payload) {
          let data = record.payload;
          let clearData = await CryptHelper.receiveAndDecrypt(data, privateKeyData.clearData.privateKey);
          data.clearData = JSON.parse(clearData);
          await this.updateDBFromJsonListeAssistiti(data.clearData);
        }
      }
    }
  }

  async updateDBFromJsonData(data) {
    await this.syncDBFromJsonData(data);
  }

  async syncDBFromJsonData(data) {
    for (let organizzazione of data) {
      let org = await Organizzazione.findOne({id: organizzazione.id});
      if (org) {
        await Organizzazione.updateOne({id: organizzazione.id}).set({
          denominazione: organizzazione.denominazione,
          publicKey: organizzazione.publicKey,
          ultimaVersioneSuBlockchain: organizzazione.ultimaVersioneSuBlockchain
        });
      } else {
        await Organizzazione.create({
          id: organizzazione.id,
          denominazione: organizzazione.denominazione,
          publicKey: organizzazione.publicKey,
          ultimaVersioneSuBlockchain: organizzazione.ultimaVersioneSuBlockchain
        });
      }

      for (let strutture of organizzazione.strutture) {
        let str = await Struttura.findOne({id: strutture.id});
        if (str) {
          await Struttura.updateOne({id: strutture.id}).set({
            denominazione: strutture.denominazione,
            attiva: strutture.attiva,
            indirizzo: strutture.indirizzo,
            publicKey: strutture.publicKey,
            ultimaVersioneSuBlockchain: strutture.ultimaVersioneSuBlockchain,
            organizzazione: organizzazione.id
          });
        } else {
          await Struttura.create({
            id: strutture.id,
            denominazione: strutture.denominazione,
            attiva: strutture.attiva,
            indirizzo: strutture.indirizzo,
            publicKey: strutture.publicKey,
            ultimaVersioneSuBlockchain: strutture.ultimaVersioneSuBlockchain,
            organizzazione: organizzazione.id
          });
        }

        for (let lista of strutture.liste) {
          let lst = await Lista.findOne({id: lista.id});
          if (lst) {
            await Lista.updateOne({id: lista.id}).set({
              denominazione: lista.denominazione,
              aperta: lista.aperta,
              publicKey: lista.publicKey,
              ultimaVersioneSuBlockchain: lista.ultimaVersioneSuBlockchain,
              struttura: strutture.id
            });
          } else {
            await Lista.create({
              id: lista.id,
              denominazione: lista.denominazione,
              aperta: lista.aperta,
              struttura: strutture.id,
              publicKey: lista.publicKey,
              ultimaVersioneSuBlockchain: lista.ultimaVersioneSuBlockchain
            });
          }
        }
      }
    }
  }

  async updatePrivateKey(entityId, privateKey) {
    let lastPrivateKey = await this.getLastPrivateKeyOfEntityId(entityId);
    let lastVersion = lastPrivateKey ? (lastPrivateKey.version + 1) : 0;
    let data = await CryptHelper.encryptAndSend(JSON.stringify({privateKey: privateKey}), lastVersion, iota.GET_MAIN_KEYS().publicKey);
    let res = await iota.publishData(PRIVATE_KEY, data.data, entityId, lastVersion);
    if (res.success) {
      this._backupToArweave(PRIVATE_KEY, data.data, entityId, lastVersion);
    }
    return res;
  }

  async getLastPrivateKeyOfEntityId(entityId) {
    let record = await iota.getLastDataByTag(PRIVATE_KEY, entityId);
    if (record && record.payload) {
      let data = record.payload;
      let clearData = await CryptHelper.receiveAndDecrypt(data, iota.GET_MAIN_KEYS().privateKey);
      data.clearData = JSON.parse(clearData);
      return data;
    }
    // Fallback Arweave
    return await this._fallbackFromArweave(PRIVATE_KEY, entityId, iota.GET_MAIN_KEYS().privateKey);
  }

  async updateDatiOrganizzazioneToBlockchain(idOrganizzazione) {
    if (idOrganizzazione) {
      let entityId = await Organizzazione.getWalletIdOrganizzazione({id: idOrganizzazione});
      let organizzazioneStrutture = await Organizzazione.findOne({id: idOrganizzazione})
        .select(['id', 'denominazione', 'publicKey', 'ultimaVersioneSuBlockchain']);
      if (organizzazioneStrutture) {
        organizzazioneStrutture.ultimaVersioneSuBlockchain = organizzazioneStrutture.ultimaVersioneSuBlockchain + 1;
        let data = await CryptHelper.encryptAndSend(JSON.stringify(organizzazioneStrutture), organizzazioneStrutture.ultimaVersioneSuBlockchain, organizzazioneStrutture.publicKey);
        let res = await iota.publishData(ORGANIZZAZIONE_DATA, data.data, entityId, organizzazioneStrutture.ultimaVersioneSuBlockchain);
        if (res.success) {
          await Organizzazione.updateOne({id: idOrganizzazione}).set({ultimaVersioneSuBlockchain: organizzazioneStrutture.ultimaVersioneSuBlockchain});
          this._backupToArweave(ORGANIZZAZIONE_DATA, data.data, idOrganizzazione, organizzazioneStrutture.ultimaVersioneSuBlockchain);
        }
        return res;
      }
    }
    return {success: false};
  }

  async getLastDatiOrganizzazioneFromBlockchain(idOrganizzazione) {
    let organizzazione = await Organizzazione.findOne({id: idOrganizzazione});
    if (organizzazione) {
      let entityId = await Organizzazione.getWalletIdOrganizzazione({id: idOrganizzazione});
      let record = await iota.getLastDataByTag(ORGANIZZAZIONE_DATA, entityId);
      if (record && record.payload) {
        let data = record.payload;
        let clearData = await CryptHelper.receiveAndDecrypt(data, organizzazione.privateKey);
        data.clearData = JSON.parse(clearData);
        return data;
      }
    }
    return null;
  }

  async updateDatiStrutturaToBlockchain(idStruttura) {
    if (idStruttura) {
      let entityId = await Struttura.getWalletIdStruttura({id: idStruttura});
      let strutturaCode = await Struttura.findOne({id: idStruttura})
        .populate('liste',
          {
            select: ['id', 'denominazione', 'aperta', 'ultimaVersioneSuBlockchain', 'struttura']
          })
        .select(['id', 'denominazione', 'attiva', 'indirizzo', 'publicKey', 'ultimaVersioneSuBlockchain']);
      if (strutturaCode) {
        strutturaCode.ultimaVersioneSuBlockchain = strutturaCode.ultimaVersioneSuBlockchain + 1;
        let data = await CryptHelper.encryptAndSend(JSON.stringify(strutturaCode), strutturaCode.ultimaVersioneSuBlockchain, strutturaCode.publicKey);
        let res = await iota.publishData(STRUTTURE_LISTE_DATA, data.data, entityId, strutturaCode.ultimaVersioneSuBlockchain);
        if (res.success) {
          await Struttura.updateOne({id: idStruttura}).set({ultimaVersioneSuBlockchain: strutturaCode.ultimaVersioneSuBlockchain});
          this._backupToArweave(STRUTTURE_LISTE_DATA, data.data, idStruttura, strutturaCode.ultimaVersioneSuBlockchain);
        }
        return res;
      }
    }
    return {success: false};
  }

  async getLastDatiAssistitoFromBlockchain(idAssistito) {
    let entityId = 'ASS#' + idAssistito;
    let assistitoPrivateKey = await this.getLastPrivateKeyOfEntityId(entityId);
    let record = await iota.getLastDataByTag(ASSISTITI_DATA, entityId);
    if (record && record.payload) {
      let data = record.payload;
      let clearData = await CryptHelper.receiveAndDecrypt(data, assistitoPrivateKey.clearData.privateKey);
      data.clearData = JSON.parse(clearData);
      return data;
    }
    return null;
  }

  async getLastDatiStrutturaFromBlockchain(idStruttura) {
    let entityId = await Struttura.getWalletIdStruttura({id: idStruttura});
    let strutturaPrivateKey = await this.getLastPrivateKeyOfEntityId(entityId);
    let record = await iota.getLastDataByTag(STRUTTURE_LISTE_DATA, entityId);
    if (record && record.payload) {
      let data = record.payload;
      let clearData = await CryptHelper.receiveAndDecrypt(data, strutturaPrivateKey.clearData.privateKey);
      data.clearData = JSON.parse(clearData);
      return data;
    }
    return null;
  }

  async getOrganizzazioniFromBlockchain() {
    let record = await iota.getLastDataByTag(MAIN_DATA);
    if (record && record.payload) {
      let data = record.payload;
      let clearData = await CryptHelper.receiveAndDecrypt(data, iota.GET_MAIN_KEYS().privateKey);
      data.clearData = JSON.parse(clearData);
      return data;
    }
    return null;
  }

  async updateOrganizzazioniStruttureListeToBlockchain() {
    let lastData = await this.getOrganizzazioniFromBlockchain();
    let organizzazioni = await Organizzazione.find().populate('strutture');
    let dataToStore = [];
    for (let organizzazione of organizzazioni) {
      for (let struttura of organizzazione.strutture) {
        delete struttura.privateKey;
        let liste = await Lista.find({struttura: struttura.id});
        struttura.liste = liste;
      }
      delete organizzazione.privateKey;
      dataToStore.push(organizzazione);
    }
    let newVersion = lastData ? (lastData.version + 1) : 0;
    let data2 = await CryptHelper.encryptAndSend(JSON.stringify(dataToStore), newVersion, iota.GET_MAIN_KEYS().publicKey);
    let res = await iota.publishData(MAIN_DATA, data2.data, null, newVersion);
    if (res.success) {
      this._backupToArweave(MAIN_DATA, data2.data, null, newVersion);
    }
    return res;
  }

  async updateDatiAssistitoToBlockchain(id) {
    if (id) {
      let entityId = 'ASS#' + id;
      let assistito = await Assistito.findOne({id: id})
        .select(['id', 'nome', 'cognome', 'codiceFiscale', 'dataNascita', 'email', 'telefono', 'indirizzo', 'publicKey', 'ultimaVersioneSuBlockchain']);
      if (assistito) {
        assistito.ultimaVersioneSuBlockchain = assistito.ultimaVersioneSuBlockchain + 1;
        let data = await CryptHelper.encryptAndSend(JSON.stringify(assistito), assistito.ultimaVersioneSuBlockchain, assistito.publicKey);
        let res = await iota.publishData(ASSISTITI_DATA, data.data, entityId, assistito.ultimaVersioneSuBlockchain);
        if (res.success) {
          await Assistito.updateOne({id: id}).set({ultimaVersioneSuBlockchain: assistito.ultimaVersioneSuBlockchain});
          this._backupToArweave(ASSISTITI_DATA, data.data, id, assistito.ultimaVersioneSuBlockchain);
        }
        return res;
      }
    }
    return {success: false};
  }


  async getAllIdAssistitiFromBlockchain() {
    // Con IOTA 2.0 non ci sono piu account separati per assistito.
    // Recuperiamo gli ID dalla cache locale BlockchainData.
    let records = await iota.getAllDataByTag(ASSISTITI_DATA);
    let allAssistitiId = [];
    for (let record of records) {
      if (record.payload && record.payload.entityId) {
        let id = record.payload.entityId.replace('ASS#', '');
        if (!allAssistitiId.includes(id)) {
          allAssistitiId.push(id);
        }
      }
    }
    return allAssistitiId;
  }

  async aggiungiAssistitoInListaToBlockchain(idAssistito, idLista) {
    if (idAssistito && idLista) {
      let lista = await Lista.findOne({id: idLista}).populate('struttura');
      let assistito = await Assistito.findOne({id: idAssistito});
      if (lista && assistito) {
        let res1 = {success: false};
        let res2 = {success: false};
        let assistitoEntityId = 'ASS#' + idAssistito;
        let listaEntityId = await Lista.getWalletIdLista({id: idLista});
        let listeInCoda = await AssistitiListe.find({assistito: idAssistito, stato: INSERITO_IN_CODA, chiuso: false});
        if ((listeInCoda.length > 0 && (listeInCoda.find((l) => l.lista === idLista)) === undefined) || listeInCoda.length === 0) {
          let assistitoLista = null;
          try {
            assistitoLista = await AssistitiListe.create({
              assistito: idAssistito,
              lista: idLista,
              stato: INSERITO_IN_CODA,
              dataOraIngresso: Date.now(),
            }).fetch();
            let data = await CryptHelper.encryptAndSend(JSON.stringify([assistitoLista, ...listeInCoda]), null, assistito.publicKey);
            res1 = await iota.publishData(LISTE_IN_CODA, data.data, assistitoEntityId);
            if (res1.success) {
              this._backupToArweave(LISTE_IN_CODA, data.data, idAssistito);
            }
            if (!res1.success) {
              await AssistitiListe.destroy({id: assistitoLista.id});
            } else {
              let data2 = await CryptHelper.encryptAndSend(JSON.stringify(assistitoLista), null, lista.struttura.publicKey);
              res2 = await iota.publishData(MOVIMENTI_ASSISTITI_LISTA, data2.data, listaEntityId);
              if (res2.success) {
                this._backupToArweave(MOVIMENTI_ASSISTITI_LISTA, data2.data, idLista);
              }
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
          if (res1.success && res2.success) {
            let listaRecord = await iota.getLastDataByTag(ASSISTITI_IN_LISTA, listaEntityId);
            if (listaRecord && listaRecord.payload) {
              let data = listaRecord.payload;
              let clearData = await CryptHelper.receiveAndDecrypt(data, lista.struttura.privateKey);
              data.clearData = JSON.parse(clearData);
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
            res3 = await iota.publishData(ASSISTITI_IN_LISTA, data.data, listaEntityId, listaFromBlockchain.version);
            if (res3.success) {
              this._backupToArweave(ASSISTITI_IN_LISTA, data.data, idLista, listaFromBlockchain.version);
            }
          }
          return {res1, res2, res3};
        } else {
          return null;
        }
      }
    }

  }

  async updateDBFromJsonListeAssistiti(assistitiListe) {
    for (let lista of assistitiListe) {
      let assititoLista = await AssistitiListe.findOne({id: lista.id});
      if (assititoLista) {
        await AssistitiListe.updateOne({id: lista.id}).set({
          assistito: lista.assistito,
          lista: lista.lista,
          stato: lista.stato,
          chiuso: lista.chiuso
        });
      } else {
        await AssistitiListe.create({
          id: lista.id,
          assistito: lista.assistito,
          lista: lista.lista,
          stato: lista.stato,
          chiuso: lista.chiuso
        });
      }
    }
  }
}

module.exports = ListManager;
