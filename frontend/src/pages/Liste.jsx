import { useState } from 'react';
import { motion } from 'framer-motion';
import { useOutletContext } from 'react-router-dom';
import { FileText, Users, ChevronRight, Clock, CheckCircle, AlertTriangle, UserPlus } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';
import { useApi } from '../hooks/useApi';
import { getStrutture, getAssistiti, addAssistitoInLista } from '../api/endpoints';

export default function Liste() {
  const { addToast } = useOutletContext();
  const { data: struttureData, loading } = useApi(getStrutture);
  const { data: assistitiData } = useApi(getAssistiti);
  const [selectedLista, setSelectedLista] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedAssistito, setSelectedAssistito] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner size={40} />
    </div>
  );

  const strutture = struttureData?.strutture || struttureData || [];
  const assistiti = assistitiData?.assistiti || assistitiData || [];

  // Build a map of liste with their struttura info
  const listeFlat = [];
  for (const str of strutture) {
    const liste = str.liste || [];
    for (const lista of liste) {
      listeFlat.push({
        ...lista,
        strutturaNome: str.denominazione,
        strutturaId: str.id,
        orgId: str.organizzazione,
      });
    }
  }

  // Get assistiti in the selected lista from the assistitiListe populated data
  const getAssistitiInLista = (listaId) => {
    // This comes from the strutture populate chain or directly
    // For now, show what we have
    return [];
  };

  const handleAddToList = async () => {
    if (!selectedAssistito || !selectedLista) return;
    setSubmitting(true);
    try {
      await addAssistitoInLista(Number(selectedAssistito), selectedLista.id);
      addToast(`Assistito aggiunto alla lista "${selectedLista.denominazione}"`, 'success');
      setAddModalOpen(false);
      setSelectedAssistito('');
    } catch (err) {
      addToast(`Errore: ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <FileText className="text-neon-emerald" size={32} />
          Liste d'Attesa
        </h1>
        <p className="text-slate-400 mb-8">
          {listeFlat.length} liste in {strutture.length} strutture
        </p>
      </motion.div>

      {listeFlat.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-static rounded-2xl p-12 text-center"
        >
          <FileText size={48} className="mx-auto text-slate-600 mb-4" />
          <p className="text-slate-400">Nessuna lista creata. Crea prima una struttura con le sue liste.</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {listeFlat.map((lista, i) => (
            <motion.div
              key={`${lista.id}-${lista.strutturaId}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.02, y: -2 }}
              onClick={() => setSelectedLista(lista)}
              className={`glass-static rounded-2xl p-5 cursor-pointer transition-all border ${
                selectedLista?.id === lista.id
                  ? 'border-neon-emerald/50 neon-glow'
                  : 'border-transparent hover:border-white/10'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">{lista.denominazione}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{lista.strutturaNome}</p>
                </div>
                <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                  lista.aperta !== false
                    ? 'bg-neon-emerald/10 text-neon-emerald'
                    : 'bg-red-500/10 text-red-400'
                }`}>
                  {lista.aperta !== false ? 'Aperta' : 'Chiusa'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock size={12} /> v{lista.ultimaVersioneSuBlockchain || 0}
                </span>
                <span className="flex items-center gap-1 text-neon-cyan">
                  Dettagli <ChevronRight size={12} />
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Detail panel for selected lista */}
      {selectedLista && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 glass-static rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <FileText size={20} className="text-neon-emerald" />
                {selectedLista.denominazione}
              </h3>
              <p className="text-sm text-slate-400">
                Struttura: {selectedLista.strutturaNome} | Blockchain v{selectedLista.ultimaVersioneSuBlockchain || 0}
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-purple text-white text-sm font-medium"
            >
              <UserPlus size={16} /> Aggiungi Assistito
            </motion.button>
          </div>

          {/* Public key */}
          {selectedLista.publicKey && (
            <div className="glass-static rounded-xl p-3 mb-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Chiave Pubblica</p>
              <p className="font-mono text-xs text-slate-300 break-all">{selectedLista.publicKey?.substring(0, 80)}...</p>
            </div>
          )}

          <p className="text-sm text-slate-500 text-center py-6">
            La lista degli assistiti in coda verra mostrata qui quando i dati sono caricati dalla blockchain.
          </p>
        </motion.div>
      )}

      {/* Add assistito to lista modal */}
      <Modal open={addModalOpen} onClose={() => setAddModalOpen(false)} title="Aggiungi Assistito alla Lista">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Lista</label>
            <div className="glass-static rounded-xl px-4 py-2.5 text-sm">
              {selectedLista?.denominazione}
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Assistito</label>
            <select
              value={selectedAssistito}
              onChange={(e) => setSelectedAssistito(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-neon-cyan/50"
            >
              <option value="">Seleziona un assistito...</option>
              {assistiti.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.cognome} {a.nome} - {a.codiceFiscale}
                </option>
              ))}
            </select>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleAddToList}
            disabled={submitting || !selectedAssistito}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-purple text-white font-medium text-sm disabled:opacity-50"
          >
            {submitting ? <LoadingSpinner size={16} /> : 'Aggiungi alla Lista'}
          </motion.button>
        </div>
      </Modal>
    </div>
  );
}
