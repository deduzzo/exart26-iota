# WS2: Frontend React + Vite + TailwindCSS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Riscrivere completamente il frontend dell'applicazione ExArt26-IOTA con React, Vite e TailwindCSS, design futuristico dark mode con glassmorphism e neon gradients.

**Architecture:** SPA React servita da Vite in sviluppo (porta 5173) con proxy verso Sails.js (porta 1337). In produzione, la build viene servita come file statici. Comunicazione con backend via REST API JSON + WebSocket (Socket.io).

**Tech Stack:** React 19, Vite 6, TailwindCSS 4, Framer Motion 12, React Router 7, Socket.io Client 4, Lucide React (icone)

**Spec di riferimento:** `docs/superpowers/specs/2026-03-24-iota2-ui-migration-design.md`

---

### API Backend disponibili

| Metodo | Endpoint | Input | Output |
|--------|----------|-------|--------|
| GET | `/api/v1/wallet/get-info` | - | `{ status, balance, address, error? }` |
| GET | `/api/v1/get-transaction` | `accountName, transactionId` | `{ transaction }` |
| POST | `/api/v1/add-organizzazione` | `{ denominazione }` | organizzazione obj |
| POST | `/api/v1/add-struttura` | `{ denominazione, indirizzo, organizzazione, attiva? }` | struttura obj |
| POST | `/api/v1/add-lista` | `{ denominazione, struttura }` | lista obj |
| POST | `/api/v1/add-assistito` | `{ nome, cognome, codiceFiscale, dataNascita?, email?, telefono?, indirizzo? }` | assistito obj (WebSocket feedback) |
| POST | `/api/v1/add-assistito-in-lista` | `{ idAssistito, idLista }` | transaction results |
| POST | `/api/v1/fetch-db-from-blockchain` | - | `{ error, dataImported }` |
| POST | `/api/v1/recover-from-arweave` | `{ dataType?, entityId? }` | `{ success, source, message }` |
| GET | `/csrfToken` | - | `{ _csrf }` |

Nota: i controller view-* (view-dashboard, view-organizzazioni, etc.) restituiscono dati con template EJS. Per la SPA serviranno nuove API JSON equivalenti. Questi verranno creati come task separati nel backend durante WS3 (Integrazione).

Per ora il frontend usa le API POST gia esistenti + chiama i view controller e parsa i dati da `window.SAILS_LOCALS` come fallback provvisorio, oppure meglio: creiamo subito le API GET JSON necessarie.

---

### Task 1: Scaffold progetto Vite + React + TailwindCSS

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.js`
- Create: `frontend/index.html`
- Create: `frontend/postcss.config.js`
- Create: `frontend/src/main.jsx`
- Create: `frontend/src/App.jsx`
- Create: `frontend/src/index.css`
- Create: `frontend/.gitignore`

- [ ] **Step 1: Creare la directory e inizializzare il progetto**

```bash
cd /Users/deduzzo/dev/exart26-iota
mkdir -p frontend/src frontend/public
```

- [ ] **Step 2: Creare package.json**

```json
{
  "name": "exart26-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0",
    "framer-motion": "^12.0.0",
    "socket.io-client": "^4.7.0",
    "lucide-react": "^0.400.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^6.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "tailwindcss": "^4.0.0"
  }
}
```

- [ ] **Step 3: Creare vite.config.js**

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:1337',
      '/csrfToken': 'http://localhost:1337',
      '/socket.io': {
        target: 'http://localhost:1337',
        ws: true,
      },
    },
  },
  build: {
    outDir: '../.tmp/public',
    emptyOutDir: true,
  },
});
```

- [ ] **Step 4: Creare index.html**

```html
<!DOCTYPE html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ExArt26 IOTA</title>
    <link rel="icon" type="image/svg+xml" href="/icons/favicon.svg" />
  </head>
  <body class="bg-[#0a0a1a] text-slate-100">
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Creare src/index.css**

```css
@import "tailwindcss";

@theme {
  --color-neon-cyan: #06b6d4;
  --color-neon-purple: #8b5cf6;
  --color-neon-emerald: #10b981;
  --color-surface: rgba(255, 255, 255, 0.05);
  --color-surface-hover: rgba(255, 255, 255, 0.1);
  --color-border: rgba(255, 255, 255, 0.1);
}

body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  background: linear-gradient(135deg, #0a0a1a 0%, #111827 50%, #0a0a1a 100%);
  min-height: 100vh;
}

