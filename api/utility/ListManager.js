const crypto = require('crypto');
const iota = require('./iota');
const CryptHelper = require('./CryptHelper');
const ArweaveHelper = require('./ArweaveHelper');
const db = require('./db');
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

// --- Inlined static model helpers (decoupled from Waterline) ---

function getWalletIdOrganizzazione(id) {
  return id.toString();
}

function getWalletIdStruttura(id) {
  const struttura = db.Struttura.findOne({ id });
  if (struttura) {
    return struttura.organizzazione + '_' + struttura.id;
  }
  return null;
}

function getWalletIdLista(id) {
  const lista = db.Lista.findOne({ id });
  if (lista) {
    const struttura = db.Struttura.findOne({ id: lista.struttura });
    if (struttura) {
      return struttura.organizzazione + '_' + struttura.id + '_' + lista.id;
    }
  }
  return null;
}

function generateAnonId(codiceFiscale) {
  return crypto.createHash('sha256')
    .update(codiceFiscale.toUpperCase().trim())
    .digest('hex')
    .substring(0, 8)
    .toUpperCase();
}

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

  /**
   * Ricostruisce il DB locale leggendo direttamente dalla blockchain IOTA 2.0.
   * Strategia: legge l'indice MAIN_DATA (lista entityId per tipo),
   * poi recupera ogni entita dalla sua transazione dedicata.
   * Se l'indice non esiste, fa discovery scansionando tutte le tx per tag.
   */
  async updateDBfromBlockchain(onProgress = null) {
    sails.log.info('[ListManager] Inizio sync da blockchain...');
    let imported = { organizzazioni: 0, strutture: 0, liste: 0, assistiti: 0 };
    const reportProgress = (status, total, processed) => {
      if (onProgress) onProgress({ status, ...imported, total, processed });
    };

    try {
      // Strategia 1: Leggi l'indice MAIN_DATA
      let indexRecord = await iota.getLastDataByTag(MAIN_DATA);
      let entityIndex = null;

      if (indexRecord && indexRecord.payload) {
        let decrypted = await CryptHelper.receiveAndDecrypt(indexRecord.payload, iota.GET_MAIN_KEYS().privateKey);
        entityIndex = JSON.parse(decrypted);
        sails.log.info(`[ListManager] Indice MAIN_DATA trovato: ${entityIndex.entities?.length || 0} entita`);
      }

      // Strategia 2: Se non c'e indice, discovery per tag
      if (!entityIndex) {
        sails.log.info('[ListManager] Nessun indice, discovery diretto per tag...');
        entityIndex = { entities: [] };

        // Cerca tutte le transazioni per ogni tipo
        const orgRecords = await iota.getAllDataByTag(ORGANIZZAZIONE_DATA);
        for (const r of orgRecords) {
          entityIndex.entities.push({ type: 'ORG', entityId: r.entityId, digest: r.digest });
        }
        const strRecords = await iota.getAllDataByTag(STRUTTURE_LISTE_DATA);
        for (const r of strRecords) {
          entityIndex.entities.push({ type: 'STR', entityId: r.entityId, digest: r.digest });
        }
        const assRecords = await iota.getAllDataByTag(ASSISTITI_DATA);
        for (const r of assRecords) {
          entityIndex.entities.push({ type: 'ASS', entityId: r.entityId, digest: r.digest });
        }
        sails.log.info(`[ListManager] Discovery: trovate ${entityIndex.entities.length} entita`);
      }

      // Se l'indice non contiene assistiti, fai discovery dalla chain
      const hasAss = entityIndex.entities.some(e => e.type === 'ASS');
      if (!hasAss) {
        sails.log.info('[ListManager] Indice senza assistiti, discovery ASSISTITI_DATA dalla chain...');
        const assRecords = await iota.getAllDataByTag(ASSISTITI_DATA);
        for (const r of assRecords) {
          entityIndex.entities.push({ type: 'ASS', entityId: r.entityId, digest: r.digest });
        }
        if (assRecords.length > 0) {
          sails.log.info(`[ListManager] Discovery: trovati ${assRecords.length} assistiti sulla chain`);
        }
      }

      // Deduplicazione per entityId (tieni solo l'ultimo per tipo+entityId)
      const seen = new Set();
      const uniqueEntities = [];
      for (const e of entityIndex.entities) {
        const key = `${e.type}:${e.entityId}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueEntities.push(e);
        }
      }

      // Recupera e importa ogni entita
      const total = uniqueEntities.length;
      let processed = 0;
      reportProgress('Lettura entita dalla blockchain...', total, 0);
      for (const entity of uniqueEntities) {
        processed++;
        try {
          const tag = entity.type === 'ORG' ? ORGANIZZAZIONE_DATA :
                      entity.type === 'STR' ? STRUTTURE_LISTE_DATA :
                      entity.type === 'ASS' ? ASSISTITI_DATA : null;
          if (!tag) continue;

          // Progresso ad ogni entità per l'UI
          reportProgress(`Importazione ${processed}/${total}...`, total, processed);
          if (processed % 10 === 0 || processed === 1 || processed === total) {
            sails.log.info(`[ListManager] Sync ${processed}/${total}: ${imported.organizzazioni} org, ${imported.strutture} str, ${imported.assistiti} ass...`);
          }

          const record = await iota.getLastDataByTag(tag, entity.entityId);
          if (!record || !record.payload) {
            sails.log.warn(`[ListManager] ${entity.type}:${entity.entityId}: nessun record sulla blockchain`);
            continue;
          }

          // Tenta decrittazione con diverse chiavi in ordine:
          // 1. Chiave privata dell'entita (dal PRIVATE_KEY record)
          // 2. Chiave MAIN (fallback)
          let clearData = null;
          const keysToTry = [];

          const pkRecord = await this.getLastPrivateKeyOfEntityId(entity.entityId);
          if (pkRecord?.clearData?.privateKey) {
            keysToTry.push({ name: 'entity', key: pkRecord.clearData.privateKey });
          }
          keysToTry.push({ name: 'MAIN', key: iota.GET_MAIN_KEYS().privateKey });

          for (const { name, key } of keysToTry) {
            try {
              const decrypted = await CryptHelper.receiveAndDecrypt(record.payload, key);
              clearData = JSON.parse(decrypted);
              sails.log.verbose(`[ListManager] ${entity.type}:${entity.entityId} decifrato con chiave ${name}`);
              break;
            } catch (decErr) {
              sails.log.verbose(`[ListManager] ${entity.type}:${entity.entityId} decrypt con ${name} fallito: ${decErr.message.substring(0,40)}`);
            }
          }

          if (!clearData) {
            sails.log.warn(`[ListManager] ${entity.type}:${entity.entityId}: impossibile decifrare con nessuna chiave`);
            continue;
          }

          if (entity.type === 'ORG') {
            this._upsertOrganizzazione(clearData);
            imported.organizzazioni++;
          } else if (entity.type === 'STR') {
            this._upsertStruttura(clearData, entity.entityId);
            imported.strutture++;
          } else if (entity.type === 'ASS') {
            this._upsertAssistito(clearData);
            imported.assistiti++;
          }
          reportProgress(`Importazione ${processed}/${total}...`, total, processed);
        } catch (entityErr) {
          sails.log.warn(`[ListManager] Errore import ${entity.type}:${entity.entityId}: ${entityErr.message}`);
        }
      }

      // Importa assistiti in lista (ASSISTITI_IN_LISTA) per ogni lista
      const listeCount = db.Lista.count();
      if (listeCount > 0) {
        sails.log.info(`[ListManager] Sync liste assistiti per ${listeCount} liste...`);
        reportProgress('Importazione assistiti in lista...', total, processed);
        try {
          await this.updateListeAssistitiFromBlockchain();
          imported.assistitiListe = db.AssistitiListe.count();
          sails.log.info(`[ListManager] Sync liste assistiti completata: ${imported.assistitiListe} movimenti`);
        } catch (alErr) {
          sails.log.warn(`[ListManager] Sync liste assistiti fallita: ${alErr.message}`);
        }
      }

      sails.log.info(`[ListManager] Sync completata: ${imported.organizzazioni} org, ${imported.strutture} str, ${imported.assistiti} ass, ${imported.assistitiListe || 0} mov`);
      return { success: true, data: imported, source: 'iota' };
    } catch (err) {
      sails.log.warn('[ListManager] Sync fallita:', err.message);
      return { success: false, data: [], error: err.message };
    }
  }

  // --- Upsert helpers per ricostruzione DB ---

  _upsertOrganizzazione(data) {
    const existing = db.Organizzazione.findOne({ id: data.id });
    const record = {
      denominazione: data.denominazione,
      publicKey: data.publicKey,
      ultimaVersioneSuBlockchain: data.ultimaVersioneSuBlockchain || 0,
    };
    if (existing) {
      db.Organizzazione.updateOne({ id: data.id }).set(record);
    } else {
      db.Organizzazione.create({ id: data.id, ...record });
    }
  }

  _upsertStruttura(data, entityId = null) {
    const existing = db.Struttura.findOne({ id: data.id });
    // Ricava organizzazione dal payload o dall'entityId (formato: orgId_strId)
    let orgId = data.organizzazione;
    if (!orgId && entityId && entityId.includes('_')) {
      orgId = parseInt(entityId.split('_')[0]);
    }
    const record = {
      denominazione: data.denominazione,
      attiva: data.attiva,
      indirizzo: data.indirizzo,
      publicKey: data.publicKey,
      ultimaVersioneSuBlockchain: data.ultimaVersioneSuBlockchain || 0,
      organizzazione: orgId || null,
    };
    if (existing) {
      db.Struttura.updateOne({ id: data.id }).set(record);
    } else {
      db.Struttura.create({ id: data.id, ...record });
    }
    // Importa anche le liste se presenti nel payload
    if (data.liste && Array.isArray(data.liste)) {
      for (const lista of data.liste) {
        this._upsertLista(lista, data.id);
      }
    }
  }

  _upsertLista(data, strutturaId) {
    const existing = db.Lista.findOne({ id: data.id });
    const record = {
      denominazione: data.denominazione,
      aperta: data.aperta !== undefined ? data.aperta : true,
      publicKey: data.publicKey,
      ultimaVersioneSuBlockchain: data.ultimaVersioneSuBlockchain || 0,
      struttura: strutturaId || data.struttura,
    };
    if (existing) {
      db.Lista.updateOne({ id: data.id }).set(record);
    } else {
      db.Lista.create({ id: data.id, ...record });
    }
  }

  _upsertAssistito(data) {
    const existing = db.Assistito.findOne({ id: data.id });
    const anonId = data.anonId || (data.codiceFiscale ? generateAnonId(data.codiceFiscale) : 'UNKNOWN');
    const record = {
      nome: data.nome,
      cognome: data.cognome,
      codiceFiscale: data.codiceFiscale,
      anonId: anonId,
      dataNascita: data.dataNascita,
      email: data.email,
      telefono: data.telefono,
      indirizzo: data.indirizzo,
      publicKey: data.publicKey,
      ultimaVersioneSuBlockchain: data.ultimaVersioneSuBlockchain || 0,
    };
    if (existing) {
      db.Assistito.updateOne({ id: data.id }).set(record);
    } else {
      db.Assistito.create({ id: data.id, ...record });
    }
  }

  async updateListeAssistitiFromBlockchain(idLista) {
    let liste = null;
    if (idLista) {
      liste = db.Lista.find({id: idLista});
    } else {
      liste = db.Lista.find();
    }
    if (liste && liste.length > 0) {
      for (let lista of liste) {
        let listaEntityId = getWalletIdLista(lista.id);
        let record = await iota.getLastDataByTag(ASSISTITI_IN_LISTA, listaEntityId);
        let strutturaEntityId = getWalletIdStruttura(lista.struttura);
        let privateKeyData = await this.getLastPrivateKeyOfEntityId(strutturaEntityId);
        if (record && record.payload) {
          let data = record.payload;
          let clearData = await CryptHelper.receiveAndDecrypt(data, privateKeyData.clearData.privateKey);
          data.clearData = JSON.parse(clearData);
          this.updateDBFromJsonListeAssistiti(data.clearData);
        }
      }
    }
  }

  async updateDBFromJsonData(data) {
    this.syncDBFromJsonData(data);
  }

  syncDBFromJsonData(data) {
    for (let organizzazione of data) {
      let org = db.Organizzazione.findOne({id: organizzazione.id});
      if (org) {
        db.Organizzazione.updateOne({id: organizzazione.id}).set({
          denominazione: organizzazione.denominazione,
          publicKey: organizzazione.publicKey,
          ultimaVersioneSuBlockchain: organizzazione.ultimaVersioneSuBlockchain
        });
      } else {
        db.Organizzazione.create({
          id: organizzazione.id,
          denominazione: organizzazione.denominazione,
          publicKey: organizzazione.publicKey,
          ultimaVersioneSuBlockchain: organizzazione.ultimaVersioneSuBlockchain
        });
      }

      for (let strutture of organizzazione.strutture) {
        let str = db.Struttura.findOne({id: strutture.id});
        if (str) {
          db.Struttura.updateOne({id: strutture.id}).set({
            denominazione: strutture.denominazione,
            attiva: strutture.attiva,
            indirizzo: strutture.indirizzo,
            publicKey: strutture.publicKey,
            ultimaVersioneSuBlockchain: strutture.ultimaVersioneSuBlockchain,
            organizzazione: organizzazione.id
          });
        } else {
          db.Struttura.create({
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
          let lst = db.Lista.findOne({id: lista.id});
          if (lst) {
            db.Lista.updateOne({id: lista.id}).set({
              denominazione: lista.denominazione,
              aperta: lista.aperta,
              publicKey: lista.publicKey,
              ultimaVersioneSuBlockchain: lista.ultimaVersioneSuBlockchain,
              struttura: strutture.id
            });
          } else {
            db.Lista.create({
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
      let entityId = getWalletIdOrganizzazione(idOrganizzazione);
      let organizzazioneStrutture = db.Organizzazione.findOne({id: idOrganizzazione});
      if (organizzazioneStrutture) {
        organizzazioneStrutture.ultimaVersioneSuBlockchain = organizzazioneStrutture.ultimaVersioneSuBlockchain + 1;
        let data = await CryptHelper.encryptAndSend(JSON.stringify(organizzazioneStrutture), organizzazioneStrutture.ultimaVersioneSuBlockchain, organizzazioneStrutture.publicKey);
        let res = await iota.publishData(ORGANIZZAZIONE_DATA, data.data, entityId, organizzazioneStrutture.ultimaVersioneSuBlockchain);
        if (res.success) {
          db.Organizzazione.updateOne({id: idOrganizzazione}).set({ultimaVersioneSuBlockchain: organizzazioneStrutture.ultimaVersioneSuBlockchain});
          this._backupToArweave(ORGANIZZAZIONE_DATA, data.data, idOrganizzazione, organizzazioneStrutture.ultimaVersioneSuBlockchain);
        }
        return res;
      }
    }
    return {success: false};
  }

  async getLastDatiOrganizzazioneFromBlockchain(idOrganizzazione) {
    let organizzazione = db.Organizzazione.findOne({id: idOrganizzazione});
    if (organizzazione) {
      let entityId = getWalletIdOrganizzazione(idOrganizzazione);
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
      let entityId = getWalletIdStruttura(idStruttura);
      let strutturaCode = db.Struttura.findOne({id: idStruttura});
      if (strutturaCode) {
        // Manual populate: attach liste for this struttura
        strutturaCode.liste = db.Lista.find({struttura: idStruttura});
        strutturaCode.ultimaVersioneSuBlockchain = strutturaCode.ultimaVersioneSuBlockchain + 1;
        let data = await CryptHelper.encryptAndSend(JSON.stringify(strutturaCode), strutturaCode.ultimaVersioneSuBlockchain, strutturaCode.publicKey);
        let res = await iota.publishData(STRUTTURE_LISTE_DATA, data.data, entityId, strutturaCode.ultimaVersioneSuBlockchain);
        if (res.success) {
          db.Struttura.updateOne({id: idStruttura}).set({ultimaVersioneSuBlockchain: strutturaCode.ultimaVersioneSuBlockchain});
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
    let entityId = getWalletIdStruttura(idStruttura);
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

  /**
   * Pubblica un indice leggero MAIN_DATA sulla blockchain.
   * Contiene solo la lista di entityId per tipo + digest dell'ultima tx.
   * Serve come start-point certificato per il recovery.
   * Dimensione fissa ~50 bytes per entita → scala a migliaia di entita.
   */
  async updateOrganizzazioniStruttureListeToBlockchain() {
    let lastData = await this.getOrganizzazioniFromBlockchain();
    let newVersion = lastData ? (lastData.version + 1) : 0;

    // Costruisci l'indice leggero
    let entities = [];

    let organizzazioni = db.Organizzazione.find();
    for (let org of organizzazioni) {
      let entityId = getWalletIdOrganizzazione(org.id);
      entities.push({ type: 'ORG', entityId, id: org.id });
    }

    let strutture = db.Struttura.find();
    for (let str of strutture) {
      let entityId = getWalletIdStruttura(str.id);
      entities.push({ type: 'STR', entityId, id: str.id });
    }

    let liste = db.Lista.find();
    for (let lst of liste) {
      let entityId = getWalletIdLista(lst.id);
      entities.push({ type: 'LST', entityId, id: lst.id });
    }

    let assistiti = db.Assistito.find();
    for (let ass of assistiti) {
      entities.push({ type: 'ASS', entityId: 'ASS#' + ass.id, id: ass.id });
    }

    const indexData = { entities, version: newVersion, updatedAt: Date.now() };
    sails.log.info(`[ListManager] MAIN_DATA index: ${entities.length} entita, v${newVersion}`);

    let data2 = await CryptHelper.encryptAndSend(JSON.stringify(indexData), newVersion, iota.GET_MAIN_KEYS().publicKey);
    let res = await iota.publishData(MAIN_DATA, data2.data, null, newVersion);
    if (res.success) {
      this._backupToArweave(MAIN_DATA, data2.data, null, newVersion);
    }
    return res;
  }

  async updateDatiAssistitoToBlockchain(id) {
    if (id) {
      let entityId = 'ASS#' + id;
      let assistito = db.Assistito.findOne({id: id});
      if (assistito) {
        assistito.ultimaVersioneSuBlockchain = assistito.ultimaVersioneSuBlockchain + 1;
        let data = await CryptHelper.encryptAndSend(JSON.stringify(assistito), assistito.ultimaVersioneSuBlockchain, assistito.publicKey);
        let res = await iota.publishData(ASSISTITI_DATA, data.data, entityId, assistito.ultimaVersioneSuBlockchain);
        if (res.success) {
          db.Assistito.updateOne({id: id}).set({ultimaVersioneSuBlockchain: assistito.ultimaVersioneSuBlockchain});
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
      let lista = db.Lista.findOne({id: idLista});
      if (lista) {
        // Manual populate: attach struttura
        lista.struttura = db.Struttura.findOne({id: lista.struttura});
      }
      let assistito = db.Assistito.findOne({id: idAssistito});
      if (lista && lista.struttura && assistito) {
        let res1 = {success: false};
        let res2 = {success: false};
        let assistitoEntityId = 'ASS#' + idAssistito;
        let listaEntityId = getWalletIdLista(idLista);
        let listeInCoda = db.AssistitiListe.find({assistito: idAssistito, stato: INSERITO_IN_CODA, chiuso: false});
        if ((listeInCoda.length > 0 && (listeInCoda.find((l) => l.lista === idLista)) === undefined) || listeInCoda.length === 0) {
          let assistitoLista = null;
          try {
            assistitoLista = db.AssistitiListe.create({
              assistito: idAssistito,
              lista: idLista,
              stato: INSERITO_IN_CODA,
              dataOraIngresso: Date.now(),
            });
            let data = await CryptHelper.encryptAndSend(JSON.stringify([assistitoLista, ...listeInCoda]), null, assistito.publicKey);
            res1 = await iota.publishData(LISTE_IN_CODA, data.data, assistitoEntityId);
            if (res1.success) {
              this._backupToArweave(LISTE_IN_CODA, data.data, idAssistito);
            }
            if (!res1.success) {
              db.AssistitiListe.destroy({id: assistitoLista.id});
            } else {
              let data2 = await CryptHelper.encryptAndSend(JSON.stringify(assistitoLista), null, lista.struttura.publicKey);
              res2 = await iota.publishData(MOVIMENTI_ASSISTITI_LISTA, data2.data, listaEntityId);
              if (res2.success) {
                this._backupToArweave(MOVIMENTI_ASSISTITI_LISTA, data2.data, idLista);
              }
              if (!res2.success) {
                db.AssistitiListe.destroy({id: assistitoLista.id});
              }
            }
          } catch (e) {
            if (assistitoLista) {
              db.AssistitiListe.destroy({id: assistitoLista.id});
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

  updateDBFromJsonListeAssistiti(assistitiListe) {
    for (let al of assistitiListe) {
      const record = {
        assistito: al.assistito,
        lista: al.lista,
        stato: al.stato,
        chiuso: al.chiuso,
        dataOraIngresso: al.dataOraIngresso || null,
        dataOraUscita: al.dataOraUscita || null,
      };
      let existing = db.AssistitiListe.findOne({id: al.id});
      if (existing) {
        db.AssistitiListe.updateOne({id: al.id}).set(record);
      } else {
        db.AssistitiListe.create({ id: al.id, ...record });
      }
    }
  }
}

module.exports = ListManager;
