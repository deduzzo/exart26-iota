import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useOutletContext } from 'react-router-dom';
import { Hospital, Plus, Search, MapPin, CheckCircle, XCircle, ListFilter } from 'lucide-react';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import { useApi } from '../hooks/useApi';
import { getStrutture, getOrganizzazioni, addStruttura, addLista } from '../api/endpoints';

export default function Strutture() {
  const { addToast } = useOutletContext();
  const [selectedOrg, setSelectedOrg] = useState('');
  const { data: orgsData } = useApi(getOrganizzazioni);
  const { data: struttureData, loading, error, reload } = useApi(
    () => getStrutture(selectedOrg || undefined),
    [selectedOrg]
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [listaModalOpen, setListaModalOpen] = useState(false);
  const [selectedStruttura, setSelectedStruttura] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form state for new struttura
  const [form, setForm] = useState({
    denominazione: '',
    indirizzo: '',
    organizzazione: '',
    attiva: true,
  });

  // Form state for new lista
  const [listaForm, setListaForm] = useState({ denominazione: '', tag: '' });

  const organizzazioni = Array.isArray(orgsData) ? orgsData : (orgsData?.items || orgsData?.organizzazioni || []);
  const strutture = Array.isArray(struttureData) ? struttureData : (struttureData?.items || struttureData?.strutture || []);

  const filtered = strutture.filter((s) =>
    !searchQuery ||
    s.denominazione?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.indirizzo?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns = [
    {
      key: 'id',
      label: 'ID',
      render: (v) => <span className="text-slate-500 font-mono text-xs">#{v}</span>,
    },
    {
      key: 'denominazione',
      label: 'Denominazione',
      render: (v) => <span className="font-medium text-slate-100">{v}</span>,
    },
    {
      key: 'indirizzo',
      label: 'Indirizzo',
      render: (v) => (
        <span className="text-slate-400 flex items-center gap-1 text-xs">
          <MapPin size={12} /> {v || '-'}
        </span>
      ),
    },
    {
      key: 'organizzazione',
      label: 'Organizzazione',
      render: (v) => {
        if (typeof v === 'object' && v) return v.denominazione || '-';
        const org = organizzazioni.find((o) => o.id === v);
        return org?.denominazione || v || '-';
      },
    },
    {
      key: 'attiva',
      label: 'Stato',
      render: (v) => (
        v !== false ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-neon-emerald/10 text-neon-emerald">
            <CheckCircle size={12} /> Attiva
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-red-500/10 text-red-400">
            <XCircle size={12} /> Inattiva
          </span>
        )
      ),
    },
    {
      key: 'liste',
      label: 'Liste',
      render: (v) => {
        const count = Array.isArray(v) ? v.length : (v || 0);
        return (
          <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-medium bg-neon-purple/10 text-neon-purple">
            {count}
          </span>
        );
      },
    },
    {
      key: '_actions',
      label: '',
      render: (_, row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedStruttura(row);
            setListaModalOpen(true);
          }}
          className="text-xs text-neon-cyan hover:text-neon-cyan/80 flex items-center gap-1 transition-colors"
        >
          <Plus size={14} /> Lista
        </button>
      ),
    },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.denominazione.trim().length < 2) {
      addToast('La denominazione deve avere almeno 2 caratteri', 'error');
      return;
    }
    if (!form.organizzazione) {
      addToast('Seleziona un\'organizzazione', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await addStruttura({
        denominazione: form.denominazione.trim(),
        indirizzo: form.indirizzo.trim(),
        organizzazione: parseInt(form.organizzazione),
        attiva: form.attiva,
      });
      addToast('Struttura creata con successo', 'success');
      setModalOpen(false);
      setForm({ denominazione: '', indirizzo: '', organizzazione: '', attiva: true });
      reload();
    } catch (err) {
      addToast(`Errore: ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddLista = async (e) => {
    e.preventDefault();
    if (listaForm.denominazione.trim().length < 2) {
      addToast('La denominazione deve avere almeno 2 caratteri', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await addLista({
        denominazione: listaForm.denominazione.trim(),
        tag: listaForm.tag.trim() || null,
        struttura: selectedStruttura.id,
      });
      addToast('Lista creata con successo', 'success');
      setListaModalOpen(false);
      setListaForm({ denominazione: '', tag: '' });
      setSelectedStruttura(null);
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
              <Hospital className="text-neon-cyan" size={32} />
              Strutture
            </h1>
            <p className="text-slate-400">Gestisci le strutture sanitarie e le liste d'attesa</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-purple text-white font-medium text-sm hover:shadow-lg hover:shadow-neon-cyan/20 transition-shadow"
          >
            <Plus size={18} />
            Nuova Struttura
          </motion.button>
        </div>
      </motion.div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="glass-static rounded-xl flex items-center gap-3 px-4 py-2.5 flex-1 max-w-md">
          <Search size={18} className="text-slate-500" />
          <input
            type="text"
            placeholder="Cerca struttura..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-sm text-slate-200 placeholder-slate-500 flex-1"
          />
        </div>
        <div className="glass-static rounded-xl flex items-center gap-3 px-4 py-2.5">
          <ListFilter size={18} className="text-slate-500" />
          <select
            value={selectedOrg}
            onChange={(e) => setSelectedOrg(e.target.value)}
            className="bg-transparent border-none outline-none text-sm text-slate-200 cursor-pointer"
          >
            <option value="" className="bg-gray-900">Tutte le organizzazioni</option>
            {organizzazioni.map((org) => (
              <option key={org.id} value={org.id} className="bg-gray-900">
                {org.denominazione}
              </option>
            ))}
          </select>
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
          emptyMessage="Nessuna struttura trovata"
        />
      </motion.div>

      {/* Create Struttura Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuova Struttura">
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Denominazione *</label>
              <input
                type="text"
                value={form.denominazione}
                onChange={(e) => setForm({ ...form, denominazione: e.target.value })}
                placeholder="Nome della struttura"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20 transition-colors"
                autoFocus
                minLength={2}
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Indirizzo</label>
              <input
                type="text"
                value={form.indirizzo}
                onChange={(e) => setForm({ ...form, indirizzo: e.target.value })}
                placeholder="Indirizzo della struttura"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Organizzazione *</label>
              <select
                value={form.organizzazione}
                onChange={(e) => setForm({ ...form, organizzazione: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20 transition-colors cursor-pointer"
                required
              >
                <option value="" className="bg-gray-900">Seleziona organizzazione</option>
                {organizzazioni.map((org) => (
                  <option key={org.id} value={org.id} className="bg-gray-900">
                    {org.denominazione}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-400">Attiva</label>
              <button
                type="button"
                onClick={() => setForm({ ...form, attiva: !form.attiva })}
                className={`relative w-12 h-6 rounded-full transition-colors ${form.attiva ? 'bg-neon-emerald' : 'bg-slate-600'}`}
              >
                <motion.div
                  animate={{ x: form.attiva ? 24 : 2 }}
                  className="absolute top-1 w-4 h-4 rounded-full bg-white"
                />
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
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
              {submitting ? 'Creazione...' : 'Crea Struttura'}
            </motion.button>
          </div>
        </form>
      </Modal>

      {/* Add Lista Modal */}
      <Modal open={listaModalOpen} onClose={() => { setListaModalOpen(false); setSelectedStruttura(null); }} title={`Nuova Lista - ${selectedStruttura?.denominazione || ''}`}>
        <form onSubmit={handleAddLista}>
          <div className="mb-5">
            <label className="block text-sm text-slate-400 mb-2">Denominazione Lista *</label>
            <input
              type="text"
              value={listaForm.denominazione}
              onChange={(e) => setListaForm({ ...listaForm, denominazione: e.target.value })}
              placeholder="Nome della lista d'attesa"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20 transition-colors"
              autoFocus
              minLength={2}
              required
            />
          </div>
          <div className="mb-5">
            <label className="block text-sm text-slate-400 mb-2">Tag (opzionale)</label>
            <input
              type="text"
              value={listaForm.tag}
              onChange={(e) => setListaForm({ ...listaForm, tag: e.target.value })}
              placeholder="es. riabilitazione, fisioterapia, logopedia"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20 transition-colors"
            />
            <p className="text-xs text-slate-600 mt-1">Il tag permette di filtrare e raggruppare le liste per categoria</p>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => { setListaModalOpen(false); setSelectedStruttura(null); }}
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
              {submitting ? 'Creazione...' : 'Crea Lista'}
            </motion.button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
