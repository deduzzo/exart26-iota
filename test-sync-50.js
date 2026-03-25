/**
 * Test con 50+ transazioni miste: crea dati, inserisci/rimuovi da liste, reset, verifica ricostruzione.
 * Eseguire con: node test-sync-50.js
 */
const http = require('http');
const BASE = 'http://localhost:1337';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers: { 'Content-Type': 'application/json' } };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } catch (e) { resolve({ status: res.statusCode, data }); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function requestWithCsrf(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url1 = new URL('/csrfToken', BASE);
    http.request({ hostname: url1.hostname, port: url1.port, path: url1.pathname, method: 'GET' }, (resCsrf) => {
      let csrfData = '';
      resCsrf.on('data', chunk => csrfData += chunk);
      resCsrf.on('end', () => {
        try {
          const csrf = JSON.parse(csrfData)._csrf;
          const cookies = (resCsrf.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
          const url2 = new URL(path, BASE);
          const req2 = http.request({
            hostname: url2.hostname, port: url2.port, path: url2.pathname + url2.search, method,
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf, 'Cookie': cookies },
          }, (res2) => {
            let d = '';
            res2.on('data', chunk => d += chunk);
            res2.on('end', () => { try { resolve({ status: res2.statusCode, data: JSON.parse(d) }); } catch (e) { resolve({ status: res2.statusCode, data: d }); } });
          });
          req2.on('error', reject);
          if (body) req2.write(JSON.stringify(body));
          req2.end();
        } catch (e) { reject(e); }
      });
    }).on('error', reject).end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitForSync(maxWait = 180000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const res = await request('GET', '/api/v1/sync-status');
    if (res.data && !res.data.syncing) return res.data;
    await sleep(2000);
  }
  throw new Error('Sync timeout');
}

// Generatore codici fiscali finti ma validi nel formato
function fakeCF(i) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const l = (n) => letters[n % 26];
  return `${l(i)}${l(i+1)}${l(i+2)}${l(i+3)}${l(i+4)}${l(i+5)}` +
         `${String(80 + (i % 20)).padStart(2, '0')}` +
         `${l(i % 12)}` +
         `${String(1 + (i % 28)).padStart(2, '0')}` +
         `${l(i+6)}` +
         `${String(100 + (i % 900)).padStart(3, '0')}` +
         `${l(i+7)}`;
}

const nomi = ['Marco','Luca','Anna','Sara','Paolo','Elena','Giulia','Andrea','Chiara','Matteo','Sofia','Alessandro','Valentina','Lorenzo','Francesca','Davide','Martina','Simone','Elisa','Roberto'];
const cognomi = ['Rossi','Bianchi','Verdi','Neri','Romano','Colombo','Ricci','Marino','Greco','Bruno','Gallo','Conti','DeLuca','Costa','Giordano','Mancini','Rizzo','Lombardi','Moretti','Barbieri'];

