/**
 * SyncCache - Cache locale persistente su file per i dati blockchain.
 *
 * Salva/carica i dati decrittati in .tmp/sync-cache.json.
 * Ricostruibile in qualsiasi momento dalla blockchain (reset).
 * Non contiene chiavi private - solo dati pubblici delle entita.
 */

const fs = require('fs');
const path = require('path');

const CACHE_PATH = path.resolve(__dirname, '../../.tmp/sync-cache.json');

class SyncCache {

  static load() {
    try {
      if (fs.existsSync(CACHE_PATH)) {
        const raw = fs.readFileSync(CACHE_PATH, 'utf8');
        const data = JSON.parse(raw);
        sails.log.info(`[SyncCache] Cache caricata: ${data.organizzazioni?.length || 0} org, ${data.strutture?.length || 0} str, ${data.assistiti?.length || 0} ass, ${data.assistitiListe?.length || 0} mov`);
        return data;
      }
    } catch (e) {
      sails.log.warn('[SyncCache] Errore lettura cache:', e.message);
    }
    return null;
  }

  static save(data) {
    try {
      const dir = path.dirname(CACHE_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      data.savedAt = Date.now();
      fs.writeFileSync(CACHE_PATH, JSON.stringify(data, null, 0), 'utf8');
      sails.log.info(`[SyncCache] Cache salvata: ${data.organizzazioni?.length || 0} org, ${data.strutture?.length || 0} str, ${data.assistiti?.length || 0} ass`);
    } catch (e) {
      sails.log.warn('[SyncCache] Errore salvataggio cache:', e.message);
    }
  }

  static reset() {
    try {
      if (fs.existsSync(CACHE_PATH)) {
        fs.unlinkSync(CACHE_PATH);
        sails.log.info('[SyncCache] Cache eliminata');
      }
    } catch (e) {
      sails.log.warn('[SyncCache] Errore eliminazione cache:', e.message);
    }
  }

  static exists() {
    return fs.existsSync(CACHE_PATH);
  }

  /**
   * Esporta lo stato corrente del DB in-memory come cache.
   */
  static async exportFromDB() {
    const organizzazioni = await Organizzazione.find();
    const strutture = await Struttura.find();
    const liste = await Lista.find();
    const assistiti = await Assistito.find();
    const assistitiListe = await AssistitiListe.find();

    const data = {
      organizzazioni: organizzazioni.map(o => ({ ...o, privateKey: undefined })),
      strutture: strutture.map(s => ({ ...s, privateKey: undefined })),
      liste: liste.map(l => ({ ...l, privateKey: undefined })),
      assistiti: assistiti.map(a => ({ ...a, privateKey: undefined })),
      assistitiListe,
    };

    this.save(data);
    return data;
  }

  /**
   * Importa la cache nel DB in-memory.
   */
  static async importToDB(data) {
    let imported = { organizzazioni: 0, strutture: 0, liste: 0, assistiti: 0, assistitiListe: 0 };

    for (const org of (data.organizzazioni || [])) {
      try {
        const existing = await Organizzazione.findOne({ id: org.id });
        if (!existing) await Organizzazione.create(org);
        else await Organizzazione.updateOne({ id: org.id }).set(org);
        imported.organizzazioni++;
      } catch (e) { /* skip duplicates */ }
    }

    for (const str of (data.strutture || [])) {
      try {
        const existing = await Struttura.findOne({ id: str.id });
        if (!existing) await Struttura.create(str);
        else await Struttura.updateOne({ id: str.id }).set(str);
        imported.strutture++;
      } catch (e) { /* skip */ }
    }

    for (const lst of (data.liste || [])) {
      try {
        const existing = await Lista.findOne({ id: lst.id });
        if (!existing) await Lista.create(lst);
        else await Lista.updateOne({ id: lst.id }).set(lst);
        imported.liste++;
      } catch (e) { /* skip */ }
    }

    for (const ass of (data.assistiti || [])) {
      try {
        const existing = await Assistito.findOne({ id: ass.id });
        if (!existing) await Assistito.create(ass);
        else await Assistito.updateOne({ id: ass.id }).set(ass);
        imported.assistiti++;
      } catch (e) { /* skip */ }
    }

    for (const al of (data.assistitiListe || [])) {
      try {
        const existing = await AssistitiListe.findOne({ id: al.id });
        if (!existing) await AssistitiListe.create(al);
        else await AssistitiListe.updateOne({ id: al.id }).set(al);
        imported.assistitiListe++;
      } catch (e) { /* skip */ }
    }

    return imported;
  }
}

  /**
   * Salvataggio debounced - salva al massimo ogni 5 secondi.
   */
  static _saveTimer = null;
  static scheduleSave() {
    if (this._saveTimer) return; // gia schedulato
    this._saveTimer = setTimeout(async () => {
      this._saveTimer = null;
      try {
        await this.exportFromDB();
      } catch (e) {
        sails.log.warn('[SyncCache] Errore salvataggio schedulato:', e.message);
      }
    }, 5000);
  }
}

module.exports = SyncCache;
