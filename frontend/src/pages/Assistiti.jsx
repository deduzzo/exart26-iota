import { useState } from 'react';
import { motion } from 'framer-motion';
import { useOutletContext } from 'react-router-dom';
import { Users, Plus, Search, Mail, Phone, MapPin, Calendar, CreditCard, UserPlus, ListPlus, FileText } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import { useApi } from '../hooks/useApi';
import { getAssistiti, addAssistito, getStrutture, addAssistitoInLista } from '../api/endpoints';
import { validateCodiceFiscale, validateEmail, formatDate } from '../utils/formatters';

export default function Assistiti() {
  const { addToast } = useOutletContext();
  const { data, loading, error, reload } = useApi(getAssistiti);
  const [modalOpen, setModalOpen] = useState(false);
  const [listaModalOpen, setListaModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedAssistito, setSelectedAssistito] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  // Strutture data for "add to list" modal
  const { data: struttureData } = useApi(getStrutture);
  const [selectedLista, setSelectedLista] = useState('');

  const [form, setForm] = useState({
    nome: '',
    cognome: '',
    codiceFiscale: '',
    dataNascita: '',
    email: '',
    telefono: '',
    indirizzo: '',
  });

  const assistiti = Array.isArray(data) ? data : (data?.items || data?.assistiti || []);
  const strutture = Array.isArray(struttureData) ? struttureData : (struttureData?.items || struttureData?.strutture || []);

  // Build a flat list of all liste from strutture
  const allListe = strutture.flatMap((s) => {
    const liste = Array.isArray(s.liste) ? s.liste : [];
    return liste.map((l) => ({
      ...l,
      strutturaNome: s.denominazione,
    }));
  });

  const filtered = assistiti.filter((a) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.nome?.toLowerCase().includes(q) ||
      a.cognome?.toLowerCase().includes(q) ||
      a.codiceFiscale?.toLowerCase().includes(q) ||
      a.email?.toLowerCase().includes(q)
    );
  });

  const STATO_LABELS = {
    1: 'In coda', 2: 'In assistenza', 3: 'Completato',
    4: 'Cambio lista', 5: 'Rinuncia', 6: 'Annullato'
  };

  const columns = [
    {
      key: 'cognome',
      label: 'Assistito',
      render: (v, row) => (
        <div>
          <span className="font-medium text-slate-100">{v} {row.nome}</span>
          <div className="text-xs text-slate-500 font-mono mt-0.5">{row.codiceFiscale}</div>
        </div>
      ),
    },
    {
      key: 'listeAssegnate',
      label: 'Liste / Posizione',
      render: (liste) => {
        if (!liste || liste.length === 0) {
          return <span className="text-slate-600 text-xs">Nessuna lista</span>;
        }
        return (
          <div className="space-y-1">
            {liste.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-slate-300">{l.listaNome || `Lista #${l.listaId}`}</span>
                {l.stato === 1 && l.posizione && (
                  <span className="bg-neon-cyan/15 text-neon-cyan text-[10px] font-bold px-1.5 py-0.5 rounded">
                    #{l.posizione}
                  </span>
                )}
                <StatusBadge status={l.stato} />
              </div>
            ))}
          </div>
        );
      },
    },
    {
      key: 'email',
      label: 'Contatti',
      render: (v, row) => (
        <div className="text-xs text-slate-400 space-y-0.5">
          {v && <div className="flex items-center gap-1"><Mail size={11} /> {v}</div>}
          {row.telefono && <div className="flex items-center gap-1"><Phone size={11} /> {row.telefono}</div>}
          {!v && !row.telefono && <span className="text-slate-600">-</span>}
        </div>
      ),
    },
    {
      key: '_actions',
      label: '',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedAssistito(row);
              setListaModalOpen(true);
            }}
            className="text-xs text-neon-cyan hover:text-neon-cyan/80 flex items-center gap-1 transition-colors"
            title="Aggiungi a lista"
          >
            <ListPlus size={14} /> Assegna
          </button>
        </div>
      ),
    },
  ];

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear error on change
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!form.nome.trim()) newErrors.nome = 'Il nome e obbligatorio';
    if (!form.cognome.trim()) newErrors.cognome = 'Il cognome e obbligatorio';
    if (!form.codiceFiscale.trim()) {
      newErrors.codiceFiscale = 'Il codice fiscale e obbligatorio';
    } else if (!validateCodiceFiscale(form.codiceFiscale)) {
      newErrors.codiceFiscale = 'Codice fiscale non valido (formato: ABCDEF12G34H567I)';
    }
    if (form.email && !validateEmail(form.email)) {
      newErrors.email = 'Email non valida';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = {
        nome: form.nome.trim(),
        cognome: form.cognome.trim(),
        codiceFiscale: form.codiceFiscale.trim().toUpperCase(),
      };
      if (form.dataNascita) payload.dataNascita = form.dataNascita;
      if (form.email) payload.email = form.email.trim();
      if (form.telefono) payload.telefono = form.telefono.trim();
      if (form.indirizzo) payload.indirizzo = form.indirizzo.trim();

      await addAssistito(payload);
      addToast('Assistito creato con successo', 'success');
      setModalOpen(false);
      setForm({ nome: '', cognome: '', codiceFiscale: '', dataNascita: '', email: '', telefono: '', indirizzo: '' });
      setErrors({});
      reload();
    } catch (err) {
      addToast(`Errore: ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddToLista = async (e) => {
    e.preventDefault();
    if (!selectedLista) {
      addToast('Seleziona una lista', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await addAssistitoInLista(selectedAssistito.id, parseInt(selectedLista));
      addToast(`${selectedAssistito.cognome} ${selectedAssistito.nome} aggiunto alla lista`, 'success');
      setListaModalOpen(false);
      setSelectedAssistito(null);
      setSelectedLista('');
      reload();
    } catch (err) {
      addToast(`Errore: ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRowClick = (row) => {
    setSelectedAssistito(row);
    setDetailModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  const inputClass = (field) =>
    `w-full bg-white/5 border ${errors[field] ? 'border-red-500/50' : 'border-white/10'} rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20 transition-colors`;

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <Users className="text-amber-500" size={32} />
              Assistiti
            </h1>
            <p className="text-slate-400">Gestisci gli assistiti e l'assegnazione alle liste d'attesa</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-purple text-white font-medium text-sm hover:shadow-lg hover:shadow-neon-cyan/20 transition-shadow"
          >
            <UserPlus size={18} />
            Nuovo Assistito
          </motion.button>
        </div>
      </motion.div>

      {/* Search */}
      <div className="mb-6">
        <div className="glass-static rounded-xl flex items-center gap-3 px-4 py-2.5 max-w-lg">
          <Search size={18} className="text-slate-500" />
          <input
            type="text"
            placeholder="Cerca per nome, cognome, codice fiscale o email..."
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
          onRowClick={handleRowClick}
          emptyMessage="Nessun assistito trovato"
        />
      </motion.div>

      {/* Create Assistito Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setErrors({}); }} title="Nuovo Assistito" wide>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Nome *</label>
              <input
                type="text"
                value={form.nome}
                onChange={(e) => updateForm('nome', e.target.value)}
                placeholder="Nome"
                className={inputClass('nome')}
                autoFocus
                required
              />
              {errors.nome && <p className="text-xs text-red-400 mt-1">{errors.nome}</p>}
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Cognome *</label>
              <input
                type="text"
                value={form.cognome}
                onChange={(e) => updateForm('cognome', e.target.value)}
                placeholder="Cognome"
                className={inputClass('cognome')}
                required
              />
              {errors.cognome && <p className="text-xs text-red-400 mt-1">{errors.cognome}</p>}
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Codice Fiscale *</label>
              <input
                type="text"
                value={form.codiceFiscale}
                onChange={(e) => updateForm('codiceFiscale', e.target.value.toUpperCase())}
                placeholder="ABCDEF12G34H567I"
                className={inputClass('codiceFiscale')}
                maxLength={16}
                required
              />
              {errors.codiceFiscale && <p className="text-xs text-red-400 mt-1">{errors.codiceFiscale}</p>}
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Data di Nascita</label>
              <input
                type="date"
                value={form.dataNascita}
                onChange={(e) => updateForm('dataNascita', e.target.value)}
                className={inputClass('dataNascita')}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateForm('email', e.target.value)}
                placeholder="email@esempio.it"
                className={inputClass('email')}
              />
              {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email}</p>}
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Telefono</label>
              <input
                type="tel"
                value={form.telefono}
                onChange={(e) => updateForm('telefono', e.target.value)}
                placeholder="+39 333 1234567"
                className={inputClass('telefono')}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-400 mb-2">Indirizzo</label>
              <input
                type="text"
                value={form.indirizzo}
                onChange={(e) => updateForm('indirizzo', e.target.value)}
                placeholder="Via, citta, CAP"
                className={inputClass('indirizzo')}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={() => { setModalOpen(false); setErrors({}); }}
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
              {submitting ? <LoadingSpinner size={16} /> : <UserPlus size={16} />}
              {submitting ? 'Creazione...' : 'Crea Assistito'}
            </motion.button>
          </div>
        </form>
      </Modal>

      {/* Add to Lista Modal */}
      <Modal open={listaModalOpen} onClose={() => { setListaModalOpen(false); setSelectedAssistito(null); }} title={`Assegna a Lista - ${selectedAssistito?.cognome || ''} ${selectedAssistito?.nome || ''}`}>
        <form onSubmit={handleAddToLista}>
          <div className="mb-5">
            <label className="block text-sm text-slate-400 mb-2">Seleziona Lista *</label>
            {allListe.length === 0 ? (
              <p className="text-sm text-slate-500">Nessuna lista disponibile. Crea prima una struttura con una lista.</p>
            ) : (
              <select
                value={selectedLista}
                onChange={(e) => setSelectedLista(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20 transition-colors cursor-pointer"
                required
              >
                <option value="" className="bg-gray-900">Seleziona una lista</option>
                {allListe.map((lista) => (
                  <option key={lista.id} value={lista.id} className="bg-gray-900">
                    {lista.strutturaNome} - {lista.denominazione}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => { setListaModalOpen(false); setSelectedAssistito(null); }}
              className="px-4 py-2.5 rounded-xl text-sm text-slate-400 hover:bg-white/5 transition-colors"
            >
              Annulla
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={submitting || allListe.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-purple text-white font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? <LoadingSpinner size={16} /> : <ListPlus size={16} />}
              {submitting ? 'Assegnazione...' : 'Assegna a Lista'}
            </motion.button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal open={detailModalOpen} onClose={() => { setDetailModalOpen(false); setSelectedAssistito(null); }} title="Dettagli Assistito" wide>
        {selectedAssistito && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Nome</p>
                <p className="text-slate-100 font-medium">{selectedAssistito.nome}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Cognome</p>
                <p className="text-slate-100 font-medium">{selectedAssistito.cognome}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Codice Fiscale</p>
                <p className="text-slate-200 font-mono text-sm">{selectedAssistito.codiceFiscale}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Data di Nascita</p>
                <p className="text-slate-200">{formatDate(selectedAssistito.dataNascita)}</p>
              </div>
              {selectedAssistito.email && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Email</p>
                  <p className="text-slate-200 flex items-center gap-1"><Mail size={14} /> {selectedAssistito.email}</p>
                </div>
              )}
              {selectedAssistito.telefono && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Telefono</p>
                  <p className="text-slate-200 flex items-center gap-1"><Phone size={14} /> {selectedAssistito.telefono}</p>
                </div>
              )}
              {selectedAssistito.indirizzo && (
                <div className="col-span-2">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Indirizzo</p>
                  <p className="text-slate-200 flex items-center gap-1"><MapPin size={14} /> {selectedAssistito.indirizzo}</p>
                </div>
              )}
            </div>

            {/* Liste assignment */}
            {selectedAssistito.liste && Array.isArray(selectedAssistito.liste) && selectedAssistito.liste.length > 0 && (
              <div className="border-t border-white/10 pt-4 mt-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Liste Assegnate</p>
                <div className="space-y-2">
                  {selectedAssistito.liste.map((lista, i) => (
                    <div key={i} className="glass-static rounded-xl p-3 text-sm flex items-center justify-between">
                      <span>{typeof lista === 'object' ? lista.denominazione : `Lista #${lista}`}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  setDetailModalOpen(false);
                  setListaModalOpen(true);
                }}
                className="flex items-center gap-2 text-sm text-neon-cyan hover:text-neon-cyan/80 transition-colors"
              >
                <ListPlus size={16} /> Aggiungi a una lista
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
