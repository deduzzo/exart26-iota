import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useOutletContext } from 'react-router-dom';
import { Play, Square, Zap, Building2, Hospital, FileText, Users, UserPlus, UserMinus, CheckCircle, AlertTriangle } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { addOrganizzazione, addStruttura, addLista, addAssistito, addAssistitoInLista, rimuoviAssistitoDaLista, getStrutture, getAssistiti } from '../api/endpoints';

const NOMI_M = ['Marco','Luca','Alessandro','Andrea','Matteo','Lorenzo','Giuseppe','Francesco','Antonio','Giovanni','Roberto','Davide','Stefano','Paolo','Massimo'];
const NOMI_F = ['Maria','Anna','Francesca','Laura','Valentina','Chiara','Sara','Giulia','Silvia','Paola','Elena','Alessandra','Roberta','Monica','Federica'];
const COGNOMI = ['Rossi','Russo','Ferrari','Esposito','Bianchi','Romano','Colombo','Ricci','Marino','Greco','Bruno','Gallo','Conti','De Luca','Mancini','Costa','Giordano'];
const CITTA = ['Roma','Milano','Napoli','Torino','Firenze','Bologna','Palermo','Bari'];
const TIPI_STR = ['Centro Riabilitazione','Clinica','Ambulatorio','Casa di Cura','RSA'];
const TAGS = ['riabilitazione_motoria','fisioterapia','logopedia','neuroriabilitazione','terapia_occupazionale'];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomCF = () => {
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
};

