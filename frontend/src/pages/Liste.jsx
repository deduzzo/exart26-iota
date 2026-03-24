import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOutletContext } from 'react-router-dom';
import {
  FileText, Users, ChevronRight, Clock, CheckCircle, UserPlus,
  UserMinus, History, ArrowRightCircle, XCircle, Ban, Tag, Edit3
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';
import { useApi } from '../hooks/useApi';
import { getStrutture, getAssistiti, addAssistitoInLista, getListeDettaglio, rimuoviAssistitoDaLista, updateListaTag } from '../api/endpoints';

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
  const [altreListe, setAltreListe] = useState([]); // altre liste in cui l'assistito è in coda
  const [azioniAltreListe, setAzioniAltreListe] = useState({}); // { idAssistitoListe: 'mantieni'|'rimuovi' }
  const [submitting, setSubmitting] = useState(false);
  const [showStorico, setShowStorico] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [tagInput, setTagInput] = useState('');

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
      .then((data) => {
        console.log('Liste dettaglio loaded:', data?.lista?.denominazione, 'coda:', data?.totaleInCoda);
        setDettaglio(data);
      })
      .catch((err) => {
        console.error('Liste dettaglio error:', err);
        setDettaglio(null);
      })
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

  // Quando si apre il modal rimozione, carica le altre liste dell'assistito
  const openRemoveModal = async (record) => {
    setSelectedRecord(record);
    setRemoveStato(2);
    setAzioniAltreListe({});
    // Cerca le altre liste in coda per questo assistito
    const assId = record.assistito?.id || record.assistito;
    const allAssListe = [];
    for (const str of strutture) {
      for (const lista of (str.liste || [])) {
        if (lista.id === selectedLista?.id) continue; // skip la lista corrente
        // Cerca se l'assistito è in coda in questa lista
        try {
          const det = await getListeDettaglio(lista.id);
          const inCoda = det?.coda?.find(c => {
            const cId = c.assistito?.id || c.assistito;
            return cId === assId;
          });
          if (inCoda) {
            allAssListe.push({
              ...inCoda,
              listaNome: lista.denominazione,
              listaTag: lista.tag,
              strutturaNome: str.denominazione,
            });
          }
        } catch (e) { /* skip */ }
      }
    }
    setAltreListe(allAssListe);
    setRemoveModalOpen(true);
  };

  const handleRemove = async () => {
    if (!selectedRecord) return;
    setSubmitting(true);
    try {
      // Costruisci array azioni per le altre liste
      const azioni = altreListe.map(al => ({
        idAssistitoListe: al.id,
        azione: azioniAltreListe[al.id] === 'rimuovi' ? 'rimuovi' : 'mantieni',
        statoRimozione: 4, // cambio lista
      }));
      await rimuoviAssistitoDaLista(selectedRecord.id, removeStato, azioni);
      const nome = selectedRecord.assistito ? `${selectedRecord.assistito.cognome} ${selectedRecord.assistito.nome}` : 'Assistito';
      const rimossiCount = azioni.filter(a => a.azione === 'rimuovi').length;
      addToast(`${nome} rimosso dalla lista${rimossiCount > 0 ? ` e da altre ${rimossiCount} liste` : ''}`, 'success');
      setRemoveModalOpen(false);
      setSelectedRecord(null);
      setAltreListe([]);
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
        <div className="flex gap-6">
        {/* Colonna sinistra: card liste (scrollabile) */}
        <div className="w-80 shrink-0 max-h-[calc(100vh-200px)] overflow-y-auto space-y-3 pr-2">
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
                  {lista.tag && (
                    <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md bg-neon-purple/10 text-neon-purple text-[10px]">
                      <Tag size={9} />{lista.tag}
                    </span>
                  )}
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

        {/* Colonna destra: dettaglio lista (sticky) */}
        <div className="flex-1 min-w-0 sticky top-6 self-start max-h-[calc(100vh-200px)] overflow-y-auto">
      <AnimatePresence>
        {selectedLista ? (
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
                {/* Tag edit inline */}
                {editingTag === selectedLista?.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="tag..."
                      className="w-28 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-neon-purple/50"
                      autoFocus
                    />
                    <button onClick={async () => {
                      await updateListaTag(selectedLista.id, tagInput || null);
                      addToast('Tag aggiornato', 'success');
                      setEditingTag(null);
                    }} className="text-neon-emerald text-xs px-2 py-1.5 hover:bg-white/5 rounded-lg">
                      <CheckCircle size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditingTag(selectedLista?.id); setTagInput(selectedLista?.tag || ''); }}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/5 text-slate-400 text-xs hover:bg-white/10 transition-colors"
                    title="Modifica tag"
                  >
                    <Tag size={14} /> {selectedLista?.tag || 'Aggiungi tag'}
                  </button>
                )}
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
                            onClick={() => openRemoveModal(item)}
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
        ) : (
          <div className="glass-static rounded-2xl p-12 text-center h-64 flex items-center justify-center">
            <div>
              <FileText size={48} className="mx-auto text-slate-700 mb-3" />
              <p className="text-slate-500">Seleziona una lista per vedere i dettagli</p>
            </div>
          </div>
        )}
      </AnimatePresence>
        </div>
        </div>
      )}

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

      {/* Remove assistito modal - form decisionale multi-lista */}
      <Modal open={removeModalOpen} onClose={() => { setRemoveModalOpen(false); setSelectedRecord(null); setAltreListe([]); }}
        title={`Rimuovi ${selectedRecord?.assistito?.cognome || ''} ${selectedRecord?.assistito?.nome || ''}`} wide>
        <div className="space-y-5">
          {/* Step 1: Motivo rimozione dalla lista corrente */}
          <div>
            <p className="text-sm text-slate-400 mb-2">Motivo della rimozione da <strong className="text-slate-200">{selectedLista?.denominazione}</strong>:</p>
            <div className="grid grid-cols-2 gap-2">
              {STATO_USCITA.map((s) => (
                <button key={s.value}
                  onClick={() => setRemoveStato(s.value)}
                  className={`flex items-center gap-2 p-3 rounded-xl text-sm transition-all ${
                    removeStato === s.value
                      ? 'glass-static border border-neon-cyan/30 text-slate-100'
                      : 'hover:bg-white/5 text-slate-400'
                  }`}>
                  <s.icon size={16} className={s.color} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Altre liste (se presenti) */}
          {altreListe.length > 0 && (
            <div className="border-t border-white/10 pt-4">
              <p className="text-sm text-slate-400 mb-3">
                L'assistito e in coda anche in altre <strong className="text-neon-cyan">{altreListe.length}</strong> liste. Cosa vuoi fare?
              </p>
              <div className="space-y-2">
                {altreListe.map((al) => (
                  <div key={al.id} className="glass-static rounded-xl p-3 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{al.listaNome}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{al.strutturaNome}</span>
                        {al.listaTag && (
                          <span className="px-1.5 py-0.5 rounded bg-neon-purple/10 text-neon-purple text-[10px]">
                            {al.listaTag}
                          </span>
                        )}
                        <span>Pos. #{al.posizione}</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => setAzioniAltreListe(prev => ({...prev, [al.id]: 'mantieni'}))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          azioniAltreListe[al.id] !== 'rimuovi'
                            ? 'bg-neon-emerald/15 text-neon-emerald'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}>
                        Mantieni
                      </button>
                      <button
                        onClick={() => setAzioniAltreListe(prev => ({...prev, [al.id]: 'rimuovi'}))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          azioniAltreListe[al.id] === 'rimuovi'
                            ? 'bg-red-500/15 text-red-400'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}>
                        Rimuovi
                      </button>
                    </div>
                  </div>
                ))}
                {/* Azioni rapide per tag */}
                {altreListe.some(al => al.listaTag) && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-xs text-slate-500">Rimuovi per tag:</span>
                    {[...new Set(altreListe.filter(al => al.listaTag).map(al => al.listaTag))].map(tag => (
                      <button key={tag}
                        onClick={() => {
                          const updates = {};
                          altreListe.forEach(al => { if (al.listaTag === tag) updates[al.id] = 'rimuovi'; });
                          setAzioniAltreListe(prev => ({...prev, ...updates}));
                        }}
                        className="px-2 py-1 rounded-lg text-[10px] bg-neon-purple/10 text-neon-purple hover:bg-neon-purple/20 transition-colors">
                        <Tag size={10} className="inline mr-1" />{tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={handleRemove} disabled={submitting}
            className="w-full py-3 rounded-xl bg-amber-500/20 text-amber-500 font-medium text-sm hover:bg-amber-500/30 disabled:opacity-50">
            {submitting ? 'Rimozione in corso...' : `Conferma Rimozione${Object.values(azioniAltreListe).filter(a => a === 'rimuovi').length > 0 ? ` (+ ${Object.values(azioniAltreListe).filter(a => a === 'rimuovi').length} altre liste)` : ''}`}
          </motion.button>
        </div>
      </Modal>
    </div>
  );
}
