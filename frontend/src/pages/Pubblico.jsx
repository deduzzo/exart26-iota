import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Users, UserCheck, Clock, Shield, ExternalLink, ChevronDown, ChevronUp, History } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import StatusBadge from '../components/StatusBadge';
import { useApi } from '../hooks/useApi';
import { getPublicListe } from '../api/endpoints';

function hashCF(cf) {
  // SHA-256 in browser via SubtleCrypto is async, so we use a sync approach
  // We'll compute it on input change and store it
  return null; // placeholder, real hashing done async
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function Pubblico() {
  const { data: liste, loading, error } = useApi(getPublicListe);
  const [cfInput, setCfInput] = useState('');
  const [anonId, setAnonId] = useState(null);
  const [searching, setSearching] = useState(false);
  const [expandedListe, setExpandedListe] = useState({});
  const [showStorico, setShowStorico] = useState({});

  // Hash CF client-side using SubtleCrypto
  const computeAnonId = async (cf) => {
    if (!cf || cf.trim().length === 0) {
      setAnonId(null);
      return;
    }
    setSearching(true);
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(cf.trim().toUpperCase());
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      setAnonId(hashHex.substring(0, 8).toUpperCase());
    } catch {
      setAnonId(null);
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    computeAnonId(cfInput);
  };

  const handleClear = () => {
    setCfInput('');
    setAnonId(null);
  };

  // Check if user's anonId is found in any list
  const foundInLists = useMemo(() => {
    if (!anonId || !liste) return [];
    return liste
      .filter(l => l.coda.some(c => c.anonId === anonId))
      .map(l => {
        const entry = l.coda.find(c => c.anonId === anonId);
        return { lista: l, position: entry.position };
      });
  }, [anonId, liste]);

  const toggleLista = (id) => {
    setExpandedListe(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Total stats
  const totaleInCoda = useMemo(() => {
    if (!liste) return 0;
    return liste.reduce((sum, l) => sum + l.stats.inCoda, 0);
  }, [liste]);

  const totaleListe = liste?.length || 0;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner size={40} />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="inline-flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-cyan to-neon-purple flex items-center justify-center">
            <span className="text-white font-bold">E</span>
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-neon-cyan to-neon-purple bg-clip-text text-transparent">
            ExArt26
          </span>
        </div>
        <h1 className="text-3xl font-bold mb-2">Verifica Lista d&apos;Attesa</h1>
        <p className="text-slate-400">Consulta lo stato delle liste d&apos;attesa per la riabilitazione sanitaria</p>
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-static rounded-2xl p-6 mb-8"
      >
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={cfInput}
              onChange={(e) => setCfInput(e.target.value.toUpperCase())}
              placeholder="Inserisci il tuo Codice Fiscale per verificare la tua posizione..."
              maxLength={16}
              className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 transition-all font-mono tracking-wider"
            />
          </div>
          <button
            type="submit"
            disabled={!cfInput.trim() || searching}
            className="px-6 py-3 bg-gradient-to-r from-neon-cyan to-neon-purple rounded-xl font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {searching ? 'Ricerca...' : 'Cerca'}
          </button>
          {anonId && (
            <button
              type="button"
              onClick={handleClear}
              className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            >
              Pulisci
            </button>
          )}
        </form>

        {/* Result banner */}
        <AnimatePresence>
          {anonId && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4"
            >
              <div className={`rounded-xl p-4 ${foundInLists.length > 0 ? 'bg-neon-cyan/10 border border-neon-cyan/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
                <p className="text-sm">
                  <span className="text-slate-400">Il tuo ID anonimo: </span>
                  <span className="font-mono font-bold text-neon-cyan text-lg">{anonId}</span>
                </p>
                {foundInLists.length > 0 ? (
                  <p className="text-sm text-neon-emerald mt-1">
                    Trovato in {foundInLists.length} {foundInLists.length === 1 ? 'lista' : 'liste'}:
                    {foundInLists.map((f, i) => (
                      <span key={f.lista.id}>
                        {i > 0 ? ', ' : ' '}
                        <strong>{f.lista.denominazione}</strong> (posizione #{f.position})
                      </span>
                    ))}
                  </p>
                ) : (
                  <p className="text-sm text-amber-400 mt-1">
                    Nessuna corrispondenza trovata nelle liste attive.
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Global stats */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 gap-4 mb-8"
      >
        <div className="glass-static rounded-2xl p-5 text-center">
          <p className="text-3xl font-bold text-neon-cyan">{totaleListe}</p>
          <p className="text-sm text-slate-400 mt-1">Liste Attive</p>
        </div>
        <div className="glass-static rounded-2xl p-5 text-center">
          <p className="text-3xl font-bold text-neon-purple">{totaleInCoda}</p>
          <p className="text-sm text-slate-400 mt-1">Assistiti in Coda</p>
        </div>
      </motion.div>

      {/* Error */}
      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-static rounded-2xl p-5 mb-6 border border-amber-500/20">
          <p className="text-amber-400 text-sm">Impossibile caricare le liste. Riprova piu tardi.</p>
        </motion.div>
      )}

      {/* Liste cards */}
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-4 mb-12">
        {liste && liste.map((lista) => {
          const isExpanded = expandedListe[lista.id] ?? (lista.stats.inCoda <= 10);
          const userInThisList = anonId ? lista.coda.find(c => c.anonId === anonId) : null;

          return (
            <motion.div
              key={lista.id}
              variants={item}
              className={`glass-static rounded-2xl overflow-hidden transition-all duration-300 ${userInThisList ? 'ring-1 ring-neon-cyan/40 neon-glow' : ''}`}
            >
              {/* Card header */}
              <div
                className="p-5 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => toggleLista(lista.id)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{lista.denominazione}</h3>
                    <p className="text-sm text-slate-400 mt-0.5">
                      {lista.struttura?.denominazione || 'Struttura'}
                      {lista.organizzazione ? ` - ${lista.organizzazione.denominazione}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {userInThisList && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-neon-cyan/20 text-neon-cyan animate-pulse">
                        Sei qui: #{userInThisList.position}
                      </span>
                    )}
                    {isExpanded ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
                  </div>
                </div>

                {/* Stats bar */}
                <div className="flex gap-6 mt-3">
                  <div className="flex items-center gap-1.5 text-sm">
                    <Users size={14} className="text-neon-cyan" />
                    <span className="text-slate-300">{lista.stats.inCoda}</span>
                    <span className="text-slate-500">in coda</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <UserCheck size={14} className="text-neon-emerald" />
                    <span className="text-slate-300">{lista.stats.usciti}</span>
                    <span className="text-slate-500">usciti</span>
                  </div>
                  {lista.stats.tempoMedioGiorni > 0 && (
                    <div className="flex items-center gap-1.5 text-sm">
                      <Clock size={14} className="text-neon-purple" />
                      <span className="text-slate-300">{lista.stats.tempoMedioGiorni}</span>
                      <span className="text-slate-500">giorni media attesa</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Queue table */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-white/5">
                      {/* Toggle Coda / Storico */}
                      <div className="flex gap-2 px-5 pt-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowStorico(prev => ({...prev, [lista.id]: false})); }}
                          className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${!showStorico[lista.id] ? 'bg-neon-cyan/15 text-neon-cyan' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                          <Users size={12} className="inline mr-1" />Coda ({lista.stats.inCoda})
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowStorico(prev => ({...prev, [lista.id]: true})); }}
                          className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${showStorico[lista.id] ? 'bg-neon-purple/15 text-neon-purple' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                          <History size={12} className="inline mr-1" />Storico ({lista.stats.totale || 0})
                        </button>
                      </div>

                      {showStorico[lista.id] ? (
                        /* STORICO */
                        lista.storico && lista.storico.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-white/5">
                                  <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-slate-500 font-medium">ID Anonimo</th>
                                  <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-slate-500 font-medium">Stato</th>
                                  <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-slate-500 font-medium">Ingresso</th>
                                  <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-slate-500 font-medium">Uscita</th>
                                </tr>
                              </thead>
                              <tbody>
                                {lista.storico.map((entry, idx) => {
                                  const isUser = anonId && entry.anonId === anonId;
                                  return (
                                    <tr key={idx} className={`border-b border-white/5 ${isUser ? 'bg-neon-cyan/10' : 'hover:bg-white/5'}`}>
                                      <td className="px-5 py-3">
                                        <span className={`font-mono text-sm tracking-wider ${isUser ? 'text-neon-cyan font-bold' : 'text-slate-300'}`}>
                                          {entry.anonId}
                                        </span>
                                        {isUser && <span className="ml-2 text-xs text-neon-cyan">(tu)</span>}
                                      </td>
                                      <td className="px-5 py-3"><StatusBadge status={entry.stato} /></td>
                                      <td className="px-5 py-3 text-slate-400">
                                        {entry.dataOraIngresso ? new Date(entry.dataOraIngresso).toLocaleDateString('it-IT') : '-'}
                                      </td>
                                      <td className="px-5 py-3 text-slate-400">
                                        {entry.dataOraUscita ? new Date(entry.dataOraUscita).toLocaleDateString('it-IT') : '-'}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="p-5 text-center text-slate-500 text-sm">Nessun movimento registrato</p>
                        )
                      ) : (
                      /* CODA */
                      lista.coda.length === 0 ? (
                        <p className="p-5 text-center text-slate-500 text-sm">Nessun assistito in coda</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-white/5">
                                <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-slate-500 font-medium">Pos.</th>
                                <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-slate-500 font-medium">ID Anonimo</th>
                                <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-slate-500 font-medium">Stato</th>
                                <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-slate-500 font-medium">Data Ingresso</th>
                              </tr>
                            </thead>
                            <tbody>
                              {lista.coda.map((entry) => {
                                const isUser = anonId && entry.anonId === anonId;
                                return (
                                  <tr
                                    key={`${lista.id}-${entry.position}`}
                                    className={`border-b border-white/5 transition-colors ${
                                      isUser
                                        ? 'bg-neon-cyan/10'
                                        : 'hover:bg-white/5'
                                    }`}
                                  >
                                    <td className="px-5 py-3">
                                      <span className={`text-lg font-bold ${isUser ? 'text-neon-cyan' : 'text-slate-300'}`}>
                                        #{entry.position}
                                      </span>
                                    </td>
                                    <td className="px-5 py-3">
                                      <span className={`font-mono text-sm tracking-wider ${isUser ? 'text-neon-cyan font-bold' : 'text-slate-300'}`}>
                                        {entry.anonId}
                                      </span>
                                      {isUser && (
                                        <span className="ml-2 text-xs text-neon-cyan">(tu)</span>
                                      )}
                                    </td>
                                    <td className="px-5 py-3">
                                      <StatusBadge status={entry.stato} />
                                    </td>
                                    <td className="px-5 py-3 text-slate-400">
                                      {entry.dataOraIngresso
                                        ? new Date(entry.dataOraIngresso).toLocaleDateString('it-IT', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric',
                                          })
                                        : '-'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}

        {liste && liste.length === 0 && (
          <div className="glass-static rounded-2xl p-10 text-center">
            <p className="text-slate-500">Nessuna lista d&apos;attesa disponibile.</p>
          </div>
        )}
      </motion.div>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center pb-8 border-t border-white/5 pt-6"
      >
        <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
          <Shield size={14} className="text-neon-cyan" />
          <span>Dati verificabili sulla blockchain IOTA 2.0</span>
          <a
            href="https://explorer.shimmer.network"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-neon-cyan hover:text-neon-cyan/80 transition-colors"
          >
            Explorer <ExternalLink size={12} />
          </a>
        </div>
        <p className="text-xs text-slate-600 mt-2">
          I dati personali sono protetti tramite crittografia. Solo l&apos;ID anonimo derivato dal codice fiscale viene mostrato.
        </p>
      </motion.footer>
    </div>
  );
}
