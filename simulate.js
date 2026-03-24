#!/usr/bin/env node
/**
 * Simulatore ExArt26 IOTA
 *
 * Chiama le API reali del backend per creare dati di test.
 * Il frontend si aggiorna in tempo reale perché i dati passano dal backend.
 *
 * Uso: npm run simulate (oppure node simulate.js)
 * Prerequisito: il backend deve essere avviato (npm run dev o sails lift)
 */

const http = require('http');

const BASE = 'http://localhost:1337';
let csrfToken = null;
let sessionCookie = null;

const NOMI_M = ['Marco','Luca','Alessandro','Andrea','Matteo','Lorenzo','Giuseppe','Francesco','Antonio','Giovanni','Roberto','Davide','Stefano','Paolo','Massimo'];
const NOMI_F = ['Maria','Anna','Francesca','Laura','Valentina','Chiara','Sara','Giulia','Silvia','Paola','Elena','Alessandra','Roberta','Monica','Federica'];
const COGNOMI = ['Rossi','Russo','Ferrari','Esposito','Bianchi','Romano','Colombo','Ricci','Marino','Greco','Bruno','Gallo','Conti','De Luca','Mancini','Costa','Giordano','Rizzo','Lombardi','Moretti'];
const CITTA = ['Roma','Milano','Napoli','Torino','Firenze','Bologna','Palermo','Bari','Catania','Genova'];
const CATEGORIE = ['riabilitazione_motoria','fisioterapia','logopedia','terapia_occupazionale','neuroriabilitazione'];
const TIPI_STR = ['Centro Riabilitazione','Clinica','Ambulatorio','Casa di Cura','RSA'];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
function randomCF() {
  const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', D = '0123456789';
  let cf = '';
  for (let i = 0; i < 6; i++) cf += L[Math.floor(Math.random() * 26)];
  for (let i = 0; i < 2; i++) cf += D[Math.floor(Math.random() * 10)];
  cf += L[Math.floor(Math.random() * 26)];
  for (let i = 0; i < 2; i++) cf += D[Math.floor(Math.random() * 10)];
  cf += L[Math.floor(Math.random() * 26)];
  for (let i = 0; i < 3; i++) cf += D[Math.floor(Math.random() * 10)];
  cf += L[Math.floor(Math.random() * 26)];
  return cf;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchJSON(path) {
  return new Promise((resolve, reject) => {
    const opts = { headers: {} };
    if (sessionCookie) opts.headers['Cookie'] = sessionCookie;
    http.get(BASE + path, opts, (res) => {
      if (res.headers['set-cookie']) sessionCookie = res.headers['set-cookie'][0].split(';')[0];
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(new Error(d.substring(0,100))); } });
    }).on('error', reject);
  });
}

