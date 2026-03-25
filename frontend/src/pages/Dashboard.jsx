import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Hospital, FileText, Users, Wallet, Database, RefreshCw, Shield, UserCheck, UserMinus, Hash, Layers, Info, Download, Upload, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import StatsCard from '../components/StatsCard';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import BlockchainInfoModal from '../components/BlockchainInfoModal';
import { useApi } from '../hooks/useApi';
import { getDashboardData, getWalletInfo } from '../api/endpoints';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const TIPO_COLORS = {
  ORGANIZZAZIONE_CREATA: 'text-purple-400',
  STRUTTURA_CREATA: 'text-cyan-400',
  LISTA_CREATA: 'text-emerald-400',
  ASSISTITO_CREATO: 'text-amber-400',
  INGRESSO_IN_LISTA: 'text-blue-400',
  USCITA_DA_LISTA: 'text-red-400',
};
const TIPO_LABELS = {
  ORGANIZZAZIONE_CREATA: 'Nuova Org',
  STRUTTURA_CREATA: 'Nuova Struttura',
  LISTA_CREATA: 'Nuova Lista',
  ASSISTITO_CREATO: 'Nuovo Assistito',
  INGRESSO_IN_LISTA: 'Ingresso Lista',
  USCITA_DA_LISTA: 'Uscita Lista',
};

