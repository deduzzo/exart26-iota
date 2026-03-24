import { useState } from 'react';
import { motion } from 'framer-motion';
import { useOutletContext } from 'react-router-dom';
import {
  Wallet as WalletIcon, Shield, Database, RefreshCw, ExternalLink,
  CheckCircle, AlertTriangle, Copy, Download, Upload, Zap, Trash2, Key
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';
import { useApi } from '../hooks/useApi';
import { getWalletInfo, initWallet, resetWallet, fetchDbFromBlockchain, recoverFromArweave, getDashboardData } from '../api/endpoints';
import { truncateAddress } from '../utils/formatters';

export default function Wallet() {
  const { addToast } = useOutletContext();
  const { data: wallet, loading: walletLoading, reload: reloadWallet } = useApi(getWalletInfo);
  const { data: dashboard } = useApi(getDashboardData);
  const [syncing, setSyncing] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reset wallet state machine: null -> 'confirm1' -> 'confirm2' -> 'resetting' -> 'done'
  const [resetStep, setResetStep] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState(null);
  const [mnemonicCopied, setMnemonicCopied] = useState(false);

  const handleResetStart = () => setResetStep('confirm1');

  const handleResetConfirm1 = () => setResetStep('confirm2');

  const handleResetConfirm2 = async () => {
    setResetting(true);
    setResetStep('resetting');
    try {
      const result = await resetWallet();
      if (result.success) {
        setResetResult(result);
        setResetStep('done');
        addToast('Wallet resettato e reinizializzato', 'success');
      } else {
        addToast(`Errore: ${result.error}`, 'error');
        setResetStep(null);
      }
    } catch (err) {
      addToast(`Errore: ${err.message}`, 'error');
      setResetStep(null);
    } finally {
      setResetting(false);
    }
  };

  const handleResetClose = () => {
    setResetStep(null);
    setResetResult(null);
    setMnemonicCopied(false);
    reloadWallet();
  };

  const copyMnemonic = () => {
    if (resetResult?.mnemonic) {
      navigator.clipboard.writeText(resetResult.mnemonic);
      setMnemonicCopied(true);
      setTimeout(() => setMnemonicCopied(false), 2000);
    }
  };

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

              {/* Reset Wallet Button */}
              <div className="pt-4 mt-4 border-t border-white/5">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleResetStart}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 size={16} /> Distruggi e Reinizializza Wallet
                </motion.button>
              </div>
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

      {/* Reset Wallet Modal - Double Confirmation */}
      <Modal
        open={resetStep !== null}
        onClose={resetStep === 'done' ? handleResetClose : () => setResetStep(null)}
        title={resetStep === 'done' ? 'Nuovo Wallet Creato' : 'Distruggi Wallet'}
      >
        {resetStep === 'confirm1' && (
          <div className="text-center">
            <div className="inline-flex p-4 rounded-2xl bg-red-500/10 mb-4">
              <Trash2 size={40} className="text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-red-400 mb-2">Sei sicuro?</h3>
            <p className="text-slate-400 text-sm mb-6">
              Questa operazione distruggera il wallet corrente e tutti i dati locali.
              Un nuovo wallet verra creato con un nuovo mnemonic e indirizzo.
              <strong className="text-red-400"> I fondi sul wallet corrente andranno persi.</strong>
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setResetStep(null)}
                className="px-5 py-2.5 rounded-xl text-sm text-slate-400 hover:bg-white/5 transition-colors"
              >
                Annulla
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleResetConfirm1}
                className="px-5 py-2.5 rounded-xl bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors"
              >
                Si, continua
              </motion.button>
            </div>
          </div>
        )}

        {resetStep === 'confirm2' && (
          <div className="text-center">
            <div className="inline-flex p-4 rounded-2xl bg-red-500/20 mb-4">
              <AlertTriangle size={40} className="text-red-500 animate-pulse" />
            </div>
            <h3 className="text-lg font-bold text-red-500 mb-2">Ultima conferma!</h3>
            <p className="text-slate-400 text-sm mb-2">
              Stai per distruggere definitivamente:
            </p>
            <div className="glass-static rounded-xl p-3 mb-4 text-left text-sm space-y-1">
              <p className="text-red-400">- Wallet corrente e mnemonic</p>
              <p className="text-red-400">- Tutte le organizzazioni, strutture, liste locali</p>
              <p className="text-red-400">- Tutti gli assistiti e le assegnazioni locali</p>
              <p className="text-slate-500 text-xs mt-2">I dati sulla blockchain IOTA restano immutabili.</p>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setResetStep(null)}
                className="px-5 py-2.5 rounded-xl text-sm text-slate-400 hover:bg-white/5 transition-colors"
              >
                Annulla
              </button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleResetConfirm2}
                disabled={resetting}
                className="px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {resetting ? <LoadingSpinner size={16} /> : <Trash2 size={16} />}
                {resetting ? ' Resettando...' : ' DISTRUGGI E RICREA'}
              </motion.button>
            </div>
          </div>
        )}

        {resetStep === 'resetting' && (
          <div className="text-center py-8">
            <LoadingSpinner size={40} />
            <p className="text-slate-400 mt-4">Distruzione e reinizializzazione in corso...</p>
          </div>
        )}

        {resetStep === 'done' && resetResult && (
          <div>
            <div className="text-center mb-6">
              <div className="inline-flex p-4 rounded-2xl bg-neon-emerald/10 mb-4">
                <CheckCircle size={40} className="text-neon-emerald" />
              </div>
              <h3 className="text-lg font-bold mb-1">Nuovo Wallet Creato</h3>
              <p className="text-slate-400 text-sm">Indirizzo: <span className="font-mono text-neon-cyan text-xs">{resetResult.address}</span></p>
            </div>

            <div className="glass-static rounded-xl p-4 mb-4 border border-amber-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Key size={16} className="text-amber-500" />
                <p className="text-amber-500 text-xs font-semibold uppercase tracking-wider">Nuova Frase Segreta</p>
              </div>
              <p className="font-mono text-sm text-slate-200 leading-relaxed break-all">
                {resetResult.mnemonic}
              </p>
              <button
                onClick={copyMnemonic}
                className="mt-3 flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                {mnemonicCopied ? <CheckCircle size={14} className="text-neon-emerald" /> : <Copy size={14} />}
                {mnemonicCopied ? 'Copiata!' : 'Copia negli appunti'}
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-5 text-center">
              Conserva questa frase in un luogo sicuro. Non verra piu mostrata.
            </p>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleResetClose}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-purple text-white font-medium text-sm"
            >
              Ho salvato la frase, continua
            </motion.button>
          </div>
        )}
      </Modal>
    </div>
  );
}