.glass {
  background: var(--color-surface);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--color-border);
}

.glass:hover {
  background: var(--color-surface-hover);
}

.neon-glow {
  box-shadow: 0 0 15px rgba(6, 182, 212, 0.3), 0 0 30px rgba(6, 182, 212, 0.1);
}

.neon-text {
  text-shadow: 0 0 10px rgba(6, 182, 212, 0.5);
}
```

- [ ] **Step 6: Creare src/main.jsx**

```jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 7: Creare src/App.jsx (placeholder)**

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen">
        <h1 className="text-4xl font-bold text-center pt-20 neon-text">
          ExArt26 IOTA
        </h1>
        <p className="text-center text-slate-400 mt-4">Frontend in costruzione...</p>
      </div>
    </BrowserRouter>
  );
}

export default App;
```

- [ ] **Step 8: Creare frontend/.gitignore**

```
node_modules
dist
.vite
```

- [ ] **Step 9: Installare le dipendenze e verificare**

```bash
cd frontend && npm install && npm run dev &
sleep 5
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/
# Expected: 200
kill %1
```

- [ ] **Step 10: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): scaffold React + Vite + TailwindCSS"
```

---

### Task 2: API Client e CSRF

**Files:**
- Create: `frontend/src/api/client.js`
- Create: `frontend/src/api/endpoints.js`

- [ ] **Step 1: Creare client.js con gestione CSRF**

```javascript
let csrfToken = null;

async function fetchCsrf() {
  if (csrfToken) return csrfToken;
  const res = await fetch('/csrfToken');
  const data = await res.json();
  csrfToken = data._csrf;
  return csrfToken;
}

export async function api(url, options = {}) {
  const { method = 'GET', body, ...rest } = options;

  const headers = { 'Content-Type': 'application/json', ...rest.headers };

  if (method !== 'GET') {
    headers['X-CSRF-Token'] = await fetchCsrf();
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    ...rest,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.json();
}

export function resetCsrf() {
  csrfToken = null;
}
```

- [ ] **Step 2: Creare endpoints.js**

```javascript
import { api } from './client';

// Wallet
export const getWalletInfo = () => api('/api/v1/wallet/get-info');
export const initWallet = () => api('/wallet/verifica?initWallet=true');

// Dashboard data
export const getDashboardData = () => api('/api/v1/dashboard');

// Organizzazioni
export const getOrganizzazioni = () => api('/api/v1/organizzazioni');
export const getOrganizzazione = (id) => api(`/api/v1/organizzazioni/${id}`);
export const addOrganizzazione = (denominazione) =>
  api('/api/v1/add-organizzazione', { method: 'POST', body: { denominazione } });

// Strutture
export const getStrutture = (idOrg) =>
  api(`/api/v1/strutture${idOrg ? `?organizzazione=${idOrg}` : ''}`);
export const addStruttura = (data) =>
  api('/api/v1/add-struttura', { method: 'POST', body: data });

// Liste
export const addLista = (data) =>
  api('/api/v1/add-lista', { method: 'POST', body: data });

// Assistiti
export const getAssistiti = () => api('/api/v1/assistiti');
export const getAssistito = (id) => api(`/api/v1/assistiti/${id}`);
export const addAssistito = (data) =>
  api('/api/v1/add-assistito', { method: 'POST', body: data });

// Liste + Assistiti
export const addAssistitoInLista = (idAssistito, idLista) =>
  api('/api/v1/add-assistito-in-lista', { method: 'POST', body: { idAssistito, idLista } });

// Admin
export const fetchDbFromBlockchain = () =>
  api('/api/v1/fetch-db-from-blockchain', { method: 'POST' });
export const recoverFromArweave = () =>
  api('/api/v1/recover-from-arweave', { method: 'POST' });
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/
git commit -m "feat(frontend): API client con gestione CSRF"
```

---

### Task 3: Layout principale e Sidebar

**Files:**
- Create: `frontend/src/components/Layout.jsx`
- Create: `frontend/src/components/Sidebar.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Creare Sidebar.jsx**

```jsx
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Building2, Hospital, Users, Wallet,
  ChevronLeft, ChevronRight, Menu
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', group: 'Principale' },
  { to: '/organizzazioni', icon: Building2, label: 'Organizzazioni', group: 'Gestione' },
  { to: '/strutture', icon: Hospital, label: 'Strutture', group: 'Gestione' },
  { to: '/assistiti', icon: Users, label: 'Assistiti', group: 'Gestione' },
  { to: '/wallet', icon: Wallet, label: 'Wallet', group: 'Blockchain' },
];

