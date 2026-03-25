/**
 * Test completo: crea dati, verifica blockchain, reset DB, verifica ricostruzione.
 * Eseguire con: node test-sync.js
 */
const http = require('http');

const BASE = 'http://localhost:1337';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function getCsrf() {
  const res = await request('GET', '/csrfToken');
  return res.data._csrf;
}

function requestWithCsrf(method, path, body = null) {
  return new Promise(async (resolve, reject) => {
    // First get CSRF cookie + token
    const url1 = new URL('/csrfToken', BASE);
    const reqCsrf = http.request({
      hostname: url1.hostname, port: url1.port, path: url1.pathname, method: 'GET',
    }, (resCsrf) => {
      let csrfData = '';
      resCsrf.on('data', chunk => csrfData += chunk);
      resCsrf.on('end', () => {
        try {
          const csrf = JSON.parse(csrfData)._csrf;
          const cookies = (resCsrf.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');

          const url2 = new URL(path, BASE);
          const opts = {
            hostname: url2.hostname, port: url2.port,
            path: url2.pathname + url2.search,
            method,
            headers: {
              'Content-Type': 'application/json',
              'x-csrf-token': csrf,
              'Cookie': cookies,
            },
          };
          const req2 = http.request(opts, (res2) => {
            let d = '';
            res2.on('data', chunk => d += chunk);
            res2.on('end', () => {
              try { resolve({ status: res2.statusCode, data: JSON.parse(d) }); }
              catch (e) { resolve({ status: res2.statusCode, data: d }); }
            });
          });
          req2.on('error', reject);
          if (body) req2.write(JSON.stringify(body));
          req2.end();
        } catch (e) { reject(e); }
      });
    });
    reqCsrf.on('error', reject);
    reqCsrf.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitForSync(maxWait = 120000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const res = await request('GET', '/api/v1/sync-status');
    if (res.data && !res.data.syncing) return res.data;
    process.stdout.write('.');
    await sleep(2000);
  }
  throw new Error('Sync timeout');
}

async function main() {
  console.log('=== TEST SYNC COMPLETO ===\n');

  // 0. Verifica server
  try {
    const dash = await request('GET', '/api/v1/dashboard');
    console.log('[0] Server OK, stats:', JSON.stringify(dash.data?.stats));
    console.log('    Wallet:', dash.data?.walletInitialized);
  } catch (e) {
    console.error('Server non raggiungibile su localhost:1337');
    process.exit(1);
  }

  // 1. Init wallet se necessario
  const walletInfo = await request('GET', '/api/v1/wallet/get-info');
  if (!walletInfo.data || walletInfo.data.status !== 'WALLET OK') {
    console.log('\n[1] Inizializzazione wallet...');
    const initRes = await requestWithCsrf('POST', '/api/v1/wallet/init');
    console.log('    Init:', initRes.status, initRes.data?.success ? 'OK' : 'FAILED', 'addr:', initRes.data?.address?.substring(0, 20) + '...');
    if (!initRes.data?.success) { console.error('ERRORE wallet init'); process.exit(1); }
    console.log('    Attendo faucet (10s)...');
    await sleep(10000);
  } else {
    console.log('\n[1] Wallet gia inizializzato:', walletInfo.data.address?.substring(0, 20) + '...');
  }

  // 2. Dashboard iniziale (dovrebbe essere tutto 0)
  const dash1 = await request('GET', '/api/v1/dashboard');
  console.log('\n[2] Dashboard iniziale:', JSON.stringify(dash1.data?.stats));

  // 3. Crea organizzazione
  console.log('\n[3] Crea organizzazione TEST...');
  const orgRes = await requestWithCsrf('POST', '/api/v1/add-organizzazione', {
    denominazione: 'Org Test Sync ' + Date.now()
  });
  console.log('    Org:', orgRes.status, JSON.stringify(orgRes.data).substring(0, 200));
  const orgId = orgRes.data?.organizzazione?.id || orgRes.data?.id;
  if (!orgId) { console.error('ERRORE: organizzazione non creata'); process.exit(1); }
  console.log('    orgId:', orgId);
  console.log('    blockchain:', JSON.stringify(orgRes.data?.blockchain));
  await sleep(10000); // Attendi blockchain

  // 4. Crea struttura
  console.log('\n[4] Crea struttura...');
  const strRes = await requestWithCsrf('POST', '/api/v1/add-struttura', {
    denominazione: 'Struttura Test Sync',
    organizzazione: orgId,
    indirizzo: 'Via Test 1, Roma',
  });
  console.log('    Str:', strRes.status, JSON.stringify(strRes.data).substring(0, 200));
  const strId = strRes.data?.struttura?.id || strRes.data?.id;
  if (!strId) { console.error('ERRORE: struttura non creata'); process.exit(1); }
  console.log('    strId:', strId);
  console.log('    blockchain:', JSON.stringify(strRes.data?.blockchain));
  await sleep(10000);

  // 5. Crea lista
  console.log('\n[5] Crea lista...');
  const listaRes = await requestWithCsrf('POST', '/api/v1/add-lista', {
    denominazione: 'Lista Test Riab',
    struttura: strId,
  });
  console.log('    Lista:', listaRes.status, JSON.stringify(listaRes.data).substring(0, 200));
  const listaId = listaRes.data?.lista?.id || listaRes.data?.id;
  if (!listaId) { console.error('ERRORE: lista non creata'); process.exit(1); }
  console.log('    listaId:', listaId);
  console.log('    blockchain:', JSON.stringify(listaRes.data?.blockchain));
  await sleep(10000);

  // 6. Crea assistito
  console.log('\n[6] Crea assistito...');
  const assRes = await requestWithCsrf('POST', '/api/v1/add-assistito', {
    nome: 'Mario',
    cognome: 'Rossi',
    codiceFiscale: 'RSSMRA80A01H501Z',
  });
  console.log('    Ass:', assRes.status, JSON.stringify(assRes.data).substring(0, 200));
  const assId = assRes.data?.assistito?.id || assRes.data?.id;
  if (!assId) { console.error('ERRORE: assistito non creato'); process.exit(1); }
  console.log('    assId:', assId);
  console.log('    blockchain:', JSON.stringify(assRes.data?.blockchain));
  await sleep(12000); // Attendi blockchain (assistito pubblica ASSISTITI_DATA + PRIVATE_KEY)

  // 7. Aggiungi assistito in lista
  console.log('\n[7] Aggiungi assistito in lista...');
  const addRes = await requestWithCsrf('POST', '/api/v1/add-assistito-in-lista', {
    idAssistito: assId,
    idLista: listaId,
  });
  console.log('    Add:', addRes.status, JSON.stringify(addRes.data).substring(0, 200));
  const alId = addRes.data?.assistitoLista?.id;
  if (!alId) { console.error('ERRORE: assistito non aggiunto in lista'); process.exit(1); }
  console.log('    assistitoListaId:', alId);
  console.log('    Attendo pubblicazione blockchain (15s)...');
  await sleep(15000);

  // 8. Verifica lista dettaglio
  console.log('\n[8] Verifica lista dettaglio...');
  const listaDettaglio = await request('GET', `/api/v1/liste-dettaglio?idLista=${listaId}`);
  console.log('    Dettaglio:', JSON.stringify(listaDettaglio.data).substring(0, 300));

  // 9. Rimuovi assistito dalla lista (stato 2 = in assistenza)
  console.log('\n[9] Rimuovi assistito dalla lista (IN ASSISTENZA)...');
  const rimRes = await requestWithCsrf('POST', '/api/v1/rimuovi-assistito-da-lista', {
    idAssistitoListe: alId,
    stato: 2,
  });
  console.log('    Rimuovi:', rimRes.status, JSON.stringify(rimRes.data).substring(0, 200));
  console.log('    Attendo pubblicazione blockchain (15s)...');
  await sleep(15000);

  // 10. Dashboard pre-reset
  const dash2 = await request('GET', '/api/v1/dashboard');
  console.log('\n[10] Dashboard PRE-reset:', JSON.stringify(dash2.data));

  // 11. RESET DB e ricostruzione
  console.log('\n[11] === RESET DB E RICOSTRUZIONE ===');
  const resetRes2 = await requestWithCsrf('POST', '/api/v1/sync-reset');
  console.log('     Reset:', resetRes2.status);
  console.log('     Attendo sync da blockchain...');
  await waitForSync();
  console.log(' sync completata');

  // 12. Verifica ricostruzione
  const dash3 = await request('GET', '/api/v1/dashboard');
  console.log('\n[12] Dashboard POST-ricostruzione:', JSON.stringify(dash3.data));

  // 13. Verifica dettaglio lista ricostruita
  const listaPost = await request('GET', `/api/v1/liste-dettaglio?idLista=${listaId}`);
  console.log('\n[13] Lista ricostruita:', JSON.stringify(listaPost.data).substring(0, 500));

  // 14. Verifica assistiti
  const assPost = await request('GET', `/api/v1/assistiti/${assId}`);
  console.log('\n[14] Assistito ricostruito:', JSON.stringify(assPost.data).substring(0, 300));

  // 15. Sommario
  console.log('\n\n=== RIEPILOGO ===');
  const s2 = dash2.data?.stats || {};
  const s3 = dash3.data?.stats || {};
  console.log(`PRE-reset:  org=${s2.organizzazioni} str=${s2.strutture} liste=${s2.liste} ass=${s2.assistiti} inCoda=${s2.assistitiInCoda} usciti=${s2.assistitiUsciti}`);
  console.log(`POST-reset: org=${s3.organizzazioni} str=${s3.strutture} liste=${s3.liste} ass=${s3.assistiti} inCoda=${s3.assistitiInCoda} usciti=${s3.assistitiUsciti}`);

  const keys = ['organizzazioni', 'strutture', 'liste', 'assistiti', 'assistitiInCoda', 'assistitiUsciti'];
  const diffs = keys.filter(k => s2[k] !== s3[k]);
  if (diffs.length === 0) {
    console.log('\nRICOSTRUZIONE: SUCCESSO ✓ (tutti i conteggi corrispondono)');
  } else {
    console.log('\nRICOSTRUZIONE: DIFFERENZE ✗');
    for (const k of diffs) {
      console.log(`  ${k}: PRE=${s2[k]} POST=${s3[k]}`);
    }
  }

  console.log('\n=== TEST COMPLETATO ===');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
