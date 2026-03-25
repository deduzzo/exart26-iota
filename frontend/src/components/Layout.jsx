import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import Sidebar from './Sidebar';
import Toast from './Toast';
import WalletInitModal from './WalletInitModal';
import { getWalletInfo, getSyncStatus } from '../api/endpoints';
import { Database } from 'lucide-react';

// Toast context - simple global state
let toastIdCounter = 0;

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'success') => {
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const dismissToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return { toasts, addToast, dismissToast };
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [showWalletInit, setShowWalletInit] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const { toasts, addToast, dismissToast } = useToast();

  const loadWallet = () => {
    setWalletLoading(true);
    getWalletInfo()
      .then((data) => {
        setWallet(data);
        setShowWalletInit(data.status === 'WALLET non inizializzato');
        setWalletLoading(false);
      })
      .catch(() => {
        setWallet({ status: 'Offline', balance: '0', address: null });
        setShowWalletInit(false);
        setWalletLoading(false);
      });
  };

  useEffect(() => { loadWallet(); }, []);

  // Polling sync status ogni 2 secondi
  useEffect(() => {
    let interval;
    const checkSync = async () => {
      try {
        const status = await getSyncStatus();
        setSyncStatus(status.syncing ? status.syncProgress : null);
        if (!status.syncing && interval) {
          loadWallet();
        }
      } catch {
        setSyncStatus({ status: 'Connessione al server...', total: 0, processed: 0 });
      }
    };
    checkSync();
    interval = setInterval(checkSync, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleWalletInitialized = () => {
    setShowWalletInit(false);
    loadWallet();
    addToast('Wallet inizializzato con successo!', 'success');
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

      <motion.main
        animate={{ marginLeft: collapsed ? 72 : 260 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="flex-1 p-6 min-w-0"
      >
        {/* Top bar */}
        <div className="flex items-center justify-between mb-8">
          <div />
          <div className="flex items-center gap-4">
            {wallet && (
              <div className="glass-static rounded-xl px-4 py-2 flex items-center gap-3 text-sm">
                <span className={`w-2 h-2 rounded-full ${
                  wallet.status === 'WALLET OK' ? 'bg-neon-emerald' : 'bg-amber-500'
                } animate-pulse`} />
                <span className="text-slate-400">{wallet.status}</span>
                {wallet.balance && (
                  <span className="text-neon-cyan font-mono text-xs">{wallet.balance}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sync banner */}
        {syncStatus && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-static rounded-xl p-3 mb-4 border border-neon-cyan/20 flex items-center gap-3"
          >
            <div className="shrink-0">
              <Database size={16} className="text-neon-cyan animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-neon-cyan font-medium">{syncStatus.status || 'Sincronizzazione blockchain...'}</p>
              {syncStatus.total > 0 && (
                <div className="mt-1.5">
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-neon-cyan to-neon-purple rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round((syncStatus.processed / syncStatus.total) * 100)}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {syncStatus.processed}/{syncStatus.total} | {syncStatus.organizzazioni || 0} org, {syncStatus.strutture || 0} str, {syncStatus.assistiti || 0} ass, {syncStatus.assistitiListe || 0} mov
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Page content */}
        <Outlet context={{ addToast }} />
      </motion.main>

      {/* Wallet init modal - shown on every page if wallet not initialized */}
      <WalletInitModal
        open={!walletLoading && showWalletInit}
        onInitialized={handleWalletInitialized}
      />

      {/* Toast notifications */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