export default function LoadTest() {
  const { addToast } = useOutletContext();
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]);
  const [stats, setStats] = useState({ org: 0, str: 0, liste: 0, ass: 0, inLista: 0, usciti: 0, errors: 0 });
  const stopRef = useRef(false);
  const logEndRef = useRef(null);

  const addLog = useCallback((msg, type = 'info') => {
    const ts = new Date().toLocaleTimeString('it-IT');
    setLog(prev => [...prev.slice(-200), { ts, msg, type }]);
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  const incStat = useCallback((key) => {
    setStats(prev => ({ ...prev, [key]: prev[key] + 1 }));
  }, []);

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const runTest = async () => {
    stopRef.current = false;
    setRunning(true);
    setLog([]);
    setStats({ org: 0, str: 0, liste: 0, ass: 0, inLista: 0, usciti: 0, errors: 0 });

    const createdOrgs = [];
    const createdStr = [];
    const createdListe = [];
    const createdAss = [];

    try {
      // FASE 1: Organizzazioni
      addLog('=== FASE 1: Creazione Organizzazioni ===', 'header');
      for (let i = 0; i < 10; i++) {
        if (stopRef.current) break;
        const nome = `ASL ${pick(CITTA)} ${i + 1}`;
        addLog(`Creazione org: ${nome}...`);
        try {
          const res = await addOrganizzazione(nome);
          createdOrgs.push(res.organizzazione);
          incStat('org');
          addLog(`✓ ${nome} (blockchain: ${JSON.stringify(res.blockchain)})`, 'success');
        } catch (e) {
          addLog(`✗ ${nome}: ${e.message}`, 'error');
          incStat('errors');
        }
        await sleep(500);
      }

      // FASE 2: Strutture (2 per org)
      addLog('=== FASE 2: Creazione Strutture ===', 'header');
      for (const org of createdOrgs) {
        if (stopRef.current) break;
        for (let j = 0; j < 2; j++) {
          if (stopRef.current) break;
          const nome = `${pick(TIPI_STR)} ${pick(COGNOMI)} ${j + 1}`;
          addLog(`Struttura: ${nome} (org #${org.id})...`);
          try {
            const res = await addStruttura({
              denominazione: nome,
              indirizzo: `Via ${pick(COGNOMI)} ${Math.floor(Math.random() * 200) + 1}, ${pick(CITTA)}`,
              organizzazione: org.id,
            });
            createdStr.push(res.struttura);
            incStat('str');
            addLog(`✓ ${nome}`, 'success');
          } catch (e) {
            addLog(`✗ ${nome}: ${e.message}`, 'error');
            incStat('errors');
          }
          await sleep(300);
        }
      }

      // FASE 3: Liste (2 per struttura)
      addLog('=== FASE 3: Creazione Liste ===', 'header');
      for (const str of createdStr) {
        if (stopRef.current) break;
        for (let k = 0; k < 2; k++) {
          if (stopRef.current) break;
          const tag = pick(TAGS);
          const nome = `${tag.replace(/_/g, ' ')} ${k + 1}`;
          addLog(`Lista: ${nome} (str #${str.id})...`);
          try {
            const res = await addLista({ denominazione: nome, struttura: str.id, tag });
            createdListe.push(res.lista);
            incStat('liste');
            addLog(`✓ ${nome} [tag: ${tag}]`, 'success');
          } catch (e) {
            addLog(`✗ ${nome}: ${e.message}`, 'error');
            incStat('errors');
          }
          await sleep(300);
        }
      }

      // FASE 4: Assistiti
      addLog('=== FASE 4: Creazione Assistiti ===', 'header');
      const cfSet = new Set();
      for (let a = 0; a < 50; a++) {
        if (stopRef.current) break;
        let cf;
        do { cf = randomCF(); } while (cfSet.has(cf));
        cfSet.add(cf);
        const isMale = Math.random() > 0.5;
        const nome = pick(isMale ? NOMI_M : NOMI_F);
        const cognome = pick(COGNOMI);
        addLog(`Assistito ${a + 1}/50: ${cognome} ${nome} (${cf})...`);
        try {
          const res = await addAssistito({
            nome, cognome, codiceFiscale: cf,
            email: `${nome.toLowerCase()}.${cognome.toLowerCase()}${a}@test.it`,
          });
          createdAss.push(res.assistito);
          incStat('ass');
          addLog(`✓ ${cognome} ${nome} (anonId: ${res.assistito.anonId})`, 'success');
        } catch (e) {
          addLog(`✗ ${cognome} ${nome}: ${e.message}`, 'error');
          incStat('errors');
        }
        await sleep(200);
      }

      // FASE 5: Inserimento in liste
      addLog('=== FASE 5: Inserimento Assistiti in Liste ===', 'header');
      for (const ass of createdAss) {
        if (stopRef.current) break;
        const numListe = Math.floor(Math.random() * 2) + 1;
        for (let m = 0; m < numListe; m++) {
          if (stopRef.current) break;
          const lista = pick(createdListe);
          addLog(`${ass.cognome} ${ass.nome} → lista #${lista.id}...`);
          try {
            await addAssistitoInLista(ass.id, lista.id);
            incStat('inLista');
            addLog(`✓ Aggiunto in lista #${lista.id}`, 'success');
          } catch (e) {
            addLog(`✗ ${e.message}`, 'error');
            incStat('errors');
          }
          await sleep(200);
        }
      }

      // FASE 6: Simulazione uscite (primi in coda)
      addLog('=== FASE 6: Simulazione Uscite ===', 'header');
      try {
        const strData = await getStrutture();
        const allStr = strData?.strutture || [];
        for (const str of allStr.slice(0, 5)) {
          if (stopRef.current) break;
          for (const lista of (str.liste || []).slice(0, 2)) {
            if (stopRef.current) break;
            // Prendi il dettaglio della lista per trovare il primo in coda
            try {
              const detRes = await fetch(`/api/v1/liste-dettaglio?idLista=${lista.id}`);
              const det = await detRes.json();
              if (det.coda && det.coda.length > 0) {
                const primo = det.coda[0];
                addLog(`Chiama primo in coda lista #${lista.id}: ${primo.assistito?.cognome || '?'}...`);
                await rimuoviAssistitoDaLista(primo.id, 2); // in assistenza
                incStat('usciti');
                addLog(`✓ Rimosso (in assistenza)`, 'success');
              }
            } catch (e) {
              addLog(`✗ ${e.message}`, 'error');
            }
            await sleep(300);
          }
        }
      } catch (e) {
        addLog(`Errore fase uscite: ${e.message}`, 'error');
      }

      addLog('=== TEST COMPLETATO ===', 'header');
      addToast('Load test completato!', 'success');
    } catch (e) {
      addLog(`ERRORE FATALE: ${e.message}`, 'error');
    } finally {
      setRunning(false);
    }
  };

  const handleStop = () => {
    stopRef.current = true;
    addLog('--- STOP richiesto ---', 'warning');
  };

  const logColors = {
    info: 'text-slate-400',
    success: 'text-neon-emerald',
    error: 'text-red-400',
    warning: 'text-amber-400',
    header: 'text-neon-cyan font-bold',
  };

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Zap className="text-amber-500" size={32} />
          Load Test
        </h1>
        <p className="text-slate-400 mb-6">
          Genera dati di prova: 10 org → 20 strutture → 40 liste → 50 assistiti → inserimenti → uscite
        </p>
      </motion.div>

      {/* Controls */}
      <div className="flex gap-3 mb-6">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={runTest}
          disabled={running}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-purple text-white font-medium disabled:opacity-50"
        >
          {running ? <LoadingSpinner size={18} /> : <Play size={18} />}
          {running ? 'In esecuzione...' : 'Avvia Load Test'}
        </motion.button>
        {running && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleStop}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-500/20 text-red-400 font-medium"
          >
            <Square size={18} /> Stop
          </motion.button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {[
          { icon: Building2, label: 'Org', value: stats.org, color: 'text-neon-purple' },
          { icon: Hospital, label: 'Strutture', value: stats.str, color: 'text-neon-cyan' },
          { icon: FileText, label: 'Liste', value: stats.liste, color: 'text-neon-emerald' },
          { icon: Users, label: 'Assistiti', value: stats.ass, color: 'text-amber-500' },
          { icon: UserPlus, label: 'In lista', value: stats.inLista, color: 'text-blue-400' },
          { icon: UserMinus, label: 'Usciti', value: stats.usciti, color: 'text-slate-300' },
          { icon: AlertTriangle, label: 'Errori', value: stats.errors, color: 'text-red-400' },
        ].map((s, i) => (
          <div key={i} className="glass-static rounded-xl p-3 text-center">
            <s.icon size={16} className={`mx-auto mb-1 ${s.color}`} />
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-slate-500 uppercase">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Log */}
      <div className="glass-static rounded-2xl p-4 h-[500px] overflow-y-auto font-mono text-xs">
        {log.length === 0 ? (
          <p className="text-slate-600 text-center py-8">Premi "Avvia Load Test" per iniziare</p>
        ) : (
          log.map((entry, i) => (
            <div key={i} className={`py-0.5 ${logColors[entry.type]}`}>
              <span className="text-slate-600">[{entry.ts}]</span> {entry.msg}
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}
