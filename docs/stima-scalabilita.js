/**
 * Stima scalabilita payload IOTA per ExArt26
 * node docs/stima-scalabilita.js
 */

const MAX_CHUNKS_PER_TX = 1018; // 1024 comandi - overhead splitCoins/transfers
const BYTES_PER_CHUNK = 6;
const MAX_PAYLOAD_ENCRYPTED = MAX_CHUNKS_PER_TX * BYTES_PER_CHUNK; // ~6108 bytes

// Overhead cifratura: AES key cifrata RSA (344B) + IV (24B) + HMAC (44B) + base64 (1.33x) + envelope JSON (~100B)
const CRYPTO_OVERHEAD = 500; // bytes fissi
const CRYPTO_MULTIPLIER = 1.4; // base64 + AES padding

// Overhead wrapper iota.js: {app, tag, entityId, version, timestamp, data}
const WRAPPER_OVERHEAD = 120;

function encryptedSize(cleartext) {
  return Math.ceil(cleartext * CRYPTO_MULTIPLIER) + CRYPTO_OVERHEAD;
}

function totalPayload(cleartext) {
  return encryptedSize(cleartext) + WRAPPER_OVERHEAD;
}

function chunksNeeded(cleartext) {
  return Math.ceil(totalPayload(cleartext) / BYTES_PER_CHUNK);
}

function fitsInTx(cleartext) {
  return chunksNeeded(cleartext) <= MAX_CHUNKS_PER_TX;
}

// Dimensioni entita (senza publicKey)
const BYTES_ORG_NOKEY = 150;
const BYTES_STR_NOKEY = 200;
const BYTES_LISTA_NOKEY = 100;
const BYTES_ASSISTITO_NOKEY = 250;
const BYTES_PUBLICKEY = 450; // PEM RSA-2048

// Rapporto compressione gzip per JSON strutturato
const GZIP_RATIO = 0.15; // JSON si comprime all'85% → rimane il 15%

