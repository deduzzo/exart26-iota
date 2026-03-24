const crypto = require('crypto');
const CryptHelper = require('../utility/CryptHelper');
const ListManager = require('../utility/ListManager');
const SyncCache = require('../utility/SyncCache');
const {INSERITO_IN_CODA} = require('../enums/StatoLista');

function generateAnonId(cf) {
  return crypto.createHash('sha256').update(cf.toUpperCase().trim()).digest('hex').substring(0, 8).toUpperCase();
}

const NOMI_M = ['Marco','Luca','Alessandro','Andrea','Matteo','Lorenzo','Giuseppe','Francesco','Antonio','Giovanni','Roberto','Davide','Stefano','Paolo','Massimo','Simone','Fabio','Michele','Claudio','Riccardo','Salvatore','Alberto','Daniele','Vincenzo','Enrico','Nicola','Emanuele','Filippo','Giorgio','Tommaso'];
const NOMI_F = ['Maria','Anna','Francesca','Laura','Valentina','Chiara','Sara','Giulia','Silvia','Paola','Elena','Alessandra','Roberta','Monica','Federica','Elisa','Simona','Daniela','Cristina','Marta','Barbara','Claudia','Ilaria','Serena','Lucia','Giorgia','Teresa','Patrizia','Rosa','Angela'];
const COGNOMI = ['Rossi','Russo','Ferrari','Esposito','Bianchi','Romano','Colombo','Ricci','Marino','Greco','Bruno','Gallo','Conti','De Luca','Mancini','Costa','Giordano','Rizzo','Lombardi','Moretti','Barbieri','Fontana','Santoro','Mariani','Rinaldi','Caruso','Ferrara','Galli','Martini','Leone','Longo','Gentile','Martinelli','Vitale','Lombardo','Serra','Coppola','De Santis','DAmico','Marchetti'];
const CATEGORIE = ['riabilitazione_motoria','fisioterapia','logopedia','terapia_occupazionale','neuroriabilitazione','riabilitazione_respiratoria','riabilitazione_cardiologica','psicomotricita','idroterapia','riabilitazione_pediatrica'];
const CITTA = ['Roma','Milano','Napoli','Torino','Firenze','Bologna','Palermo','Bari','Catania','Genova'];
const TIPI_STR = ['Centro Riabilitazione','Istituto Riabilitativo','Clinica','Presidio Ospedaliero','Casa di Cura','Ambulatorio','Centro Diurno','RSA','IRCCS','Comunita Terapeutica'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
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
function rndDate(y1, y2) {
  const s = new Date(y1, 0, 1).getTime(), e = new Date(y2, 11, 31).getTime();
  return new Date(s + Math.random() * (e - s)).getTime();
}

module.exports = {
  friendlyName: 'Inizializza dati di prova',
  description: 'Crea dati massivi per test UI. Solo DB in-memory + MAIN_DATA su blockchain.',
  inputs: {},
  exits: { success: {} },

  fn: async function (inputs, exits) {
    const T0 = Date.now();
    const S = { org: 0, str: 0, liste: 0, ass: 0, mov: 0 };
    const NUM_ORG = 10, STR_PER_ORG = 50, LISTE_PER_STR = 10, NUM_ASS = 10000;

    sails.log.info(`[load] Start: ${NUM_ORG} org, ${STR_PER_ORG} str/org, ${LISTE_PER_STR} lst/str, ${NUM_ASS} ass`);

    // Svuota DB esistente prima di generare nuovi dati
    await AssistitiListe.destroy({});
    await Assistito.destroy({});
    await Lista.destroy({});
    await Struttura.destroy({});
    await Organizzazione.destroy({});
    sails.log.info('[load] DB svuotato');

    // --- Genera UNA coppia di chiavi RSA e riusala (la generazione e lenta) ---
    sails.log.info('[load] Generazione chiave RSA condivisa per test...');
    const sharedKP = await CryptHelper.RSAGenerateKeyPair();

    // 1. Organizzazioni (save only IDs)
    const orgIds = [];
    for (let i = 0; i < NUM_ORG; i++) {
      const org = await Organizzazione.create({
        denominazione: `ASL ${pick(CITTA)} ${i + 1}`,
        publicKey: sharedKP.publicKey, privateKey: sharedKP.privateKey,
        ultimaVersioneSuBlockchain: 0,
      }).fetch();
      orgIds.push(org.id);
      S.org++;
    }
    sails.log.info(`[load] ${S.org} organizzazioni (${Math.round((Date.now()-T0)/1000)}s)`);

    // 2. Strutture (save only {id, organizzazione})
    const strRefs = [];
    for (const orgId of orgIds) {
      for (let j = 0; j < STR_PER_ORG; j++) {
        const str = await Struttura.create({
          denominazione: `${pick(TIPI_STR)} ${pick(COGNOMI)} ${j+1}`,
          indirizzo: `Via ${pick(COGNOMI)} ${Math.floor(Math.random()*200)+1}, ${pick(CITTA)}`,
          attiva: Math.random() > 0.05,
          publicKey: sharedKP.publicKey, privateKey: sharedKP.privateKey,
          ultimaVersioneSuBlockchain: 0,
          organizzazione: orgId,
        }).fetch();
        strRefs.push({ id: str.id, organizzazione: orgId });
        S.str++;
      }
      if (S.str % 100 === 0) sails.log.info(`[load] Strutture: ${S.str} (${Math.round((Date.now()-T0)/1000)}s)`);
    }

    // 3. Liste (save only IDs)
    const lstIds = [];
    for (const strRef of strRefs) {
      for (let k = 0; k < LISTE_PER_STR; k++) {
        const cat = pick(CATEGORIE);
        const lst = await Lista.create({
          denominazione: `${cat.replace(/_/g,' ')} ${k+1}`,
          tag: cat, aperta: Math.random() > 0.1,
          publicKey: sharedKP.publicKey, privateKey: sharedKP.privateKey,
          struttura: strRef.id, ultimaVersioneSuBlockchain: 0,
        }).fetch();
        lstIds.push(lst.id);
        S.liste++;
      }
      if (S.liste % 1000 === 0) sails.log.info(`[load] Liste: ${S.liste} (${Math.round((Date.now()-T0)/1000)}s)`);
    }

    sails.log.info(`[load] Base: ${S.org} org, ${S.str} str, ${S.liste} liste in ${Math.round((Date.now()-T0)/1000)}s`);
    sails.log.info(`[load] Creazione ${NUM_ASS} assistiti + movimenti...`);

    // 4. Assistiti + movimenti (processed in batches for memory efficiency)
    const cfSet = new Set();
    const STATI_USCITA = [2, 3, 5, 6];
    const BATCH = 500;

    for (let batch = 0; batch < NUM_ASS; batch += BATCH) {
      const batchEnd = Math.min(batch + BATCH, NUM_ASS);
      for (let a = batch; a < batchEnd; a++) {
        let cf; do { cf = randomCF(); } while (cfSet.has(cf)); cfSet.add(cf);
        const isMale = Math.random() > 0.5;

        const ass = await Assistito.create({
          anonId: generateAnonId(cf),
          nome: pick(isMale ? NOMI_M : NOMI_F),
          cognome: pick(COGNOMI),
          codiceFiscale: cf,
          email: Math.random() > 0.3 ? `user${a}@test.it` : '',
          telefono: Math.random() > 0.4 ? `+39 3${Math.floor(Math.random()*900000000+100000000)}` : '',
          publicKey: sharedKP.publicKey, privateKey: sharedKP.privateKey,
          ultimaVersioneSuBlockchain: 0,
        }).fetch();
        S.ass++;

        // 1-3 inserimenti in liste random
        const numMov = Math.floor(Math.random() * 3) + 1;
        for (let m = 0; m < numMov; m++) {
          const lstId = pick(lstIds);
          const ingresso = rndDate(2024, 2026);
          const al = await AssistitiListe.create({
            assistito: ass.id, lista: lstId,
            stato: INSERITO_IN_CODA, dataOraIngresso: ingresso, chiuso: false,
          }).fetch();
          S.mov++;

          // 60% esce
          if (Math.random() > 0.4) {
            await AssistitiListe.updateOne({id: al.id}).set({
              stato: pick(STATI_USCITA), chiuso: true,
              dataOraUscita: ingresso + Math.floor(Math.random() * 180 * 86400000),
            });
          }
        }

        if ((a+1) % 2000 === 0) sails.log.info(`[load] Assistiti: ${S.ass} mov: ${S.mov} (${Math.round((Date.now()-T0)/1000)}s)`);
      }
      // Force GC hint between batches
      if (global.gc) global.gc();
    }

    const elapsed = Math.round((Date.now()-T0)/1000);
    sails.log.info(`[load] COMPLETATO in ${elapsed}s: ${JSON.stringify(S)}`);

    // 5. MAIN_DATA su blockchain
    sails.log.info('[load] Pubblicazione MAIN_DATA...');
    try {
      const manager = new ListManager();
      const res = await manager.updateOrganizzazioniStruttureListeToBlockchain();
      sails.log.info(`[load] MAIN_DATA: ${res.success ? 'OK' : 'FAILED'}`);
    } catch (e) {
      sails.log.warn(`[load] MAIN_DATA: ${e.message}`);
    }

    ['Organizzazione', 'Struttura', 'Lista', 'Assistito', 'AssistitiListe']
      .forEach(m => SyncCache.markDirty(m));

    return exits.success({ stats: S, elapsed: elapsed + 's' });
  }
};