export default function Dashboard() {
  const { data: dashboard, loading: dashLoading, error: dashError } = useApi(getDashboardData);
  const { data: wallet, loading: walletLoading } = useApi(getWalletInfo);
  const [infoModal, setInfoModal] = useState(null);
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleVerifyFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVerifyLoading(true);
    setVerifyResult(null);
    try {
      const text = await file.text();
      const snapshot = JSON.parse(text);
      const csrfRes = await fetch('/csrfToken');
      const { _csrf } = await csrfRes.json();
      const res = await fetch('/api/v1/verify-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': _csrf },
        body: JSON.stringify({ snapshot }),
      });
      const data = await res.json();
      setVerifyResult(data);
    } catch (err) {
      setVerifyResult({ error: err.message || 'Errore durante la verifica' });
    } finally {
      setVerifyLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const operazioniColumns = [
    { key: 'tipo', label: 'Tipo', render: (v) => (
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-white/5 ${TIPO_COLORS[v] || 'text-slate-400'}`}>
        {TIPO_LABELS[v] || v}
      </span>
    )},
    { key: 'label', label: 'Dettaglio', render: (v) => <span className="font-medium text-sm">{v}</span> },
    { key: 'timestamp', label: 'Data', render: (v) => v ? new Date(v).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-' },
    { key: 'entityId', label: '', render: (v, row) => (
      row.entityType && row.entityId ? (
        <button
          onClick={() => setInfoModal({
            entityType: row.entityType,
            entityId: row.entityType === 'ASSISTITO' ? 'ASS#' + row.entityId : String(row.entityId),
            entityData: row
          })}
          className="text-slate-500 hover:text-cyan-400 transition-colors"
        >
          <Info size={14} />
        </button>
      ) : null
    )},
  ];

  const loading = dashLoading || walletLoading;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner size={40} />
    </div>
  );

  // Handle case where dashboard API doesn't exist yet - use fallback data
  const stats = dashboard?.stats || {};
  const ultimeOperazioni = dashboard?.ultimeOperazioni || [];

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-slate-400 mb-8">Panoramica del sistema ExArt26 IOTA</p>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <motion.div variants={item}>
          <StatsCard icon={Building2} label="Organizzazioni" value={stats.organizzazioni || 0} color="purple" />
        </motion.div>
        <motion.div variants={item}>
          <StatsCard icon={Hospital} label="Strutture" value={stats.strutture || 0} color="cyan" />
        </motion.div>
        <motion.div variants={item}>
          <StatsCard icon={FileText} label="Liste d'Attesa" value={stats.liste || 0} color="emerald" />
        </motion.div>
        <motion.div variants={item}>
          <StatsCard icon={Users} label="Assistiti" value={stats.assistiti || 0} color="amber" />
        </motion.div>
        <motion.div variants={item}>
          <StatsCard icon={UserCheck} label="In Lista" value={stats.assistitiInLista || stats.assistitiInCoda || 0} color="blue" />
        </motion.div>
        <motion.div variants={item}>
          <StatsCard icon={UserMinus} label="Usciti" value={stats.assistitiUsciti || 0} color="red" />
        </motion.div>
        <motion.div variants={item}>
          <StatsCard icon={Hash} label="Transazioni BC" value={stats.transazioniTotali || 0} color="purple" />
        </motion.div>
        <motion.div variants={item}>
          <StatsCard icon={Layers} label="Oggetti Totali" value={stats.oggettiTotali || 0} color="cyan" />
        </motion.div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stato Blockchain */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-static rounded-2xl p-5"
        >
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Wallet size={18} className="text-neon-cyan" /> Stato Blockchain
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Wallet</span>
              <span className={wallet?.status === 'WALLET OK' ? 'text-neon-emerald' : 'text-amber-500'}>
                {wallet?.status || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Saldo</span>
              <span className="font-mono text-neon-cyan">{wallet?.balance || '0'}</span>
            </div>
            {wallet?.address && (
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Indirizzo</span>
                <span className="font-mono text-xs text-slate-300 truncate ml-2 max-w-[150px]" title={wallet.address}>
                  {wallet.address}
                </span>
              </div>
            )}
            <div className="border-t border-white/5 pt-3 mt-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 flex items-center gap-1">
                  <Shield size={14} /> Arweave
                </span>
                <span className={dashboard?.arweaveStatus?.enabled ? 'text-neon-emerald' : 'text-slate-500'}>
                  {dashboard?.arweaveStatus?.enabled ? 'Attivo' : 'Non configurato'}
                </span>
              </div>
            </div>
            <div className="border-t border-white/5 pt-3 mt-3">
              <button
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = '/api/v1/export-data';
                  a.download = `exart26-export-${Date.now()}.json`;
                  a.click();
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-neon-cyan/10 border border-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/20 transition-all text-sm font-medium"
              >
                <Download size={16} />
                Esporta Snapshot JSON
              </button>
            </div>
          </div>
        </motion.div>

        {/* Ultime Operazioni */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2"
        >
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <RefreshCw size={18} className="text-neon-purple" /> Ultime Operazioni
          </h3>
          <DataTable
            columns={operazioniColumns}
            data={ultimeOperazioni}
            emptyMessage="Nessuna operazione registrata"
          />
        </motion.div>
      </div>

      {/* Verifica Snapshot */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-6 glass-static rounded-2xl p-5"
      >
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Shield size={18} className="text-neon-emerald" /> Verifica Integrita Dati
        </h3>
        <p className="text-slate-400 text-sm mb-4">
          Carica uno snapshot JSON esportato in precedenza per verificare che lo stato attuale del database sia identico.
        </p>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleVerifyFile}
            className="hidden"
            id="snapshot-file"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={verifyLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neon-emerald/10 border border-neon-emerald/20 text-neon-emerald hover:bg-neon-emerald/20 transition-all text-sm font-medium disabled:opacity-50"
          >
            {verifyLoading ? <LoadingSpinner size={16} /> : <Upload size={16} />}
            {verifyLoading ? 'Verifica in corso...' : 'Carica Snapshot e Verifica'}
          </button>
        </div>

        <AnimatePresence>
          {verifyResult && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 overflow-hidden"
            >
              {verifyResult.error ? (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <div className="flex items-center gap-2 text-red-400 font-medium mb-1">
                    <XCircle size={18} /> Errore
                  </div>
                  <p className="text-red-300 text-sm">{verifyResult.error}</p>
                </div>
              ) : verifyResult.identical ? (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-center gap-2 text-emerald-400 font-medium mb-2">
                    <CheckCircle size={18} /> Ricostruzione Perfetta
                  </div>
                  <p className="text-emerald-300 text-sm">{verifyResult.summary}</p>
                  {verifyResult.snapshotDate && (
                    <p className="text-slate-400 text-xs mt-2">Snapshot del: {new Date(verifyResult.snapshotDate).toLocaleString('it-IT')}</p>
                  )}
                  <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                    {['organizzazioni', 'strutture', 'liste', 'assistiti'].map(k => (
                      <div key={k} className="bg-white/5 rounded-lg p-2">
                        <div className="text-emerald-400 font-bold text-lg">{verifyResult.statsComparison?.attuale?.[k] || 0}</div>
                        <div className="text-slate-500 text-xs capitalize">{k}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center gap-2 text-amber-400 font-medium mb-2">
                    <AlertTriangle size={18} /> Differenze Trovate
                  </div>
                  <p className="text-amber-300 text-sm mb-3">{verifyResult.summary}</p>

                  {verifyResult.statsComparison?.diffs?.length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Conteggi</h4>
                      <div className="space-y-1">
                        {verifyResult.statsComparison.diffs.map((d, i) => (
                          <div key={i} className="flex justify-between text-sm bg-white/5 rounded px-3 py-1">
                            <span className="text-slate-300 capitalize">{d.campo}</span>
                            <span>
                              <span className="text-emerald-400">{d.originale}</span>
                              <span className="text-slate-500 mx-2">→</span>
                              <span className="text-amber-400">{d.attuale}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {verifyResult.recordComparison?.diffs?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">
                        Dettaglio Record ({verifyResult.recordComparison.totalDiffs} differenze)
                      </h4>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {verifyResult.recordComparison.diffs.map((d, i) => (
                          <div key={i} className="text-xs bg-white/5 rounded px-3 py-1.5">
                            <span className="text-slate-400">{d.tabella}#{d.id}</span>
                            {d.tipo === 'MANCANTE' && <span className="text-red-400 ml-2">MANCANTE nel DB</span>}
                            {d.tipo === 'EXTRA' && <span className="text-blue-400 ml-2">EXTRA nel DB</span>}
                            {d.tipo === 'DIVERSO' && (
                              <span className="text-amber-400 ml-2">
                                .{d.campo}: {JSON.stringify(d.originale).substring(0, 30)} → {JSON.stringify(d.attuale).substring(0, 30)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Error state */}
      {dashError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-6 glass-static rounded-2xl p-5 border border-amber-500/20"
        >
          <p className="text-amber-400 text-sm">
            Nota: La dashboard API potrebbe non essere ancora disponibile. I dati verranno mostrati quando il backend sara configurato.
          </p>
        </motion.div>
      )}

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