async function main() {
  console.log('=== TEST 50+ TRANSAZIONI MISTE ===\n');
  const startTime = Date.now();

  // 0. Verifica server e wallet
  const dash0 = await request('GET', '/api/v1/dashboard');
  console.log('[0] Server OK. Wallet:', dash0.data?.walletInitialized);
  if (!dash0.data?.walletInitialized) {
    console.log('    Init wallet...');
    await requestWithCsrf('POST', '/api/v1/wallet/init');
    await sleep(8000);
  }

  // 1. Crea 3 organizzazioni
  console.log('\n[1] Creazione 3 organizzazioni...');
  const orgIds = [];
  for (let i = 0; i < 3; i++) {
    const res = await requestWithCsrf('POST', '/api/v1/add-organizzazione', { denominazione: `Org Test ${i+1}` });
    const id = res.data?.organizzazione?.id;
    orgIds.push(id);
    const bc = res.data?.blockchain;
    console.log(`    Org #${id}: orgData=${bc?.orgData} pk=${bc?.privateKey} main=${bc?.mainData}`);
    if (!bc?.orgData) console.log('    !! orgData FAILED');
    await sleep(2000); // Pausa tra TX per evitare conflitti
  }

  // 2. Crea 3 strutture (1 per org)
  console.log('\n[2] Creazione 3 strutture...');
  const strIds = [];
  for (let i = 0; i < 3; i++) {
    const res = await requestWithCsrf('POST', '/api/v1/add-struttura', {
      denominazione: `Struttura ${i+1}`, organizzazione: orgIds[i], indirizzo: `Via Test ${i+1}, Roma`
    });
    const id = res.data?.struttura?.id;
    strIds.push(id);
    const bc = res.data?.blockchain;
    console.log(`    Str #${id}: strData=${bc?.strData} pk=${bc?.privateKey}`);
    if (!bc?.strData) console.log('    !! strData FAILED');
    await sleep(2000);
  }

  // 3. Crea 5 liste (distribuite tra le strutture)
  console.log('\n[3] Creazione 5 liste...');
  const listaIds = [];
  const listaNames = ['Riab Neurologica', 'Fisioterapia', 'Logopedia', 'Terapia Occupaz', 'Riab Motoria'];
  for (let i = 0; i < 5; i++) {
    const res = await requestWithCsrf('POST', '/api/v1/add-lista', {
      denominazione: listaNames[i], struttura: strIds[i % 3]
    });
    const id = res.data?.lista?.id;
    listaIds.push(id);
    const bc = res.data?.blockchain;
    console.log(`    Lista #${id} "${listaNames[i]}": pk=${bc?.privateKey} str=${bc?.strData}`);
    await sleep(2000);
  }

  // 4. Crea 10 assistiti
  console.log('\n[4] Creazione 10 assistiti...');
  const assIds = [];
  for (let i = 0; i < 10; i++) {
    const nome = nomi[i % nomi.length];
    const cognome = cognomi[i % cognomi.length];
    const cf = fakeCF(i);
    const res = await requestWithCsrf('POST', '/api/v1/add-assistito', { nome, cognome, codiceFiscale: cf });
    const id = res.data?.assistito?.id;
    assIds.push(id);
    const bc = res.data?.blockchain;
    console.log(`    Ass #${id} ${cognome} ${nome}: assData=${bc?.assData} pk=${bc?.privateKey}`);
    if (!bc?.assData) console.log('    !! assData FAILED');
    await sleep(2000);
  }

  // 5. Aggiungi assistiti nelle liste (15 inserimenti)
  console.log('\n[5] Inserimento 15 assistiti in liste...');
  const assignments = [];
  let insertCount = 0;
  for (let i = 0; i < 10; i++) {
    // Ogni assistito va in 1-2 liste
    const lista1 = listaIds[i % listaIds.length];
    const res1 = await requestWithCsrf('POST', '/api/v1/add-assistito-in-lista', { idAssistito: assIds[i], idLista: lista1 });
    if (res1.data?.assistitoLista) {
      assignments.push({ alId: res1.data.assistitoLista.id, assId: assIds[i], listaId: lista1 });
      insertCount++;
    }
    console.log(`    Ass #${assIds[i]} -> Lista #${lista1}: ${res1.status === 200 ? 'OK' : 'FAIL'} (alId=${res1.data?.assistitoLista?.id || 'N/A'})`);
    await sleep(3000); // Pausa piu lunga per blockchain background

    // Secondo inserimento per i primi 5
    if (i < 5) {
      const lista2 = listaIds[(i + 2) % listaIds.length];
      const res2 = await requestWithCsrf('POST', '/api/v1/add-assistito-in-lista', { idAssistito: assIds[i], idLista: lista2 });
      if (res2.data?.assistitoLista) {
        assignments.push({ alId: res2.data.assistitoLista.id, assId: assIds[i], listaId: lista2 });
        insertCount++;
      }
      console.log(`    Ass #${assIds[i]} -> Lista #${lista2}: ${res2.status === 200 ? 'OK' : 'FAIL'} (alId=${res2.data?.assistitoLista?.id || 'N/A'})`);
      await sleep(3000);
    }
  }
  console.log(`    Totale inserimenti: ${insertCount}`);

  // 6. Rimuovi alcuni assistiti (8 rimozioni con stati diversi)
  console.log('\n[6] Rimozione 8 assistiti da liste...');
  const stati = [2, 3, 5, 2, 6, 2, 3, 5]; // in assistenza, completato, rinuncia, etc.
  let removeCount = 0;
  for (let i = 0; i < Math.min(8, assignments.length); i++) {
    const a = assignments[i];
    const stato = stati[i];
    const statiNomi = {2:'IN_ASSISTENZA',3:'COMPLETATO',5:'RINUNCIA',6:'ANNULLATO'};
    const res = await requestWithCsrf('POST', '/api/v1/rimuovi-assistito-da-lista', { idAssistitoListe: a.alId, stato });
    console.log(`    Rimuovi alId=#${a.alId} (Ass#${a.assId} Lista#${a.listaId}) stato=${statiNomi[stato]}: ${res.status === 200 ? 'OK' : 'FAIL'}`);
    if (res.status === 200) removeCount++;
    await sleep(3000);
  }
  console.log(`    Totale rimozioni: ${removeCount}`);

  // 7. Attendi che TUTTE le TX blockchain siano completate (zero pending)
  console.log('\n[7] Attendo completamento TX blockchain...');
  const txStart = Date.now();
  let lastPending = -1;
  while (Date.now() - txStart < 300000) { // max 5 minuti
    const pRes = await request('GET', '/api/v1/pending-tx');
    const pending = pRes.data?.pending || 0;
    if (pending !== lastPending) {
      console.log(`    TX pending: ${pending}`);
      lastPending = pending;
    }
    if (pending === 0) {
      // Aspetta ancora 5s per le conferme finali
      await sleep(5000);
      const pRes2 = await request('GET', '/api/v1/pending-tx');
      if ((pRes2.data?.pending || 0) === 0) break;
    }
    await sleep(3000);
  }
  console.log(`    Tutte le TX completate in ${((Date.now() - txStart) / 1000).toFixed(0)}s`);

  // 8. Export PRE-reset
  console.log('\n[8] Export snapshot PRE-reset...');
  const exportPre = await request('GET', '/api/v1/export-data');
  const sPre = exportPre.data?.stats;
  console.log(`    org=${sPre.organizzazioni} str=${sPre.strutture} liste=${sPre.liste} ass=${sPre.assistiti} al=${sPre.assistitiListe}`);
  console.log(`    inCoda=${sPre.assistitiInCoda} usciti=${sPre.assistitiUsciti}`);

  // 9. Reset e ricostruzione
  console.log('\n[9] === RESET DB E RICOSTRUZIONE ===');
  await requestWithCsrf('POST', '/api/v1/sync-reset');
  process.stdout.write('    Sync');
  await waitForSync();
  console.log(' completata');

  // 10. Export POST-reset
  console.log('\n[10] Export snapshot POST-ricostruzione...');
  const exportPost = await request('GET', '/api/v1/export-data');
  const sPost = exportPost.data?.stats;
  console.log(`     org=${sPost.organizzazioni} str=${sPost.strutture} liste=${sPost.liste} ass=${sPost.assistiti} al=${sPost.assistitiListe}`);
  console.log(`     inCoda=${sPost.assistitiInCoda} usciti=${sPost.assistitiUsciti}`);

  // 11. Confronto stats
  console.log('\n\n========================================');
  console.log('       CONFRONTO CONTEGGI');
  console.log('========================================');
  const keys = ['organizzazioni', 'strutture', 'liste', 'assistiti', 'assistitiListe', 'assistitiInCoda', 'assistitiUsciti'];
  let allMatch = true;
  for (const k of keys) {
    const pre = sPre[k];
    const post = sPost[k];
    const match = pre === post;
    if (!match) allMatch = false;
    console.log(`  ${k.padEnd(20)} PRE=${String(pre).padStart(3)}  POST=${String(post).padStart(3)}  ${match ? 'OK' : 'MISMATCH !!!'}`);
  }

  // 12. Confronto dati record per record
  console.log('\n========================================');
  console.log('       CONFRONTO DATI (record per record)');
  console.log('========================================');
  const dataPre = exportPre.data?.data || {};
  const dataPost = exportPost.data?.data || {};
  let dataMatch = true;

  for (const table of ['organizzazioni', 'strutture', 'liste', 'assistiti', 'assistitiListe']) {
    const pre = dataPre[table] || [];
    const post = dataPost[table] || [];
    if (pre.length !== post.length) {
      console.log(`  ${table}: LUNGHEZZA DIVERSA PRE=${pre.length} POST=${post.length}`);
      dataMatch = false;
      continue;
    }
    let tableDiffs = 0;
    for (let i = 0; i < pre.length; i++) {
      const preR = pre[i];
      const postR = post.find(r => r.id === preR.id);
      if (!postR) {
        console.log(`  ${table}: record #${preR.id} MANCANTE nel POST`);
        tableDiffs++;
        continue;
      }
      // Confronta campi chiave (escludi publicKey che e lungo, e updatedAt che puo variare leggermente)
      const fieldsToCompare = Object.keys(preR).filter(k => k !== 'publicKey' && k !== 'updatedAt');
      for (const f of fieldsToCompare) {
        if (JSON.stringify(preR[f]) !== JSON.stringify(postR[f])) {
          if (tableDiffs < 5) console.log(`  ${table}#${preR.id}.${f}: PRE=${JSON.stringify(preR[f]).substring(0,50)} POST=${JSON.stringify(postR[f]).substring(0,50)}`);
          tableDiffs++;
        }
      }
    }
    if (tableDiffs === 0) {
      console.log(`  ${table.padEnd(20)} ${pre.length} record  IDENTICI`);
    } else {
      console.log(`  ${table.padEnd(20)} ${tableDiffs} differenze trovate`);
      dataMatch = false;
    }
  }

  console.log('\n========================================');
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  if (allMatch && dataMatch) {
    console.log(`  RICOSTRUZIONE PERFETTA! (${elapsed}s)`);
    console.log('  Tutti i conteggi e i dati record per record sono identici.');
  } else if (allMatch && !dataMatch) {
    console.log(`  CONTEGGI OK, DIFFERENZE NEI DATI (${elapsed}s)`);
  } else {
    console.log(`  DIFFERENZE TROVATE (${elapsed}s)`);
  }
  console.log('========================================\n');

  // 13. Verifica dettaglio liste
  console.log('[13] Verifica dettaglio liste:');
  for (const lid of listaIds) {
    const det = await request('GET', `/api/v1/liste-dettaglio?idLista=${lid}`);
    if (det.status === 200 && det.data?.lista) {
      const l = det.data;
      const inCoda = l.coda?.length || 0;
      const storico = l.storico?.length || 0;
      console.log(`     Lista #${lid} "${l.lista.denominazione}": inCoda=${inCoda} storico=${storico}`);
    } else {
      console.log(`     Lista #${lid}: NOT FOUND`);
    }
  }

  console.log('\n=== TEST COMPLETATO ===');
}

main().catch(e => { console.error('FATAL:', e.message || e); process.exit(1); });
