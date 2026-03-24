import { useState } from 'react';
import { motion } from 'framer-motion';
import { useOutletContext } from 'react-router-dom';
import {
  Wallet as WalletIcon, Shield, Database, RefreshCw, ExternalLink,
  CheckCircle, AlertTriangle, Copy, Download, Upload, Zap
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { useApi } from '../hooks/useApi';
import { getWalletInfo, initWallet, fetchDbFromBlockchain, recoverFromArweave, getDashboardData } from '../api/endpoints';
import { truncateAddress } from '../utils/formatters';

export default function Wallet() {
  const { addToast } = useOutletContext();
  const { data: wallet, loading: walletLoading, reload: reloadWallet } = useApi(getWalletInfo);
  const { data: dashboard } = useApi(getDashboardData);
  const [syncing, setSyncing] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [copied, setCopied] = useState(false);

  const isWalletOk = wallet?.status === 'WALLET OK';
  const arweaveEnabled = dashboard?.arweaveStatus?.enabled;

  const handleInit = async () => {
    setInitializing(true);
    try {
      await initWallet();
      addToast('Wallet inizializzato con successo', 'success');
      reloadWallet();
    } catch (err) {
      addToast(`Errore: ${err.message}`, 'error');
    } finally {
      setInitializing(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await fetchDbFromBlockchain();
      addToast(result?.error ? `Sync con errori: ${result.error}` : 'Sincronizzazione completata', result?.error ? 'warning' : 'success');
    } catch (err) {
      addToast(`Errore sync: ${err.message}`, 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleRecover = async () => {
    setRecovering(true);
    try {
      const result = await recoverFromArweave();
      addToast(result?.message || 'Recovery completato', 'success');
    } catch (err) {
      addToast(`Errore recovery: ${err.message}`, 'error');
    } finally {
      setRecovering(false);
    }
  };

  const copyAddress = () => {
    if (wallet?.address) {
      navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      addToast('Indirizzo copiato negli appunti', 'success');
    }
  };

  if (walletLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <WalletIcon className="text-neon-cyan" size={32} />
          Wallet IOTA
        </h1>
        <p className="text-slate-400 mb-8">Gestione wallet blockchain e strumenti di amministrazione</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Wallet Status Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-static rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <WalletIcon size={20} className="text-neon-cyan" />
              Stato Wallet
            </h3>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
              isWalletOk
                ? 'bg-neon-emerald/10 text-neon-emerald'
                : 'bg-amber-500/10 text-amber-500'
            }`}>
              {isWalletOk ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
              {wallet?.status || 'Sconosciuto'}
            </span>
          </div>

          {isWalletOk ? (
            <div className="space-y-4">
              {/* Balance */}
              <div className="glass-static rounded-xl p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Saldo</p>
                <p className="text-2xl font-bold text-neon-cyan font-mono">
                  {wallet.balance || '0'}
                </p>
              </div>

              {/* Address */}
              <div className="glass-static rounded-xl p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Indirizzo</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono text-slate-300 flex-1 break-all">
                    {wallet.address || '-'}
                  </p>
                  <button
                    onClick={copyAddress}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors shrink-0"
                    title="Copia indirizzo"
                  >
                    {copied ? <CheckCircle size={16} className="text-neon-emerald" /> : <Copy size={16} className="text-slate-400" />}
                  </button>
                </div>
              </div>

              {/* Explorer Link */}
              {wallet.address && (
                <a
                  href={`https://explorer.rebased.iota.org/address/${wallet.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-neon-cyan hover:text-neon-cyan/80 transition-colors"
                >
                  <ExternalLink size={14} /> Visualizza su IOTA Explorer
                </a>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="inline-flex p-4 rounded-2xl bg-amber-500/10 mb-4">
                <AlertTriangle size={32} className="text-amber-500" />
              </div>
              <p className="text-slate-400 mb-6">Il wallet non e ancora inizializzato.</p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleInit}
                disabled={initializing}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-purple text-white font-medium text-sm disabled:opacity-50"
              >
                {initializing ? <LoadingSpinner size={16} /> : <Zap size={16} />}
                {initializing ? 'Inizializzazione...' : 'Inizializza Wallet'}
              </motion.button>
            </div>
          )}
        </motion.div>

        {/* Arweave Status Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-static rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Shield size={20} className="text-neon-purple" />
              Backup Arweave
            </h3>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
              arweaveEnabled
                ? 'bg-neon-emerald/10 text-neon-emerald'
                : 'bg-slate-500/10 text-slate-500'
            }`}>
              {arweaveEnabled ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
              {arweaveEnabled ? 'Attivo' : 'Non configurato'}
            </span>
          </div>

          <div className="space-y-3 text-sm">
            <div className="glass-static rounded-xl p-4">
              <p className="text-slate-400 mb-2">
                {arweaveEnabled
                  ? 'Il backup Arweave e attivo. Ogni transazione IOTA viene automaticamente duplicata su Arweave come backup permanente.'
                  : 'Il backup Arweave non e configurato. Configura il file config/private_arweave_conf.js per abilitare il backup permanente.'
                }
              </p>
              {arweaveEnabled && dashboard?.arweaveStatus?.address && (
                <div className="mt-3 pt-3 border-t border-white/5">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Wallet Arweave</p>
                  <p className="font-mono text-xs text-slate-300">{truncateAddress(dashboard.arweaveStatus.address, 12)}</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Admin Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 glass-static rounded-2xl p-6"
        >
          <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
            <Database size={20} className="text-neon-emerald" />
            Strumenti di Amministrazione
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sync from Blockchain */}
            <div className="glass-static rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-neon-cyan/10">
                  <Download size={20} className="text-neon-cyan" />
                </div>
                <div>
                  <h4 className="font-medium text-sm">Sincronizza da Blockchain</h4>
                  <p className="text-xs text-slate-500">Importa dati dalla blockchain IOTA nel database locale</p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSync}
                disabled={syncing}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-neon-cyan/10 text-neon-cyan text-sm font-medium hover:bg-neon-cyan/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {syncing ? (
                  <>
                    <LoadingSpinner size={16} />
                    Sincronizzazione in corso...
                  </>
                ) : (
                  <>
                    <RefreshCw size={16} />
                    Avvia Sincronizzazione
                  </>
                )}
              </motion.button>
            </div>

            {/* Recovery from Arweave */}
            <div className="glass-static rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-neon-purple/10">
                  <Upload size={20} className="text-neon-purple" />
                </div>
                <div>
                  <h4 className="font-medium text-sm">Recovery da Arweave</h4>
                  <p className="text-xs text-slate-500">Recupera dati dal backup permanente Arweave</p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleRecover}
                disabled={recovering || !arweaveEnabled}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-neon-purple/10 text-neon-purple text-sm font-medium hover:bg-neon-purple/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {recovering ? (
                  <>
                    <LoadingSpinner size={16} />
                    Recovery in corso...
                  </>
                ) : (
                  <>
                    <Shield size={16} />
                    Avvia Recovery
                  </>
                )}
              </motion.button>
              {!arweaveEnabled && (
                <p className="text-xs text-slate-600 mt-2 text-center">Richiede configurazione Arweave</p>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
