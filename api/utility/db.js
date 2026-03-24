/**
 * db.js - SQLite storage layer with better-sqlite3
 *
 * Synchronous, zero-dependency (besides better-sqlite3) local cache.
 * All data is reconstructible from blockchain — this is just a fast cache.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Part 1: Init + Schema
// ---------------------------------------------------------------------------

const DB_PATH = path.resolve(__dirname, '../../.tmp/exart26.db');

// Ensure .tmp directory exists
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const database = new Database(DB_PATH);
database.pragma('journal_mode = WAL');  // Better concurrent read performance
database.pragma('foreign_keys = ON');

// Create tables
database.exec(`
  CREATE TABLE IF NOT EXISTS organizzazioni (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    denominazione TEXT NOT NULL,
    publicKey TEXT,
    privateKey TEXT,
    ultimaVersioneSuBlockchain INTEGER DEFAULT 0,
    createdAt INTEGER,
    updatedAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS strutture (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    denominazione TEXT,
    indirizzo TEXT,
    organizzazione INTEGER,
    attiva INTEGER DEFAULT 1,
    publicKey TEXT,
    privateKey TEXT,
    ultimaVersioneSuBlockchain INTEGER DEFAULT 0,
    createdAt INTEGER,
    updatedAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS liste (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    denominazione TEXT NOT NULL,
    tag TEXT,
    struttura INTEGER,
    aperta INTEGER DEFAULT 1,
    publicKey TEXT,
    ultimaVersioneSuBlockchain INTEGER DEFAULT 0,
    createdAt INTEGER,
    updatedAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS assistiti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    anonId TEXT NOT NULL,
    nome TEXT NOT NULL,
    cognome TEXT NOT NULL,
    codiceFiscale TEXT NOT NULL,
    dataNascita TEXT,
    email TEXT,
    telefono TEXT,
    indirizzo TEXT,
    publicKey TEXT,
    privateKey TEXT,
    ultimaVersioneSuBlockchain INTEGER DEFAULT 0,
    createdAt INTEGER,
    updatedAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS assistiti_liste (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assistito INTEGER,
    lista INTEGER,
    stato INTEGER DEFAULT 1,
    chiuso INTEGER DEFAULT 0,
    dataOraIngresso INTEGER,
    dataOraUscita INTEGER,
    createdAt INTEGER,
    updatedAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS blockchain_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    digest TEXT UNIQUE,
    tag TEXT NOT NULL,
    entityId TEXT,
    version INTEGER,
    payload TEXT,
    timestamp INTEGER,
    cursor TEXT
  );

  CREATE TABLE IF NOT EXISTS sync_state (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Create indexes
database.exec(`
  CREATE INDEX IF NOT EXISTS idx_strutture_org ON strutture(organizzazione);
  CREATE INDEX IF NOT EXISTS idx_liste_str ON liste(struttura);
  CREATE INDEX IF NOT EXISTS idx_assistiti_cf ON assistiti(codiceFiscale);
  CREATE INDEX IF NOT EXISTS idx_assistiti_anon ON assistiti(anonId);
  CREATE INDEX IF NOT EXISTS idx_al_assistito ON assistiti_liste(assistito);
  CREATE INDEX IF NOT EXISTS idx_al_lista ON assistiti_liste(lista);
  CREATE INDEX IF NOT EXISTS idx_al_stato ON assistiti_liste(stato, chiuso);
  CREATE INDEX IF NOT EXISTS idx_bc_tag ON blockchain_data(tag);
  CREATE INDEX IF NOT EXISTS idx_bc_entity ON blockchain_data(tag, entityId);
`);

// ---------------------------------------------------------------------------
// Part 2: buildWhere + buildSelect helpers
// ---------------------------------------------------------------------------

function buildWhere(where) {
  if (!where || Object.keys(where).length === 0) {
    return { whereClause: '1=1', whereParams: [] };
  }
  const clauses = [];
  const params = [];
  for (const [key, value] of Object.entries(where)) {
    if (Array.isArray(value)) {
      clauses.push(`${key} IN (${value.map(() => '?').join(', ')})`);
      params.push(...value);
    } else if (value === null || value === undefined) {
      clauses.push(`${key} IS NULL`);
    } else if (typeof value === 'boolean') {
      clauses.push(`${key} = ?`);
      params.push(value ? 1 : 0);
    } else {
      clauses.push(`${key} = ?`);
      params.push(value);
    }
  }
  return { whereClause: clauses.join(' AND '), whereParams: params };
}

function buildSelect(tableName, where, options = {}) {
  const { whereClause, whereParams } = buildWhere(where);
  let sql = `SELECT * FROM ${tableName} WHERE ${whereClause}`;
  if (options.sort) sql += ` ORDER BY ${options.sort}`;
  if (options.limit) sql += ` LIMIT ${parseInt(options.limit)}`;
  return { sql, params: whereParams };
}

// ---------------------------------------------------------------------------
// Part 3: createModel factory
// ---------------------------------------------------------------------------

function createModel(tableName, opts = {}) {
  const booleanFields = opts.booleanFields || [];
  const omitFromJSON = opts.omitFromJSON || [];

  function toRow(data) {
    const row = {};
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      if (typeof v === 'boolean') row[k] = v ? 1 : 0;
      else row[k] = v;
    }
    if (!row.createdAt) row.createdAt = Date.now();
    if (!row.updatedAt) row.updatedAt = Date.now();
    return row;
  }

  function fromRow(row) {
    if (!row) return null;
    const obj = { ...row };
    for (const f of booleanFields) {
      if (f in obj) obj[f] = !!obj[f];
    }
    return obj;
  }

  function toJSON(row) {
    if (!row) return null;
    const obj = fromRow(row);
    for (const f of omitFromJSON) delete obj[f];
    return obj;
  }

  return {
    find(where = {}, options = {}) {
      const { sql, params } = buildSelect(tableName, where, options);
      return database.prepare(sql).all(...params).map(fromRow);
    },

    findOne(where) {
      const { sql, params } = buildSelect(tableName, where, { limit: 1 });
      const row = database.prepare(sql).get(...params);
      return fromRow(row);
    },

    create(data) {
      const row = toRow(data);
      const cols = Object.keys(row);
      const placeholders = cols.map(() => '?').join(', ');
      const values = cols.map(c => row[c]);
      const result = database.prepare(
        `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders})`
      ).run(...values);
      return fromRow({ ...row, id: Number(result.lastInsertRowid) });
    },

    update(where, data) {
      const updates = { ...data, updatedAt: Date.now() };
      // Convert booleans
      for (const [k, v] of Object.entries(updates)) {
        if (typeof v === 'boolean') updates[k] = v ? 1 : 0;
      }
      const setCols = Object.keys(updates);
      const setValues = setCols.map(c => updates[c]);
      const { whereClause, whereParams } = buildWhere(where);
      database.prepare(
        `UPDATE ${tableName} SET ${setCols.map(c => `${c} = ?`).join(', ')} WHERE ${whereClause}`
      ).run(...setValues, ...whereParams);
      return this.find(where);
    },

    updateOne(where) {
      const self = this;
      return { set: (data) => { self.update(where, data); return self.findOne(where); } };
    },

    destroy(where) {
      if (!where || Object.keys(where).length === 0) {
        database.prepare(`DELETE FROM ${tableName}`).run();
      } else {
        const { whereClause, whereParams } = buildWhere(where);
        database.prepare(`DELETE FROM ${tableName} WHERE ${whereClause}`).run(...whereParams);
      }
    },

    count(where = {}) {
      const { whereClause, whereParams } = buildWhere(where);
      const row = database.prepare(`SELECT COUNT(*) as cnt FROM ${tableName} WHERE ${whereClause}`).get(...whereParams);
      return row.cnt;
    },

    toJSON(record) { return toJSON(record); },
  };
}

// ---------------------------------------------------------------------------
// Part 4: Export models + join methods + utilities
// ---------------------------------------------------------------------------

const db = {
  Organizzazione: createModel('organizzazioni', { omitFromJSON: ['privateKey'] }),
  Struttura: createModel('strutture', { booleanFields: ['attiva'], omitFromJSON: ['privateKey'] }),
  Lista: createModel('liste', { booleanFields: ['aperta'] }),
  Assistito: createModel('assistiti', { omitFromJSON: ['privateKey'] }),
  AssistitiListe: createModel('assistiti_liste', { booleanFields: ['chiuso'] }),
  BlockchainData: createModel('blockchain_data'),
  SyncState: createModel('sync_state'),

  raw: database,

  transaction(fn) {
    const trx = database.transaction(fn);
    return trx();
  },

  close() { database.close(); },
};

// Strutture with org name
db.Struttura.findWithOrg = function(where = {}, options = {}) {
  const { whereClause, whereParams } = buildWhere(where);
  let sql = `SELECT s.*, o.denominazione as orgDenominazione, o.id as orgId
    FROM strutture s LEFT JOIN organizzazioni o ON s.organizzazione = o.id
    WHERE ${whereClause}`;
  if (options.sort) sql += ` ORDER BY ${options.sort}`;
  if (options.limit) sql += ` LIMIT ${parseInt(options.limit)}`;
  return database.prepare(sql).all(...whereParams);
};

// AssistitiListe with assistito + lista details
db.AssistitiListe.findWithDetails = function(where = {}, options = {}) {
  const { whereClause, whereParams } = buildWhere(where);
  let sql = `SELECT al.*,
    a.nome as assNome, a.cognome as assCognome, a.codiceFiscale as assCF, a.anonId as assAnonId,
    l.denominazione as listaDenominazione, l.struttura as listaStruttura
    FROM assistiti_liste al
    LEFT JOIN assistiti a ON al.assistito = a.id
    LEFT JOIN liste l ON al.lista = l.id
    WHERE ${whereClause}`;
  if (options.sort) sql += ` ORDER BY ${options.sort}`;
  if (options.limit) sql += ` LIMIT ${parseInt(options.limit)}`;
  return database.prepare(sql).all(...whereParams);
};

// Liste with struttura info
db.Lista.findWithStruttura = function(where = {}) {
  const { whereClause, whereParams } = buildWhere(where);
  return database.prepare(`SELECT l.*, s.denominazione as strDenominazione, s.organizzazione as strOrganizzazione
    FROM liste l LEFT JOIN strutture s ON l.struttura = s.id
    WHERE ${whereClause}`).all(...whereParams);
};

module.exports = db;
