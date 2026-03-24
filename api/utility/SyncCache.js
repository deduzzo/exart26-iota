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
   * Segna un modello come modificato per l'export incrementale.
   * Chiama scheduleSave() automaticamente.
   */
  static markDirty(modelName) {
    SyncCache._dirtyModels.add(modelName);
    SyncCache.scheduleSave();
  }

  /**
   * Esporta lo stato corrente del DB in-memory come cache.
   * Esporta solo i modelli marcati come dirty (incrementale).
   */
  static async exportFromDB() {
    let existing = {};
    try {
      const raw = fs.readFileSync(CACHE_PATH, 'utf8');
      existing = JSON.parse(raw);
    } catch (e) { /* file non esiste, partire da zero */ }

    // Snapshot atomico + clear immediato per evitare race condition
    // Se nuovi markDirty() arrivano durante le find() async, finiscono nel prossimo ciclo
    const dirty = new Set(SyncCache._dirtyModels);
    SyncCache._dirtyModels.clear();
    if (dirty.size === 0) return existing;

    const modelMap = {
      organizzazioni: 'Organizzazione',
      strutture: 'Struttura',
      liste: 'Lista',
      assistiti: 'Assistito',
      assistitiListe: 'AssistitiListe',
    };

    for (const [key, model] of Object.entries(modelMap)) {
      if (dirty.has(model)) {
        const records = await sails.models[model.toLowerCase()].find();
        // Nota: sails-disk ignora .select()/.omit() — il delete post-query è l'unico modo
        existing[key] = records.map(r => {
          const o = { ...r };
          delete o.privateKey;
          return o;
        });
      }
    }

    this.save(existing);
    return existing;
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

SyncCache._timer = null;
SyncCache._dirtyModels = new Set();
SyncCache.scheduleSave = function() {
  if (SyncCache._timer) return;
  SyncCache._timer = setTimeout(async () => {
    SyncCache._timer = null;
    try {
      await SyncCache.exportFromDB();
    } catch (e) {
      if (typeof sails !== 'undefined') sails.log.warn('[SyncCache] Errore salvataggio schedulato:', e.message);
    }
  }, 5000);
};

module.exports = SyncCache;
