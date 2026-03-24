import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import Sidebar from './Sidebar';
import Toast from './Toast';
import { getWalletInfo } from '../api/endpoints';

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
  const { toasts, addToast, dismissToast } = useToast();

  useEffect(() => {
    getWalletInfo()
      .then(setWallet)
      .catch(() => setWallet({ status: 'Offline', balance: '0', address: null }));
  }, []);

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

        {/* Page content */}
        <Outlet context={{ addToast }} />
      </motion.main>

      {/* Toast notifications */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
