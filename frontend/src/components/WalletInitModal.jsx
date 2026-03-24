import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Zap, Copy, CheckCircle, Key } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import { initWallet } from '../api/endpoints';

export default function WalletInitModal({ open, onInitialized }) {
  const [initializing, setInitializing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleInit = async () => {
    setInitializing(true);
    setError(null);
    try {
      const res = await initWallet();
      if (res.success) {
        setResult(res);
        if (res.alreadyInitialized) {
          setTimeout(() => onInitialized(), 1000);
        }
      } else {
        setError(res.error || 'Errore sconosciuto');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setInitializing(false);
    }
  };

  const copyMnemonic = () => {
    if (result?.mnemonic) {
      navigator.clipboard.writeText(result.mnemonic);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleContinue = () => {
    onInitialized();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-[60]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            className="fixed inset-0 flex items-center justify-center z-[70] p-4"
          >
            <div className="glass rounded-2xl w-full max-w-md border border-white/10">
              {!result ? (
                /* Step 1: Init prompt */
                <div className="p-8 text-center">
                  <div className="inline-flex p-4 rounded-2xl bg-amber-500/10 mb-5">
                    <AlertTriangle size={40} className="text-amber-500" />
                  </div>
                  <h2 className="text-xl font-bold mb-2">Wallet Non Inizializzato</h2>
                  <p className="text-slate-400 text-sm mb-6">
                    Per utilizzare l'applicazione e necessario inizializzare il wallet IOTA.
                    Verra generata una frase segreta (mnemonic) e richiesti fondi dal faucet testnet.
                  </p>

                  {error && (
                    <div className="glass rounded-xl p-3 mb-4 border border-red-500/20 text-red-400 text-sm">
                      {error}
                    </div>
                  )}

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleInit}
                    disabled={initializing}
                    className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-purple text-white font-medium disabled:opacity-50"
                  >
                    {initializing ? (
                      <>
                        <LoadingSpinner size={18} />
                        Inizializzazione in corso...
                      </>
                    ) : (
                      <>
                        <Zap size={18} />
                        Inizializza Wallet
                      </>
                    )}
                  </motion.button>
                </div>
              ) : result.alreadyInitialized ? (
                /* Already initialized */
                <div className="p-8 text-center">
                  <div className="inline-flex p-4 rounded-2xl bg-neon-emerald/10 mb-5">
                    <CheckCircle size={40} className="text-neon-emerald" />
                  </div>
                  <h2 className="text-xl font-bold mb-2">Wallet Gia Inizializzato</h2>
                  <p className="text-slate-400 text-sm">Reindirizzamento...</p>
                </div>
              ) : (
                /* Step 2: Show mnemonic */
                <div className="p-8">
                  <div className="text-center mb-6">
                    <div className="inline-flex p-4 rounded-2xl bg-neon-emerald/10 mb-4">
                      <CheckCircle size={40} className="text-neon-emerald" />
                    </div>
                    <h2 className="text-xl font-bold mb-1">Wallet Inizializzato!</h2>
                    <p className="text-slate-400 text-sm">Indirizzo: <span className="font-mono text-neon-cyan text-xs">{result.address}</span></p>
                  </div>

                  <div className="glass rounded-xl p-4 mb-4 border border-amber-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Key size={16} className="text-amber-500" />
                      <p className="text-amber-500 text-xs font-semibold uppercase tracking-wider">Frase Segreta - Conservala!</p>
                    </div>
                    <p className="font-mono text-sm text-slate-200 leading-relaxed break-all">
                      {result.mnemonic}
                    </p>
                    <button
                      onClick={copyMnemonic}
                      className="mt-3 flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      {copied ? <CheckCircle size={14} className="text-neon-emerald" /> : <Copy size={14} />}
                      {copied ? 'Copiata!' : 'Copia negli appunti'}
                    </button>
                  </div>

                  <p className="text-xs text-slate-500 mb-5 text-center">
                    Questa frase non verra piu mostrata. Conservala in un luogo sicuro.
                  </p>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleContinue}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-purple text-white font-medium text-sm"
                  >
                    Ho salvato la frase, continua
                  </motion.button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