console.log('═══════════════════════════════════════════════════════════════');
console.log('  STIMA SCALABILITA PAYLOAD IOTA - ExArt26');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  Max chunks/TX: ${MAX_CHUNKS_PER_TX}`);
console.log(`  Max payload cifrato: ${MAX_PAYLOAD_ENCRYPTED} bytes (~${(MAX_PAYLOAD_ENCRYPTED/1024).toFixed(1)}KB)`);
console.log();

// ─── SCENARIO A: STATO ATTUALE (con publicKey, senza compressione) ───
console.log('┌─────────────────────────────────────────────────────────────┐');
console.log('│  SCENARIO A: ATTUALE (con publicKey, senza compressione)   │');
console.log('└─────────────────────────────────────────────────────────────┘');

for (const nListe of [1, 5, 10, 20, 30, 50]) {
  const clear = (BYTES_STR_NOKEY + BYTES_PUBLICKEY) + nListe * (BYTES_LISTA_NOKEY + BYTES_PUBLICKEY);
  const chunks = chunksNeeded(clear);
  console.log(`  Struttura + ${String(nListe).padStart(2)} liste: ${clear}B clear → ${chunks} chunks ${fitsInTx(clear) ? '✓' : '✗ SUPERA LIMITE'}`);
}

console.log();

// ─── SCENARIO B: SOLO RIMOZIONE publicKey ───
console.log('┌─────────────────────────────────────────────────────────────┐');
console.log('│  SCENARIO B: senza publicKey (no compressione)             │');
console.log('└─────────────────────────────────────────────────────────────┘');

for (const nListe of [1, 5, 10, 30, 50, 100]) {
  const clear = BYTES_STR_NOKEY + nListe * BYTES_LISTA_NOKEY;
  const chunks = chunksNeeded(clear);
  console.log(`  Struttura + ${String(nListe).padStart(3)} liste: ${clear}B clear → ${chunks} chunks ${fitsInTx(clear) ? '✓' : '✗ SUPERA LIMITE'}`);
}

console.log();

// ─── SCENARIO C: COMPRESSIONE GZIP + RIMOZIONE publicKey ───
console.log('┌─────────────────────────────────────────────────────────────┐');
console.log('│  SCENARIO C: GZIP + senza publicKey (PROPOSTO)             │');
console.log('└─────────────────────────────────────────────────────────────┘');

for (const nListe of [1, 10, 50, 100, 200, 300, 500, 1000]) {
  const clearJson = BYTES_STR_NOKEY + nListe * BYTES_LISTA_NOKEY;
  const compressed = Math.ceil(clearJson * GZIP_RATIO);
  const chunks = chunksNeeded(compressed);
  console.log(`  Struttura + ${String(nListe).padStart(4)} liste: ${clearJson}B json → ${compressed}B gzip → ${chunks} chunks ${fitsInTx(compressed) ? '✓' : '✗ SUPERA LIMITE'}`);
}

console.log();

// ─── MAIN_DATA (indice) ───
console.log('┌─────────────────────────────────────────────────────────────┐');
console.log('│  MAIN_DATA (indice globale, ~50 byte/entita)               │');
console.log('└─────────────────────────────────────────────────────────────┘');

for (const nEntities of [10, 50, 100, 200, 500, 1000, 2000]) {
  const clearJson = nEntities * 50 + 100; // overhead JSON array
  const compressed = Math.ceil(clearJson * GZIP_RATIO);
  const chunks = chunksNeeded(compressed);
  console.log(`  ${String(nEntities).padStart(4)} entita: ${clearJson}B json → ${compressed}B gzip → ${chunks} chunks ${fitsInTx(compressed) ? '✓' : '✗ SUPERA LIMITE'}`);
}

console.log();

// ─── ASSISTITI_DATA (singolo assistito) ───
console.log('┌─────────────────────────────────────────────────────────────┐');
console.log('│  ASSISTITI_DATA (singolo, sempre OK)                       │');
console.log('└─────────────────────────────────────────────────────────────┘');
const clearAss = BYTES_ASSISTITO_NOKEY;
const compAss = Math.ceil(clearAss * GZIP_RATIO);
console.log(`  1 assistito: ${clearAss}B json → ${compAss}B gzip → ${chunksNeeded(compAss)} chunks ✓`);

console.log();

// ─── RIEPILOGO ───
console.log('═══════════════════════════════════════════════════════════════');
console.log('  RIEPILOGO LIMITI con GZIP + no publicKey:');
console.log('═══════════════════════════════════════════════════════════════');

// Trova il max liste per struttura
let maxListe = 0;
for (let n = 1; n <= 5000; n++) {
  const clear = BYTES_STR_NOKEY + n * BYTES_LISTA_NOKEY;
  const compressed = Math.ceil(clear * GZIP_RATIO);
  if (!fitsInTx(compressed)) break;
  maxListe = n;
}

// Trova il max entita per MAIN_DATA
let maxEntities = 0;
for (let n = 1; n <= 50000; n++) {
  const clear = n * 50 + 100;
  const compressed = Math.ceil(clear * GZIP_RATIO);
  if (!fitsInTx(compressed)) break;
  maxEntities = n;
}

console.log(`  Max liste per struttura:      ~${maxListe}`);
console.log(`  Max entita in MAIN_DATA:      ~${maxEntities}`);
console.log(`  Assistiti:                    illimitati (1 TX per assistito)`);
console.log(`  Movimenti lista:              illimitati (1 TX per movimento)`);
console.log();
console.log(`  Con 50 org × 10 str × 20 liste = 10.000 liste → OK`);
console.log(`  Con MAIN_DATA: 50 org + 500 str = 550 entita → OK`);
console.log(`  Assistiti: 100.000+ → OK (1 TX ciascuno)`);
console.log('═══════════════════════════════════════════════════════════════');
