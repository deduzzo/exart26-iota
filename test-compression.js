/**
 * Test compressione gzip + chain-linking + rimozione publicKey.
 * Verifica che i payload vengano compressi, che le chain funzionino,
 * e che la ricostruzione sia perfetta.
 */
const http = require('http');
const BASE = 'http://localhost:1337';

function req(m, p, b = null) {
  return new Promise((res, rej) => {
    const u = new URL(p, BASE);
    const o = { hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: m, headers: { 'Content-Type': 'application/json' } };
    const r = http.request(o, s => { let d = ''; s.on('data', c => d += c); s.on('end', () => { try { res({ s: s.statusCode, d: JSON.parse(d) }); } catch (e) { res({ s: s.statusCode, d }); } }); });
    r.on('error', rej); if (b) r.write(JSON.stringify(b)); r.end();
  });
}
function reqC(m, p, b = null) {
  return new Promise((res, rej) => {
    const u1 = new URL('/csrfToken', BASE);
    http.request({ hostname: u1.hostname, port: u1.port, path: u1.pathname, method: 'GET' }, r1 => {
      let d1 = ''; r1.on('data', c => d1 += c); r1.on('end', () => {
        const csrf = JSON.parse(d1)._csrf;
        const ck = (r1.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
        const u2 = new URL(p, BASE);
        const r2 = http.request({ hostname: u2.hostname, port: u2.port, path: u2.pathname + u2.search, method: m,
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf, 'Cookie': ck } },
          s => { let d = ''; s.on('data', c => d += c); s.on('end', () => { try { res({ s: s.statusCode, d: JSON.parse(d) }); } catch (e) { res({ s: s.statusCode, d }); } }); });
        r2.on('error', rej); if (b) r2.write(JSON.stringify(b)); r2.end();
      });
    }).on('error', rej).end();
  });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function waitSync(max = 120000) {
  const s = Date.now();
  while (Date.now() - s < max) { const r = await req('GET', '/api/v1/sync-status'); if (r.d && !r.d.syncing) return; await sleep(2000); }
}

async function main() {
  console.log('=== TEST COMPRESSIONE + CHAIN-LINKING ===\n');

  // 0. Wallet
  const w = await req('GET', '/api/v1/wallet/get-info');
  if (!w.d || w.d.status !== 'WALLET OK') {
    console.log('[0] Init wallet...');
    await reqC('POST', '/api/v1/wallet/init');
    await sleep(8000);
  }
  console.log('[0] Wallet OK');

  // 1. Crea org + struttura
  console.log('\n[1] Crea org + struttura...');
  const org = await reqC('POST', '/api/v1/add-organizzazione', { denominazione: 'Org Compress Test' });
  const orgId = org.d?.organizzazione?.id;
  console.log(`    Org #${orgId}: ${org.d?.blockchain?.orgData ? 'OK' : 'FAIL'}`);

  const str = await reqC('POST', '/api/v1/add-struttura', {
    denominazione: 'Struttura Compress', organizzazione: orgId, indirizzo: 'Via Gzip 1'
  });
  const strId = str.d?.struttura?.id;
  console.log(`    Str #${strId}: ${str.d?.blockchain?.strData ? 'OK' : 'FAIL'}`);

  // 2. Crea MOLTE liste per testare payload grande
  console.log('\n[2] Crea 30 liste per simulare payload grande...');
  const listaIds = [];
  for (let i = 0; i < 30; i++) {
    const nomi = ['Fisioterapia','Logopedia','Neuroriab','Terapia Occ','Riab Motoria','Riab Resp'];
    const res = await reqC('POST', '/api/v1/add-lista', {
      denominazione: `${nomi[i % nomi.length]} ${i + 1}`, struttura: strId
    });
    const id = res.d?.lista?.id;
    listaIds.push(id);
    if (i % 10 === 9) console.log(`    ${i + 1}/30 liste create`);
  }
  console.log(`    ${listaIds.length} liste create`);

  // 3. Crea 5 assistiti e inseriscili in liste
  console.log('\n[3] Crea 5 assistiti e inserisci in liste...');
  const assIds = [];
  for (let i = 0; i < 5; i++) {
    const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const cf = Array.from({length:6}, (_,j) => L[(i*7+j)%26]).join('') + String(80+i).padStart(2,'0') + L[i%12] + String(1+i).padStart(2,'0') + L[(i+6)%26] + String(100+i).padStart(3,'0') + L[(i+7)%26];
    const ass = await reqC('POST', '/api/v1/add-assistito', {
      nome: ['Marco','Luca','Anna','Sara','Paolo'][i],
      cognome: ['Rossi','Bianchi','Verdi','Neri','Romano'][i],
      codiceFiscale: cf
    });
    assIds.push(ass.d?.assistito?.id);
  }
  console.log(`    ${assIds.length} assistiti creati`);

  // Inserisci ogni assistito in 3 liste diverse
  let insertOk = 0;
  for (let i = 0; i < assIds.length; i++) {
    for (let j = 0; j < 3; j++) {
      const lid = listaIds[(i * 3 + j) % listaIds.length];
      const res = await reqC('POST', '/api/v1/add-assistito-in-lista', { idAssistito: assIds[i], idLista: lid });
      if (res.d?.blockchain?.movimenti) insertOk++;
    }
  }
  console.log(`    ${insertOk}/15 inserimenti in lista OK`);

  // Rimuovi 5 assistiti
  let removeOk = 0;
  for (let i = 0; i < 5; i++) {
    const det = await req('GET', `/api/v1/liste-dettaglio?idLista=${listaIds[i]}`);
    const primo = det.d?.coda?.[0];
    if (primo) {
      const res = await reqC('POST', '/api/v1/rimuovi-assistito-da-lista', { idAssistitoListe: primo.id, stato: [2,3,5,2,3][i] });
      if (res.d?.blockchain?.movimenti) removeOk++;
    }
  }
  console.log(`    ${removeOk}/5 rimozioni OK`);

  // 4. Export snapshot
  console.log('\n[4] Export snapshot...');
  const exp = await req('GET', '/api/v1/export-data');
  const s = exp.d?.stats;
  console.log(`    org=${s.organizzazioni} str=${s.strutture} liste=${s.liste} ass=${s.assistiti} al=${s.assistitiListe}`);
  console.log(`    inCoda=${s.assistitiInCoda} usciti=${s.assistitiUsciti}`);

  // 5. Reset e ricostruzione
  console.log('\n[5] Reset DB e ricostruzione...');
  await reqC('POST', '/api/v1/sync-reset');
  await waitSync();
  console.log('    Sync completata');

  // 6. Verifica snapshot
  console.log('\n[6] Verifica snapshot post-ricostruzione...');
  const verify = await reqC('POST', '/api/v1/verify-snapshot', { snapshot: exp.d });

  console.log('\n========================================');
  if (verify.d?.identical) {
    console.log('  RICOSTRUZIONE PERFETTA!');
    console.log('  Compressione gzip + rimozione publicKey funzionano.');
  } else {
    console.log('  DIFFERENZE TROVATE:');
    console.log(`  ${verify.d?.summary}`);
    if (verify.d?.statsComparison?.diffs?.length > 0) {
      for (const d of verify.d.statsComparison.diffs) {
        console.log(`    ${d.campo}: ${d.originale} -> ${d.attuale}`);
      }
    }
    if (verify.d?.recordComparison?.diffs?.length > 0) {
      for (const d of verify.d.recordComparison.diffs.slice(0, 10)) {
        console.log(`    ${d.tabella}#${d.id} ${d.tipo} ${d.campo || ''}`);
      }
    }
  }
  console.log('========================================\n');
}

main().catch(e => { console.error('FATAL:', e.message || e); process.exit(1); });
