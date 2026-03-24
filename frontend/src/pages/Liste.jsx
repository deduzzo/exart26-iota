import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOutletContext } from 'react-router-dom';
import {
  FileText, Users, ChevronRight, Clock, CheckCircle, UserPlus,
  UserMinus, History, ArrowRightCircle, XCircle, Ban
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';
import { useApi } from '../hooks/useApi';
import { getStrutture, getAssistiti, addAssistitoInLista, getListeDettaglio, rimuoviAssistitoDaLista } from '../api/endpoints';

const STATO_USCITA = [
  { value: 2, label: 'Preso in assistenza', icon: ArrowRightCircle, color: 'text-amber-500' },
  { value: 3, label: 'Completato', icon: CheckCircle, color: 'text-neon-emerald' },
  { value: 5, label: 'Rinuncia', icon: XCircle, color: 'text-red-400' },
  { value: 6, label: 'Annullato', icon: Ban, color: 'text-slate-400' },
];

export default function Liste() {
  const { addToast } = useOutletContext();
  const { data: struttureData, loading } = useApi(getStrutture);
  const { data: assistitiData } = useApi(getAssistiti);
  const [selectedLista, setSelectedLista] = useState(null);
  const [dettaglio, setDettaglio] = useState(null);
  const [dettaglioLoading, setDettaglioLoading] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [selectedAssistito, setSelectedAssistito] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [removeStato, setRemoveStato] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [showStorico, setShowStorico] = useState(false);

  const strutture = struttureData?.strutture || struttureData || [];
  const assistiti = assistitiData?.assistiti || assistitiData || [];

  const listeFlat = [];
  for (const str of strutture) {
    for (const lista of (str.liste || [])) {
      listeFlat.push({ ...lista, strutturaNome: str.denominazione, strutturaId: str.id });
    }
  }

  // Carica dettaglio quando si seleziona una lista
  useEffect(() => {
    if (!selectedLista) { setDettaglio(null); return; }
    setDettaglioLoading(true);
    getListeDettaglio(selectedLista.id)
      .then(setDettaglio)
      .catch(() => setDettaglio(null))
      .finally(() => setDettaglioLoading(false));
  }, [selectedLista]);

  const reloadDettaglio = () => {
    if (!selectedLista) return;
    getListeDettaglio(selectedLista.id).then(setDettaglio).catch(() => {});
  };

  const handleAddToList = async () => {
    if (!selectedAssistito || !selectedLista) return;
    setSubmitting(true);
    try {
      await addAssistitoInLista(Number(selectedAssistito), selectedLista.id);
      addToast('Assistito aggiunto alla lista', 'success');
      setAddModalOpen(false);
      setSelectedAssistito('');
      reloadDettaglio();
    } catch (err) {
      addToast(`Errore: ${err.message}`, 'error');
    } finally { setSubmitting(false); }
  };

  const handleRemove = async () => {
    if (!selectedRecord) return;
    setSubmitting(true);
    try {
      await rimuoviAssistitoDaLista(selectedRecord.id, removeStato);
      const nome = selectedRecord.assistito ? `${selectedRecord.assistito.cognome} ${selectedRecord.assistito.nome}` : 'Assistito';
      addToast(`${nome} rimosso dalla lista`, 'success');
      setRemoveModalOpen(false);
      setSelectedRecord(null);
      reloadDettaglio();
    } catch (err) {
      addToast(`Errore: ${err.message}`, 'error');
    } finally { setSubmitting(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><LoadingSpinner size={40} /></div>;

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <FileText className="text-neon-emerald" size={32} />
          Liste d'Attesa
        </h1>
        <p className="text-slate-400 mb-8">{listeFlat.length} liste in {strutture.length} strutture</p>
      </motion.div>

      {listeFlat.length === 0 ? (
        <div className="glass-static rounded-2xl p-12 text-center">
          <FileText size={48} className="mx-auto text-slate-600 mb-4" />
          <p className="text-slate-400">Nessuna lista. Crea prima una struttura con le sue liste.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {listeFlat.map((lista, i) => (
            <motion.div
              key={`${lista.id}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.02, y: -2 }}
              onClick={() => setSelectedLista(lista)}
              className={`glass-static rounded-2xl p-5 cursor-pointer transition-all border ${
                selectedLista?.id === lista.id ? 'border-neon-emerald/50 neon-glow' : 'border-transparent hover:border-white/10'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-sm">{lista.denominazione}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{lista.strutturaNome}</p>
                </div>
                <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                  lista.aperta !== false ? 'bg-neon-emerald/10 text-neon-emerald' : 'bg-red-500/10 text-red-400'
                }`}>
                  {lista.aperta !== false ? 'Aperta' : 'Chiusa'}
                </span>
              </div>
              {/* Stats */}
              {lista.stats && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="text-center">
                    <p className="text-lg font-bold text-neon-cyan">{lista.stats.inCoda}</p>
                    <p className="text-[10px] text-slate-500 uppercase">In coda</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-neon-emerald">{lista.stats.usciti}</p>
                    <p className="text-[10px] text-slate-500 uppercase">Usciti</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-slate-300">
                      {lista.stats.tempoMedioGiorni !== null ? `${lista.stats.tempoMedioGiorni}g` : '-'}
                    </p>
                    <p className="text-[10px] text-slate-500 uppercase">Media attesa</p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1"><Clock size={12} /> v{lista.ultimaVersioneSuBlockchain || 0}</span>
                <span className="flex items-center gap-1 text-neon-cyan">Dettagli <ChevronRight size={12} /></span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Detail panel */}
      <AnimatePresence>
        {selectedLista && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="mt-6 glass-static rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <FileText size={20} className="text-neon-emerald" /> {selectedLista.denominazione}
                </h3>
                <p className="text-sm text-slate-400">Struttura: {selectedLista.strutturaNome}</p>
              </div>
              <div className="flex gap-2">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => setShowStorico(!showStorico)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-slate-300 text-sm hover:bg-white/10 transition-colors"
                >
                  <History size={16} /> {showStorico ? 'Coda' : 'Storico'}
                </motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => setAddModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-purple text-white text-sm font-medium"
                >
                  <UserPlus size={16} /> Aggiungi
                </motion.button>
              </div>
            </div>

            {dettaglioLoading ? (
              <div className="flex justify-center py-8"><LoadingSpinner size={32} /></div>
            ) : !dettaglio ? (
              <p className="text-slate-500 text-center py-8">Impossibile caricare i dettagli.</p>
            ) : !showStorico ? (
              /* CODA ATTUALE */
              <div>
                <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                  <Users size={16} /> In coda: {dettaglio.totaleInCoda}
                </h4>
                {dettaglio.coda.length === 0 ? (
                  <p className="text-slate-500 text-center py-6">Nessun assistito in coda.</p>
                ) : (
                  <div className="space-y-2">
                    {dettaglio.coda.map((item) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="glass-static rounded-xl p-4 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <span className="bg-neon-cyan/15 text-neon-cyan text-sm font-bold w-8 h-8 rounded-lg flex items-center justify-center">
                            {item.posizione}
                          </span>
                          <div>
                            <p className="font-medium text-sm">
                              {item.assistito?.cognome} {item.assistito?.nome}
                            </p>
                            <p className="text-xs text-slate-500">
                              CF: {item.assistito?.codiceFiscale} | Ingresso: {new Date(item.dataOraIngresso).toLocaleDateString('it-IT')}
                            </p>
                          </div>
                        </div>
                        {item.posizione === 1 && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => { setSelectedRecord(item); setRemoveModalOpen(true); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-500 text-xs font-medium hover:bg-amber-500/20 transition-colors"
                          >
                            <UserMinus size={14} /> Chiama
                          </motion.button>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* STORICO */
              <div>
                <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                  <History size={16} /> Storico movimenti: {dettaglio.storico.length}
                </h4>
                {dettaglio.storico.length === 0 ? (
                  <p className="text-slate-500 text-center py-6">Nessun movimento registrato.</p>
                ) : (
                  <div className="space-y-2">
                    {dettaglio.storico.map((item) => (
                      <div key={item.id} className="glass-static rounded-xl p-3 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-medium">
                              {item.assistito?.cognome} {item.assistito?.nome}
                            </p>
                            <p className="text-xs text-slate-500">
                              {new Date(item.dataOraIngresso).toLocaleDateString('it-IT')}
                              {item.dataOraUscita && ` → ${new Date(item.dataOraUscita).toLocaleDateString('it-IT')}`}
                            </p>
                          </div>
                        </div>
                        <StatusBadge status={item.stato} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add assistito modal */}
      <Modal open={addModalOpen} onClose={() => setAddModalOpen(false)} title="Aggiungi Assistito alla Lista">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Lista</label>
            <div className="glass-static rounded-xl px-4 py-2.5 text-sm">{selectedLista?.denominazione}</div>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Assistito</label>
            <select value={selectedAssistito} onChange={(e) => setSelectedAssistito(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-neon-cyan/50">
              <option value="">Seleziona...</option>
              {assistiti.map((a) => (
                <option key={a.id} value={a.id}>{a.cognome} {a.nome} - {a.codiceFiscale}</option>
              ))}
            </select>
          </div>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={handleAddToList} disabled={submitting || !selectedAssistito}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-purple text-white font-medium text-sm disabled:opacity-50">
            {submitting ? 'Aggiunta in corso...' : 'Aggiungi alla Lista'}
          </motion.button>
        </div>
      </Modal>

      {/* Remove assistito modal */}
      <Modal open={removeModalOpen} onClose={() => { setRemoveModalOpen(false); setSelectedRecord(null); }}
        title={`Rimuovi ${selectedRecord?.assistito?.cognome || ''} ${selectedRecord?.assistito?.nome || ''}`}>
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Seleziona il motivo della rimozione dalla lista:
          </p>
          <div className="space-y-2">
            {STATO_USCITA.map((s) => (
              <button key={s.value}
                onClick={() => setRemoveStato(s.value)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm transition-all ${
                  removeStato === s.value
                    ? 'glass-static border border-neon-cyan/30 text-slate-100'
                    : 'hover:bg-white/5 text-slate-400'
                }`}>
                <s.icon size={18} className={s.color} />
                {s.label}
              </button>
            ))}
          </div>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={handleRemove} disabled={submitting}
            className="w-full py-3 rounded-xl bg-amber-500/20 text-amber-500 font-medium text-sm hover:bg-amber-500/30 disabled:opacity-50">
            {submitting ? 'Rimozione...' : 'Conferma Rimozione'}
          </motion.button>
        </div>
      </Modal>
    </div>
  );
}