async function postJSON(path, body) {
  if (!csrfToken) {
    const csrf = await fetchJSON('/csrfToken');
    csrfToken = csrf._csrf;
  }
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(BASE + path, {
      method: 'POST', timeout: 120000,
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
        'Cookie': sessionCookie || '',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      if (res.headers['set-cookie']) sessionCookie = res.headers['set-cookie'][0].split(';')[0];
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode === 403) { csrfToken = null; reject(new Error('CSRF expired')); return; }
        try { resolve(JSON.parse(d)); } catch(e) { reject(new Error(`HTTP ${res.statusCode}: ${d.substring(0,100)}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(data);
    req.end();
  });
}

function log(emoji, msg) {
  const time = new Date().toLocaleTimeString('it-IT');
  console.log(`${time} ${emoji} ${msg}`);
}

async function main() {
  console.log('\n🚀 ExArt26 IOTA - Simulatore\n');
  console.log('Questo script crea dati di test chiamando le API reali.');
  console.log('Il frontend su http://localhost:5173 si aggiorna in tempo reale.\n');
  console.log('─'.repeat(60));

  // Verifica che il server sia attivo
  try {
    const wallet = await fetchJSON('/api/v1/wallet/get-info');
    log('✅', `Server attivo - Wallet: ${wallet.status}`);
    if (wallet.status !== 'WALLET OK') {
      log('⚠️', 'Wallet non inizializzato! Inizializzalo dal frontend prima.');
      process.exit(1);
    }
  } catch (e) {
    log('❌', `Server non raggiungibile su ${BASE}. Avvia con: npm run dev`);
    process.exit(1);
  }

  const orgIds = [];
  const strIds = [];
  const listaIds = [];
  const assIds = [];

  // Parametro: numero assistiti (da argv o default 100)
  const TARGET_ASS = parseInt(process.argv[2]) || 100;

  // Proporzioni: 5% org, 10% strutture, 20% liste, 65% assistiti
  const NUM_ASS = Math.round(TARGET_ASS * 0.65);
  const TOT_LISTE = Math.max(2, Math.round(TARGET_ASS * 0.20));
  const TOT_STR = Math.max(1, Math.round(TARGET_ASS * 0.10));
  const NUM_ORG = Math.max(1, Math.round(TARGET_ASS * 0.05));
  const STR_PER_ORG = Math.max(1, Math.round(TOT_STR / NUM_ORG));
  const LISTE_PER_STR = Math.max(1, Math.round(TOT_LISTE / TOT_STR));

  log('📊', `Target: ${TARGET_ASS} entita totali`);
  log('📊', `  ${NUM_ORG} org × ${STR_PER_ORG} str × ${LISTE_PER_STR} liste = ${NUM_ORG * STR_PER_ORG * LISTE_PER_STR} liste, ${NUM_ASS} assistiti`);

  // === FASE 1: Organizzazioni ===
  log('🏢', `FASE 1: Creazione ${NUM_ORG} organizzazioni...`);
  for (let i = 0; i < NUM_ORG; i++) {
    const nome = `ASL ${pick(CITTA)} ${i + 1}`;
    try {
      const res = await postJSON('/api/v1/add-organizzazione', { denominazione: nome });
      const id = res.organizzazione?.id;
      if (id) { orgIds.push(id); log('🏢', `  Org #${id}: ${nome} [blockchain: ${JSON.stringify(res.blockchain)}]`); }
      else { log('⚠️', `  Org "${nome}": risposta senza ID`); }
    } catch (e) { log('❌', `  Org "${nome}": ${e.message}`); }
    await sleep(1000);
  }

  // === FASE 2: Strutture ===
  log('🏥', `\nFASE 2: Creazione strutture (${orgIds.length * STR_PER_ORG} totali)...`);
  for (const orgId of orgIds) {
    for (let j = 0; j < STR_PER_ORG; j++) {
      const nome = `${pick(TIPI_STR)} ${pick(COGNOMI)} ${j + 1}`;
      try {
        const res = await postJSON('/api/v1/add-struttura', {
          denominazione: nome,
          indirizzo: `Via ${pick(COGNOMI)} ${Math.floor(Math.random()*100)+1}, ${pick(CITTA)}`,
          organizzazione: orgId,
        });
        const id = res.struttura?.id;
        if (id) { strIds.push(id); log('🏥', `  Str #${id}: ${nome} (org #${orgId})`); }
      } catch (e) { log('❌', `  Str: ${e.message}`); }
      await sleep(500);
    }
  }

  // === FASE 3: Liste ===
  log('📋', `\nFASE 3: Creazione liste (${strIds.length * LISTE_PER_STR} totali)...`);
  for (const strId of strIds) {
    for (let k = 0; k < LISTE_PER_STR; k++) {
      const cat = pick(CATEGORIE);
      try {
        const res = await postJSON('/api/v1/add-lista', {
          denominazione: `Lista ${cat.replace(/_/g,' ')} ${k+1}`,
          tag: cat,
          struttura: strId,
        });
        const id = res.lista?.id;
        if (id) { listaIds.push(id); log('📋', `  Lista #${id}: ${cat} (str #${strId})`); }
      } catch (e) { log('❌', `  Lista: ${e.message}`); }
      await sleep(500);
    }
  }

  // === FASE 4: Assistiti ===
  log('👤', `\nFASE 4: Creazione ${NUM_ASS} assistiti...`);
  const cfSet = new Set();
  for (let a = 0; a < NUM_ASS; a++) {
    let cf; do { cf = randomCF(); } while (cfSet.has(cf)); cfSet.add(cf);
    const isMale = Math.random() > 0.5;
    const nome = pick(isMale ? NOMI_M : NOMI_F);
    const cognome = pick(COGNOMI);
    try {
      const res = await postJSON('/api/v1/add-assistito', {
        nome, cognome, codiceFiscale: cf,
        email: `${nome.toLowerCase()}.${cognome.toLowerCase()}${a}@test.it`,
      });
      const id = res.assistito?.id;
      if (id) { assIds.push(id); log('👤', `  Ass #${id}: ${cognome} ${nome} (${cf}) anonId:${res.assistito?.anonId}`); }
    } catch (e) { log('❌', `  Ass: ${e.message}`); }
    await sleep(300);
  }

  // === FASE 5: Inserimento in liste ===
  if (listaIds.length > 0 && assIds.length > 0) {
    log('➡️', `\nFASE 5: Inserimento assistiti nelle liste...`);
    for (const assId of assIds) {
      const lista = pick(listaIds);
      try {
        await postJSON('/api/v1/add-assistito-in-lista', { idAssistito: assId, idLista: lista });
        log('➡️', `  Ass #${assId} -> Lista #${lista}`);
      } catch (e) { log('⚠️', `  Ass #${assId}: ${e.message.substring(0,50)}`); }
      await sleep(200);
    }
  }

  // === FASE 6: Simulazione uscite ===
  log('🔄', `\nFASE 6: Simulazione uscite (chiamate)...`);
  // Prendiamo i primi 5 dalle liste per "chiamarli"
  for (const listaId of listaIds.slice(0, 5)) {
    try {
      const det = await fetchJSON(`/api/v1/liste-dettaglio?idLista=${listaId}`);
      if (det.coda && det.coda.length > 0) {
        const primo = det.coda[0];
        const stati = [2, 3]; // in assistenza o completato
        await postJSON('/api/v1/rimuovi-assistito-da-lista', {
          idAssistitoListe: primo.id,
          stato: pick(stati),
        });
        const nome = primo.assistito ? `${primo.assistito.cognome} ${primo.assistito.nome}` : `#${primo.id}`;
        log('🔄', `  ${nome} chiamato dalla lista #${listaId}`);
      }
    } catch (e) { log('⚠️', `  Uscita lista #${listaId}: ${e.message.substring(0,50)}`); }
    await sleep(500);
  }

  // === RIEPILOGO ===
  console.log('\n' + '─'.repeat(60));
  log('✅', `SIMULAZIONE COMPLETATA!`);
  log('📊', `Creati: ${orgIds.length} org, ${strIds.length} str, ${listaIds.length} liste, ${assIds.length} assistiti`);
  console.log('\n👉 Apri http://localhost:5173 per vedere i dati nel frontend');
  console.log('👉 Apri http://localhost:5173/pubblico per la vista pubblica');
  console.log('👉 Apri http://localhost:5173/grafo per il grafo interattivo\n');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
