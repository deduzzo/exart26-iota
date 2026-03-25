/**
 * Test verifica snapshot: crea dati, esporta, reset DB, ricostruisci, verifica con snapshot originale.
 */
const http = require('http');
const fs = require('fs');
const BASE = 'http://localhost:1337';

function req(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers: { 'Content-Type': 'application/json' } };
    const r = http.request(opts, (res) => {
      let data = ''; res.on('data', c => data += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } catch (e) { resolve({ status: res.statusCode, data }); } });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

function reqCsrf(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url1 = new URL('/csrfToken', BASE);
    http.request({ hostname: url1.hostname, port: url1.port, path: url1.pathname, method: 'GET' }, (res1) => {
      let d1 = ''; res1.on('data', c => d1 += c);
      res1.on('end', () => {
        try {
          const csrf = JSON.parse(d1)._csrf;
          const cookies = (res1.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
          const url2 = new URL(path, BASE);
          const r2 = http.request({
            hostname: url2.hostname, port: url2.port, path: url2.pathname + url2.search, method,
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf, 'Cookie': cookies },
          }, (res2) => {
            let d2 = ''; res2.on('data', c => d2 += c);
            res2.on('end', () => { try { resolve({ status: res2.statusCode, data: JSON.parse(d2) }); } catch (e) { resolve({ status: res2.statusCode, data: d2 }); } });
          });
          r2.on('error', reject);
          if (body) r2.write(JSON.stringify(body));
          r2.end();
        } catch (e) { reject(e); }
      });
    }).on('error', reject).end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitSync(max = 120000) {
  const s = Date.now();
  while (Date.now() - s < max) {
    const r = await req('GET', '/api/v1/sync-status');
    if (r.data && !r.data.syncing) return;
    await sleep(2000);
  }
  throw new Error('Sync timeout');
}

async function main() {
  console.log('=== TEST VERIFICA SNAPSHOT ===\n');

  // 0. Wallet init
  const w = await req('GET', '/api/v1/wallet/get-info');
  if (!w.data || w.data.status !== 'WALLET OK') {
    console.log('[0] Init wallet...');
    await reqCsrf('POST', '/api/v1/wallet/init');
    await sleep(8000);
  }
  console.log('[0] Wallet OK');

  // 1. Crea dati di test
  console.log('\n[1] Creazione dati...');
  const org = await reqCsrf('POST', '/api/v1/add-organizzazione', { denominazione: 'Test Org Snapshot' });
  console.log('    Org:', org.data?.blockchain?.orgData ? 'OK' : 'FAIL');

  const str = await reqCsrf('POST', '/api/v1/add-struttura', {
    denominazione: 'Struttura Snapshot', organizzazione: org.data?.organizzazione?.id, indirizzo: 'Via Test 1'
  });
  console.log('    Str:', str.data?.blockchain?.strData ? 'OK' : 'FAIL');

  const lista = await reqCsrf('POST', '/api/v1/add-lista', {
    denominazione: 'Lista Snapshot', struttura: str.data?.struttura?.id
  });
  console.log('    Lista:', lista.data?.blockchain?.strData ? 'OK' : 'FAIL');

  // 3 assistiti
  const assIds = [];
  for (let i = 0; i < 3; i++) {
    const cf = 'ABCDEF' + String(80 + i).padStart(2, '0') + 'A' + String(1 + i).padStart(2, '0') + 'H' + String(100 + i) + 'Z';
    const ass = await reqCsrf('POST', '/api/v1/add-assistito', {
      nome: ['Mario', 'Luca', 'Anna'][i], cognome: ['Rossi', 'Bianchi', 'Verdi'][i], codiceFiscale: cf
    });
    assIds.push(ass.data?.assistito?.id);
    console.log(`    Ass #${ass.data?.assistito?.id}: ${ass.data?.blockchain?.assData ? 'OK' : 'FAIL'}`);
  }

  // Inserisci tutti in lista
  const listaId = lista.data?.lista?.id;
  for (const id of assIds) {
    const r = await reqCsrf('POST', '/api/v1/add-assistito-in-lista', { idAssistito: id, idLista: listaId });
    console.log(`    Ass #${id} -> Lista #${listaId}: ${r.data?.blockchain?.movimenti ? 'OK' : 'FAIL'}`);
  }

  // Rimuovi il primo (in assistenza)
  const dettaglio = await req('GET', `/api/v1/liste-dettaglio?idLista=${listaId}`);
  const primo = dettaglio.data?.coda?.[0];
  if (primo) {
    const rim = await reqCsrf('POST', '/api/v1/rimuovi-assistito-da-lista', {
      idAssistitoListe: primo.id, stato: 2
    });
    console.log(`    Rimuovi #${primo.id}: ${rim.data?.blockchain?.movimenti ? 'OK' : 'FAIL'}`);
  }

  // 2. Export snapshot
  console.log('\n[2] Export snapshot...');
  const exportRes = await req('GET', '/api/v1/export-data');
  const snapshot = exportRes.data;
  fs.writeFileSync('/tmp/exart26-snapshot-test.json', JSON.stringify(snapshot, null, 2));
  console.log(`    Stats: org=${snapshot.stats.organizzazioni} str=${snapshot.stats.strutture} liste=${snapshot.stats.liste} ass=${snapshot.stats.assistiti} al=${snapshot.stats.assistitiListe}`);
  console.log(`    inCoda=${snapshot.stats.assistitiInCoda} usciti=${snapshot.stats.assistitiUsciti}`);

  // 3. Verifica snapshot PRIMA del reset (deve essere identico)
  console.log('\n[3] Verifica pre-reset (deve essere identico)...');
  const verify1 = await reqCsrf('POST', '/api/v1/verify-snapshot', { snapshot });
  console.log(`    Risultato: ${verify1.data?.identical ? 'IDENTICO' : 'DIFFERENZE'}`);
  console.log(`    ${verify1.data?.summary}`);

  // 4. Reset DB e ricostruzione
  console.log('\n[4] Reset DB e ricostruzione...');
  await reqCsrf('POST', '/api/v1/sync-reset');
  process.stdout.write('    Sync');
  await waitSync();
  console.log(' completata');

  // 5. Verifica snapshot DOPO ricostruzione (deve essere identico)
  console.log('\n[5] Verifica post-ricostruzione...');
  const verify2 = await reqCsrf('POST', '/api/v1/verify-snapshot', { snapshot });
  console.log(`    Risultato: ${verify2.data?.identical ? 'IDENTICO' : 'DIFFERENZE'}`);
  console.log(`    ${verify2.data?.summary}`);

  if (verify2.data?.statsComparison?.diffs?.length > 0) {
    console.log('    Conteggi:');
    for (const d of verify2.data.statsComparison.diffs) {
      console.log(`      ${d.campo}: originale=${d.originale} attuale=${d.attuale}`);
    }
  }
  if (verify2.data?.recordComparison?.diffs?.length > 0) {
    console.log(`    Record (${verify2.data.recordComparison.totalDiffs} diff):`);
    for (const d of verify2.data.recordComparison.diffs.slice(0, 10)) {
      console.log(`      ${d.tabella}#${d.id} ${d.tipo}${d.campo ? ' .'+d.campo : ''}`);
    }
  }

  // 6. Riepilogo
  console.log('\n========================================');
  if (verify2.data?.identical) {
    console.log('  SNAPSHOT VERIFICATO: RICOSTRUZIONE PERFETTA');
  } else {
    console.log('  SNAPSHOT VERIFICATO: DIFFERENZE TROVATE');
  }
  console.log('========================================\n');
}

main().catch(e => { console.error('FATAL:', e.message || e); process.exit(1); });
