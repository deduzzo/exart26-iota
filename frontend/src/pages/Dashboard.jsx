import { motion } from 'framer-motion';
import { Building2, Hospital, FileText, Users, Wallet, Database, RefreshCw, Shield } from 'lucide-react';
import StatsCard from '../components/StatsCard';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
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

const operazioniColumns = [
  { key: 'assistitoNome', label: 'Assistito', render: (_, row) => {
    const nome = row.assistitoNome || (row.assistito ? `ID: ${row.assistito}` : '-');
    return <span className="font-medium">{nome}</span>;
  }},
  { key: 'listaNome', label: 'Lista', render: (_, row) => row.listaNome || '-' },
  { key: 'stato', label: 'Stato', render: (v) => <StatusBadge status={v} /> },
  { key: 'dataOraIngresso', label: 'Data', render: (v) => v ? new Date(v).toLocaleDateString('it-IT') : '-' },
];

export default function Dashboard() {
  const { data: dashboard, loading: dashLoading, error: dashError } = useApi(getDashboardData);
  const { data: wallet, loading: walletLoading } = useApi(getWalletInfo);

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
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
    </div>
  );
}