export default function Sidebar({ collapsed, onToggle }) {
  let currentGroup = '';

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="fixed left-0 top-0 h-screen glass border-r border-white/10 z-50 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-lg font-bold bg-gradient-to-r from-neon-cyan to-neon-purple bg-clip-text text-transparent"
            >
              ExArt26
            </motion.span>
          )}
        </AnimatePresence>
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
    </motion.aside>
  );
}
```

- [ ] **Step 2: Creare Layout.jsx**

```jsx
import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import Sidebar from './Sidebar';
import { getWalletInfo } from '../api/endpoints';

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [wallet, setWallet] = useState(null);

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
        className="flex-1 p-6"
      >
        {/* Top bar */}
        <div className="flex items-center justify-between mb-8">
          <div />
          <div className="flex items-center gap-4">
            {wallet && (
              <div className="glass rounded-xl px-4 py-2 flex items-center gap-3 text-sm">
                <span className={`w-2 h-2 rounded-full ${
                  wallet.status === 'WALLET OK' ? 'bg-neon-emerald' : 'bg-amber-500'
                }`} />
                <span className="text-slate-400">{wallet.status}</span>
                {wallet.balance && (
                  <span className="text-neon-cyan font-mono text-xs">{wallet.balance}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Page content */}
        <Outlet />
      </motion.main>
    </div>
  );
}
```

- [ ] **Step 3: Aggiornare App.jsx con Layout e Route**

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';

// Placeholder pages
const Placeholder = ({ title }) => (
  <div>
    <h2 className="text-2xl font-bold mb-4">{title}</h2>
    <div className="glass rounded-2xl p-8 text-slate-400">In costruzione...</div>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Placeholder title="Dashboard" />} />
          <Route path="organizzazioni" element={<Placeholder title="Organizzazioni" />} />
          <Route path="strutture" element={<Placeholder title="Strutture" />} />
          <Route path="assistiti" element={<Placeholder title="Assistiti" />} />
          <Route path="wallet" element={<Placeholder title="Wallet" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

- [ ] **Step 4: Verificare che funziona**

```bash
cd frontend && npm run dev &
sleep 3
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/
# Expected: 200
kill %1
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ frontend/src/App.jsx
git commit -m "feat(frontend): layout con sidebar glassmorphism e navigazione"
```

---

### Task 4: Componenti riutilizzabili (StatsCard, DataTable, Modal, Toast)

**Files:**
- Create: `frontend/src/components/StatsCard.jsx`
- Create: `frontend/src/components/DataTable.jsx`
- Create: `frontend/src/components/Modal.jsx`
- Create: `frontend/src/components/Toast.jsx`
- Create: `frontend/src/components/StatusBadge.jsx`
- Create: `frontend/src/components/LoadingSpinner.jsx`
- Create: `frontend/src/hooks/useApi.js`

- [ ] **Step 1: Creare StatsCard.jsx**

```jsx
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect } from 'react';

function Counter({ from = 0, to }) {
  const count = useMotionValue(from);
  const rounded = useTransform(count, (v) => Math.round(v));

  useEffect(() => {
    const controls = animate(count, to, { duration: 1.5, ease: 'easeOut' });
    return controls.stop;
  }, [to]);

  return <motion.span>{rounded}</motion.span>;
}

