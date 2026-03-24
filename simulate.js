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

  // Parametro: numero target (da argv o default 100)
  const TARGET = parseInt(process.argv[2]) || 100;

  // Proporzioni: 5% org, 10% strutture, 20% liste, 65% assistiti
  const NUM_ORG = Math.max(1, Math.round(TARGET * 0.05));
  const TOT_STR = Math.max(1, Math.round(TARGET * 0.10));
  const TOT_LISTE = Math.max(2, Math.round(TARGET * 0.20));
  const NUM_ASS = Math.round(TARGET * 0.65);
  const STR_PER_ORG = Math.max(1, Math.round(TOT_STR / NUM_ORG));
  const LISTE_PER_STR = Math.max(1, Math.round(TOT_LISTE / TOT_STR));

  // === FASE 0: Inventario di cio che esiste ===
  log('🔍', 'Verifica dati esistenti...');

  let existingOrgs = [];
  try { const r = await fetchJSON('/api/v1/organizzazioni'); existingOrgs = r.organizzazioni || []; } catch(e) {}
  let existingStr = [];
  try { const r = await fetchJSON('/api/v1/strutture'); existingStr = r.strutture || []; } catch(e) {}
  let existingAss = [];
  try { const r = await fetchJSON('/api/v1/assistiti'); existingAss = r.assistiti || []; } catch(e) {}

  // Raccogli gli ID delle liste da tutte le strutture
  let existingListe = [];
  for (const s of existingStr) {
    if (s.liste) existingListe.push(...s.liste);
  }

  const orgIds = existingOrgs.map(o => o.id);
  const strIds = existingStr.map(s => s.id);
  const listaIds = existingListe.map(l => l.id);
  const assIds = existingAss.map(a => a.id);

  log('📊', `Target: ${TARGET} entita → ${NUM_ORG} org, ${TOT_STR} str, ${TOT_LISTE} liste, ${NUM_ASS} ass`);
  log('📊', `Esistenti: ${orgIds.length} org, ${strIds.length} str, ${listaIds.length} liste, ${assIds.length} ass`);

  const needOrg = Math.max(0, NUM_ORG - orgIds.length);
  const needStr = Math.max(0, TOT_STR - strIds.length);
  const needListe = Math.max(0, TOT_LISTE - listaIds.length);
  const needAss = Math.max(0, NUM_ASS - assIds.length);

  log('📊', `Da creare: ${needOrg} org, ${needStr} str, ${needListe} liste, ${needAss} ass`);

  if (needOrg + needStr + needListe + needAss === 0) {
    log('✅', 'Tutte le entita base sono gia presenti, passo al flusso ingresso/uscita.');
  }

  // === FASE 1: Organizzazioni mancanti ===
  if (needOrg > 0) {
    log('🏢', `\nFASE 1: Creazione ${needOrg} organizzazioni...`);
    for (let i = 0; i < needOrg; i++) {
      const nome = `ASL ${pick(CITTA)} ${orgIds.length + i + 1}`;
      try {
        const res = await postJSON('/api/v1/add-organizzazione', { denominazione: nome });
        const id = res.organizzazione?.id;
        if (id) { orgIds.push(id); log('🏢', `  ✓ Org #${id}: ${nome}`); }
      } catch (e) { log('❌', `  Org: ${e.message}`); }
      await sleep(1000);
    }
  } else {
    log('🏢', `Organizzazioni OK (${orgIds.length}/${NUM_ORG})`);
  }

  // === FASE 2: Strutture mancanti ===
  if (needStr > 0 && orgIds.length > 0) {
    log('🏥', `\nFASE 2: Creazione ${needStr} strutture...`);
    let created = 0;
    while (created < needStr) {
      const orgId = orgIds[created % orgIds.length]; // distribuisci tra le org
      const nome = `${pick(TIPI_STR)} ${pick(COGNOMI)} ${strIds.length + 1}`;
      try {
        const res = await postJSON('/api/v1/add-struttura', {
          denominazione: nome,
          indirizzo: `Via ${pick(COGNOMI)} ${Math.floor(Math.random()*100)+1}, ${pick(CITTA)}`,
          organizzazione: orgId,
        });
        const id = res.struttura?.id;
        if (id) { strIds.push(id); created++; log('🏥', `  ✓ Str #${id}: ${nome} (org #${orgId})`); }
      } catch (e) { log('❌', `  Str: ${e.message}`); created++; }
      await sleep(500);
    }
  } else {
    log('🏥', `Strutture OK (${strIds.length}/${TOT_STR})`);
  }

  // === FASE 3: Liste mancanti ===
  if (needListe > 0 && strIds.length > 0) {
    log('📋', `\nFASE 3: Creazione ${needListe} liste...`);
    let created = 0;
    while (created < needListe) {
      const strId = strIds[created % strIds.length];
      const cat = pick(CATEGORIE);
      try {
        const res = await postJSON('/api/v1/add-lista', {
          denominazione: `Lista ${cat.replace(/_/g,' ')} ${listaIds.length + 1}`,
          tag: cat, struttura: strId,
        });
        const id = res.lista?.id;
        if (id) { listaIds.push(id); created++; log('📋', `  ✓ Lista #${id}: ${cat} (str #${strId})`); }
      } catch (e) { log('❌', `  Lista: ${e.message}`); created++; }
      await sleep(500);
    }
  } else {
    log('📋', `Liste OK (${listaIds.length}/${TOT_LISTE})`);
  }

  // === FASE 4: Assistiti mancanti ===
  if (needAss > 0) {
    log('👤', `\nFASE 4: Creazione ${needAss} assistiti...`);
    const cfSet = new Set(existingAss.map(a => a.codiceFiscale));
    for (let a = 0; a < needAss; a++) {
      let cf; do { cf = randomCF(); } while (cfSet.has(cf)); cfSet.add(cf);
      const isMale = Math.random() > 0.5;
      const nome = pick(isMale ? NOMI_M : NOMI_F);
      const cognome = pick(COGNOMI);
      try {
        const res = await postJSON('/api/v1/add-assistito', {
          nome, cognome, codiceFiscale: cf,
          email: `${nome.toLowerCase()}.${cognome.toLowerCase()}${assIds.length}@test.it`,
        });
        const id = res.assistito?.id;
        if (id) { assIds.push(id); log('👤', `  ✓ #${id}: ${cognome} ${nome} anonId:${res.assistito?.anonId}`); }
      } catch (e) { log('❌', `  Ass: ${e.message}`); }
      if ((a+1) % 10 === 0) log('👤', `  ... ${a+1}/${needAss}`);
      await sleep(300);
    }
  } else {
    log('👤', `Assistiti OK (${assIds.length}/${NUM_ASS})`);
  }

  // === FASE 5: LOOP INFINITO - simulazione continua ===
  // Il sistema non si ferma mai:
  // - Ogni ciclo: crea nuovi assistiti, li inserisce in liste, chiama uscite
  // - Ogni 10 cicli: aggiunge nuove strutture/liste proporzionalmente
  // - Tasso crescita: ~70% ingressi, ~30% uscite → le code crescono sempre
  // - CTRL+C per fermare

  log('🔄', '\n═══ FASE 5: SIMULAZIONE CONTINUA (CTRL+C per fermare) ═══');
  log('🔄', 'Ogni ciclo: 3 nuovi assistiti, ingressi in liste, ~30% uscite');
  log('🔄', 'Ogni 10 cicli: nuova struttura + 2 liste\n');

  let ciclo = 0;
  let totIngressi = 0, totUscite = 0, totNuoviAss = 0, totNuoviStr = 0, totNuoveListe = 0;
  const cfSet = new Set(existingAss.map(a => a.codiceFiscale));
  const STATI_USCITA = [2, 3, 3, 5]; // 25% assistenza, 50% completato, 25% rinuncia

  while (true) {
    ciclo++;

    // --- Ogni 10 cicli: crescita infrastruttura ---
    if (ciclo % 10 === 0 && orgIds.length > 0) {
      const orgId = pick(orgIds);
      const strNome = `${pick(TIPI_STR)} ${pick(COGNOMI)} ${strIds.length + 1}`;
      try {
        const res = await postJSON('/api/v1/add-struttura', {
          denominazione: strNome,
          indirizzo: `Via ${pick(COGNOMI)} ${Math.floor(Math.random()*100)+1}, ${pick(CITTA)}`,
          organizzazione: orgId,
        });
        if (res.struttura?.id) {
          strIds.push(res.struttura.id);
          totNuoviStr++;
          log('🏥', `  NUOVA Str #${res.struttura.id}: ${strNome}`);

          // 2 liste per la nuova struttura
          for (let k = 0; k < 2; k++) {
            const cat = pick(CATEGORIE);
            try {
              const lRes = await postJSON('/api/v1/add-lista', {
                denominazione: `Lista ${cat.replace(/_/g,' ')} ${listaIds.length + 1}`,
                tag: cat, struttura: res.struttura.id,
              });
              if (lRes.lista?.id) { listaIds.push(lRes.lista.id); totNuoveListe++; }
            } catch(e) {}
            await sleep(300);
          }
        }
      } catch(e) { log('⚠️', `  Str: ${e.message.substring(0,40)}`); }
    }

    // --- Crea 3 nuovi assistiti ---
    for (let n = 0; n < 3; n++) {
      let cf; do { cf = randomCF(); } while (cfSet.has(cf)); cfSet.add(cf);
      const isMale = Math.random() > 0.5;
      const nome = pick(isMale ? NOMI_M : NOMI_F);
      const cognome = pick(COGNOMI);
      try {
        const res = await postJSON('/api/v1/add-assistito', {
          nome, cognome, codiceFiscale: cf,
          email: `${nome.toLowerCase()}.${cognome.toLowerCase()}${assIds.length}@test.it`,
        });
        if (res.assistito?.id) {
          assIds.push(res.assistito.id);
          totNuoviAss++;
          // Inserisci subito in 1-2 liste
          const numListe = Math.floor(Math.random() * 2) + 1;
          for (let l = 0; l < numListe; l++) {
            if (listaIds.length === 0) break;
            try {
              await postJSON('/api/v1/add-assistito-in-lista', { idAssistito: res.assistito.id, idLista: pick(listaIds) });
              totIngressi++;
            } catch(e) {}
            await sleep(100);
          }
        }
      } catch(e) {}
      await sleep(200);
    }

    // --- Inserisci assistiti esistenti random in liste ---
    const numExtraIngressi = Math.floor(Math.random() * 4) + 2; // 2-5 ingressi extra
    for (let i = 0; i < numExtraIngressi; i++) {
      if (assIds.length === 0 || listaIds.length === 0) break;
      try {
        await postJSON('/api/v1/add-assistito-in-lista', { idAssistito: pick(assIds), idLista: pick(listaIds) });
        totIngressi++;
      } catch(e) {}
      await sleep(100);
    }

    // --- Uscite: ~30% degli ingressi del ciclo ---
    const numUscite = Math.max(1, Math.floor((3 + numExtraIngressi) * 0.3));
    for (let u = 0; u < numUscite; u++) {
      if (listaIds.length === 0) break;
      const listaId = pick(listaIds);
      try {
        const det = await fetchJSON(`/api/v1/liste-dettaglio?idLista=${listaId}`);
        if (det.coda && det.coda.length > 0) {
          const primo = det.coda[0];
          await postJSON('/api/v1/rimuovi-assistito-da-lista', {
            idAssistitoListe: primo.id,
            stato: pick(STATI_USCITA),
          });
          totUscite++;
          const nome = primo.assistito ? `${primo.assistito.cognome} ${primo.assistito.nome}` : '?';
          log('⬅️', `  OUT ${nome} da Lista #${listaId}`);
        }
      } catch(e) {}
      await sleep(200);
    }

    // --- Riepilogo ---
    const tasso = totIngressi > 0 ? Math.round((1 - totUscite / totIngressi) * 100) : 0;
    log('📊', `Ciclo #${ciclo} | +${totNuoviAss} ass, ${totIngressi} IN, ${totUscite} OUT, netto +${totIngressi - totUscite} | ${orgIds.length} org, ${strIds.length} str, ${listaIds.length} liste, ${assIds.length} ass | crescita ${tasso}%`);

    await sleep(500);
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
