import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertTriangle, XCircle, X } from 'lucide-react';

const icons = {
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
};
const colors = {
  success: 'border-neon-emerald/30 text-neon-emerald',
  warning: 'border-amber-500/30 text-amber-500',
  error: 'border-red-500/30 text-red-500',
};

export default function Toast({ toasts, onDismiss }) {
  return (
    <div className="fixed top-4 right-4 z-[80] flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = icons[t.type] || icons.success;
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              className={`glass-static rounded-xl px-4 py-3 flex items-center gap-3 border ${colors[t.type]} min-w-[300px]`}
            >
              <Icon size={18} />
              <span className="text-sm text-slate-200 flex-1">{t.message}</span>
              <button onClick={() => onDismiss(t.id)} className="hover:bg-white/10 rounded p-1">
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