export default function StatsCard({ icon: Icon, label, value, color = 'cyan' }) {
  const colorMap = {
    cyan: 'from-neon-cyan/20 to-neon-cyan/5 text-neon-cyan',
    purple: 'from-neon-purple/20 to-neon-purple/5 text-neon-purple',
    emerald: 'from-neon-emerald/20 to-neon-emerald/5 text-neon-emerald',
    amber: 'from-amber-500/20 to-amber-500/5 text-amber-500',
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      className="glass rounded-2xl p-5 cursor-default"
    >
      <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${colorMap[color]} mb-3`}>
        <Icon size={22} />
      </div>
      <p className="text-slate-400 text-sm">{label}</p>
      <p className="text-2xl font-bold mt-1">
        <Counter to={typeof value === 'number' ? value : 0} />
      </p>
    </motion.div>
  );
}
```

- [ ] **Step 2: Creare DataTable.jsx**

```jsx
import { motion } from 'framer-motion';

export default function DataTable({ columns, data, onRowClick, emptyMessage = 'Nessun dato' }) {
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              {columns.map((col) => (
                <th key={col.key} className="text-left px-5 py-3 text-xs uppercase tracking-wider text-slate-500 font-medium">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-8 text-center text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <motion.tr
                  key={row.id || i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => onRowClick?.(row)}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-5 py-3.5 text-sm">
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Creare Modal.jsx**

```jsx
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 flex items-center justify-center z-[70] p-4"
          >
            <div className="glass rounded-2xl w-full max-w-lg border border-white/10">
              <div className="flex items-center justify-between p-5 border-b border-white/10">
                <h3 className="text-lg font-semibold">{title}</h3>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                  <X size={18} />
                </button>
              </div>
              <div className="p-5">{children}</div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 4: Creare Toast.jsx, StatusBadge.jsx, LoadingSpinner.jsx**

`Toast.jsx`:
```jsx
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
              className={`glass rounded-xl px-4 py-3 flex items-center gap-3 border ${colors[t.type]} min-w-[300px]`}
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
```

`StatusBadge.jsx`:
```jsx
export default function StatusBadge({ status }) {
  const map = {
    1: { label: 'In coda', color: 'bg-neon-cyan/20 text-neon-cyan' },
    2: { label: 'In assistenza', color: 'bg-amber-500/20 text-amber-500' },
    3: { label: 'Completato', color: 'bg-neon-emerald/20 text-neon-emerald' },
    4: { label: 'Cambio lista', color: 'bg-slate-500/20 text-slate-400' },
    5: { label: 'Rinuncia', color: 'bg-red-500/20 text-red-400' },
    6: { label: 'Annullato', color: 'bg-slate-700/20 text-slate-500' },
  };
  const s = map[status] || { label: '?', color: 'bg-slate-500/20 text-slate-400' };
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium ${s.color}`}>
      {s.label}
    </span>
  );
}
```

`LoadingSpinner.jsx`:
```jsx
import { motion } from 'framer-motion';

export default function LoadingSpinner({ size = 24 }) {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      style={{ width: size, height: size }}
      className="border-2 border-neon-cyan/20 border-t-neon-cyan rounded-full"
    />
  );
}
```

- [ ] **Step 5: Creare hooks/useApi.js**

```javascript
import { useState, useEffect, useCallback } from 'react';

export function useApi(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      setError(err.message || 'Errore');
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => { reload(); }, [reload]);

  return { data, loading, error, reload };
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ frontend/src/hooks/
git commit -m "feat(frontend): componenti riutilizzabili (StatsCard, DataTable, Modal, Toast)"
```

---

### Task 5: Pagina Dashboard

**Files:**
- Create: `frontend/src/pages/Dashboard.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Creare Dashboard.jsx**

```jsx
import { motion } from 'framer-motion';
import { Building2, Hospital, FileText, Users, Wallet, Database } from 'lucide-react';
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
  { key: 'assistitoNome', label: 'Assistito', render: (_, row) => row.assistitoNome || `ID: ${row.assistito}` },
  { key: 'listaNome', label: 'Lista', render: (_, row) => row.listaNome || '-' },
  { key: 'stato', label: 'Stato', render: (v) => <StatusBadge status={v} /> },
  { key: 'dataOraIngresso', label: 'Data', render: (v) => v ? new Date(v).toLocaleDateString('it-IT') : '-' },
];

export default function Dashboard() {
  const { data: dashboard, loading } = useApi(getDashboardData);
  const { data: wallet } = useApi(getWalletInfo);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner size={40} />
    </div>
  );

  const stats = dashboard?.stats || {};

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
      <p className="text-slate-400 mb-8">Panoramica del sistema</p>

      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <motion.div variants={item}><StatsCard icon={Building2} label="Organizzazioni" value={stats.organizzazioni} color="purple" /></motion.div>
        <motion.div variants={item}><StatsCard icon={Hospital} label="Strutture" value={stats.strutture} color="cyan" /></motion.div>
        <motion.div variants={item}><StatsCard icon={FileText} label="Liste d'Attesa" value={stats.liste} color="emerald" /></motion.div>
        <motion.div variants={item}><StatsCard icon={Users} label="Assistiti" value={stats.assistiti} color="amber" /></motion.div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stato Blockchain */}
        <motion.div variants={item} initial="hidden" animate="show" className="glass rounded-2xl p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Wallet size={18} className="text-neon-cyan" /> Stato Blockchain
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Wallet</span>
              <span className={wallet?.status === 'WALLET OK' ? 'text-neon-emerald' : 'text-amber-500'}>
                {wallet?.status || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Saldo</span>
              <span className="font-mono text-neon-cyan">{wallet?.balance || '0'}</span>
            </div>
            {dashboard?.arweaveStatus && (
              <div className="flex justify-between">
                <span className="text-slate-400">Arweave</span>
                <span className={dashboard.arweaveStatus.enabled ? 'text-neon-emerald' : 'text-slate-500'}>
                  {dashboard.arweaveStatus.enabled ? 'Attivo' : 'Non configurato'}
                </span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Ultime Operazioni */}
        <motion.div variants={item} initial="hidden" animate="show" className="lg:col-span-2">
          <h3 className="font-semibold mb-4">Ultime Operazioni</h3>
          <DataTable
            columns={operazioniColumns}
            data={dashboard?.ultimeOperazioni || []}
            emptyMessage="Nessuna operazione registrata"
          />
        </motion.div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Aggiornare App.jsx con la pagina Dashboard**

Sostituire il placeholder `<Placeholder title="Dashboard" />` con `<Dashboard />` importando da `./pages/Dashboard`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Dashboard.jsx frontend/src/App.jsx
git commit -m "feat(frontend): pagina Dashboard con stats animate e stato blockchain"
```

