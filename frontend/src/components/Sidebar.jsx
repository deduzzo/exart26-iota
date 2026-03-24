import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Building2, Hospital, Users, Wallet,
  Network, ChevronLeft, ChevronRight, FileText, Bug, Globe, Zap
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', group: 'Principale' },
  { to: '/pubblico', icon: Globe, label: 'Pubblico', group: 'Principale' },
  { to: '/organizzazioni', icon: Building2, label: 'Organizzazioni', group: 'Gestione' },
  { to: '/strutture', icon: Hospital, label: 'Strutture', group: 'Gestione' },
  { to: '/liste', icon: FileText, label: 'Liste d\'Attesa', group: 'Gestione' },
  { to: '/assistiti', icon: Users, label: 'Assistiti', group: 'Gestione' },
  { to: '/grafo', icon: Network, label: 'Grafo', group: 'Visualizzazione' },
  { to: '/wallet', icon: Wallet, label: 'Wallet', group: 'Blockchain' },
  { to: '/load-test', icon: Zap, label: 'Load Test', group: 'Sviluppo' },
  { to: '/debug', icon: Bug, label: 'Debug', group: 'Sviluppo' },
];

export default function Sidebar({ collapsed, onToggle }) {
  let currentGroup = '';

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="fixed left-0 top-0 h-screen glass-static border-r border-white/10 z-50 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon-cyan to-neon-purple flex items-center justify-center">
                <span className="text-white font-bold text-sm">E</span>
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-neon-cyan to-neon-purple bg-clip-text text-transparent">
                ExArt26
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon-cyan to-neon-purple flex items-center justify-center mx-auto">
            <span className="text-white font-bold text-sm">E</span>
          </div>
        )}
        <button onClick={onToggle} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {navItems.map((item) => {
          const showGroup = item.group !== currentGroup;
          if (showGroup) currentGroup = item.group;
          return (
            <div key={item.to}>
              {showGroup && !collapsed && (
                <p className="px-4 pt-4 pb-1 text-xs uppercase tracking-wider text-slate-500">
                  {item.group}
                </p>
              )}
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 mx-2 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-neon-cyan/10 text-neon-cyan neon-glow'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`
                }
              >
                <item.icon size={20} className="shrink-0" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      className="whitespace-nowrap text-sm font-medium"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </NavLink>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 border-t border-white/10"
        >
          <p className="text-xs text-slate-600 text-center">
            IOTA Blockchain
          </p>
        </motion.div>
      )}
    </motion.aside>
  );
}
