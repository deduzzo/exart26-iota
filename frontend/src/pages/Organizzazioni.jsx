import { useState } from 'react';
import { motion } from 'framer-motion';
import { useOutletContext } from 'react-router-dom';
import { Building2, Plus, Search, Key, Info } from 'lucide-react';
import DataTable from '../components/DataTable';
import BlockchainInfoModal from '../components/BlockchainInfoModal';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import { useApi } from '../hooks/useApi';
import { getOrganizzazioni, addOrganizzazione } from '../api/endpoints';
import { truncateKey } from '../utils/formatters';

export default function Organizzazioni() {
  const { addToast } = useOutletContext();
  const { data, loading, error, reload } = useApi(getOrganizzazioni);
  const [modalOpen, setModalOpen] = useState(false);
  const [infoModal, setInfoModal] = useState(null);

  const columns = [
    {
      key: 'id',
      label: 'ID',
      render: (v) => <span className="text-slate-500 font-mono text-xs">#{v}</span>,
    },
    {
      key: 'denominazione',
      label: 'Denominazione',
      render: (v, row) => (
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-slate-100">{v}</span>
          <button
            onClick={(e) => { e.stopPropagation(); setInfoModal({ entityType: 'ORGANIZZAZIONE', entityId: String(row.id), entityData: row }); }}
            className="text-slate-500 hover:text-cyan-400 transition-colors flex-shrink-0"
          >
            <Info size={14} />
          </button>
        </div>
      ),
    },
    {
      key: 'strutture',
      label: 'Strutture',
      render: (v) => {
        const count = Array.isArray(v) ? v.length : (v || 0);
        return (
          <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-medium bg-neon-cyan/10 text-neon-cyan">
            {count}
          </span>
        );
      },
    },
    {
      key: 'publicKey',
      label: 'Chiave Pubblica',
      render: (v) => (
        <span className="font-mono text-xs text-slate-500 flex items-center gap-1" title={v}>
          <Key size={12} />
          {truncateKey(v, 20)}
        </span>
      ),
    },
  ];
  const [denominazione, setDenominazione] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const organizzazioni = Array.isArray(data) ? data : (data?.items || data?.organizzazioni || []);

  const filtered = organizzazioni.filter((org) =>
    !searchQuery || org.denominazione?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (denominazione.trim().length < 2) {
      addToast('La denominazione deve avere almeno 2 caratteri', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await addOrganizzazione(denominazione.trim());
      addToast('Organizzazione creata con successo', 'success');
      setModalOpen(false);
      setDenominazione('');
      reload();
    } catch (err) {
      addToast(`Errore: ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <Building2 className="text-neon-purple" size={32} />
              Organizzazioni
            </h1>
            <p className="text-slate-400">Gestisci le organizzazioni sanitarie</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-purple text-white font-medium text-sm hover:shadow-lg hover:shadow-neon-cyan/20 transition-shadow"
          >
            <Plus size={18} />
            Nuova Organizzazione
          </motion.button>
        </div>
      </motion.div>

      {/* Search */}
      <div className="mb-6">
        <div className="glass-static rounded-xl flex items-center gap-3 px-4 py-2.5 max-w-md">
          <Search size={18} className="text-slate-500" />
          <input
            type="text"
            placeholder="Cerca organizzazione..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-sm text-slate-200 placeholder-slate-500 flex-1"
          />
        </div>
      </div>

      {error && (
        <div className="glass-static rounded-2xl p-5 border border-amber-500/20 mb-6">
          <p className="text-amber-400 text-sm">Errore nel caricamento: {error}</p>
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <DataTable
          columns={columns}
          data={filtered}
          emptyMessage="Nessuna organizzazione trovata"
        />
      </motion.div>

      {/* Create Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuova Organizzazione">
        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="block text-sm text-slate-400 mb-2">Denominazione *</label>
            <input
              type="text"
              value={denominazione}
              onChange={(e) => setDenominazione(e.target.value)}
              placeholder="Nome dell'organizzazione"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20 transition-colors"
              autoFocus
              minLength={2}
              required
            />
            <p className="text-xs text-slate-600 mt-1">Minimo 2 caratteri</p>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-sm text-slate-400 hover:bg-white/5 transition-colors"
            >
              Annulla
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-purple text-white font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? <LoadingSpinner size={16} /> : <Plus size={16} />}
              {submitting ? 'Creazione...' : 'Crea Organizzazione'}
            </motion.button>
          </div>
        </form>
      </Modal>

      <BlockchainInfoModal
        open={!!infoModal}
        onClose={() => setInfoModal(null)}
        entityType={infoModal?.entityType}
        entityId={infoModal?.entityId}
        entityData={infoModal?.entityData}
      />
    </div>
  );
}