---

### Task 6: Pagina Organizzazioni (CRUD)

**Files:**
- Create: `frontend/src/pages/Organizzazioni.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Creare Organizzazioni.jsx con lista + modale creazione**

Componente con:
- DataTable con colonne: `denominazione`, `strutture` (count), `publicKey` (troncata)
- Bottone "Nuova Organizzazione" che apre Modal
- Form nel modal: campo `denominazione` (validazione minLength 2)
- Chiama `addOrganizzazione()` e mostra Toast successo/errore
- Reload dati dopo creazione

- [ ] **Step 2: Aggiornare App.jsx**

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Organizzazioni.jsx frontend/src/App.jsx
git commit -m "feat(frontend): pagina Organizzazioni con CRUD"
```

---

### Task 7: Pagina Strutture (CRUD con filtro)

**Files:**
- Create: `frontend/src/pages/Strutture.jsx`

- [ ] **Step 1: Creare Strutture.jsx**

Componente con:
- Filtro per organizzazione (dropdown)
- DataTable: `denominazione`, `indirizzo`, `organizzazione`, `attiva`, `liste` (count)
- Modal creazione: `denominazione`, `indirizzo`, `organizzazione` (select), `attiva` (toggle)

- [ ] **Step 2: Commit**

---

### Task 8: Pagina Assistiti (CRUD + ricerca)

**Files:**
- Create: `frontend/src/pages/Assistiti.jsx`

- [ ] **Step 1: Creare Assistiti.jsx**

Componente con:
- Campo ricerca (filtra per nome, cognome, codice fiscale)
- DataTable: `cognome`, `nome`, `codiceFiscale`, `email`
- Modal creazione: tutti i campi (nome, cognome, codiceFiscale con validazione regex, dataNascita, email, telefono, indirizzo)

- [ ] **Step 2: Commit**

---

### Task 9: Pagina Wallet

**Files:**
- Create: `frontend/src/pages/Wallet.jsx`

- [ ] **Step 1: Creare Wallet.jsx**

Componente con:
- Card stato wallet (inizializzato/non inizializzato)
- Se non inizializzato: bottone "Inizializza Wallet"
- Se inizializzato: indirizzo, saldo, link explorer
- Card stato Arweave
- Sezione admin: bottoni "Sync da Blockchain" e "Recovery da Arweave" con feedback

- [ ] **Step 2: Commit**

---

### Task 10: Collegare tutte le pagine in App.jsx + PWA manifest

**Files:**
- Modify: `frontend/src/App.jsx`
- Create: `frontend/public/manifest.json`
- Create: `frontend/public/icons/favicon.svg`

- [ ] **Step 1: App.jsx finale con tutte le pagine importate**

- [ ] **Step 2: Creare manifest.json per PWA**

```json
{
  "name": "ExArt26 IOTA",
  "short_name": "ExArt26",
  "description": "Gestione liste d'attesa decentralizzata",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a1a",
  "theme_color": "#06b6d4",
  "icons": [
    { "src": "/icons/favicon.svg", "sizes": "any", "type": "image/svg+xml" }
  ]
}
```

- [ ] **Step 3: Commit finale frontend**

```bash
git add frontend/
git commit -m "feat(frontend): tutte le pagine + PWA manifest"
```
