import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Organizzazioni from './pages/Organizzazioni';
import Strutture from './pages/Strutture';
import Assistiti from './pages/Assistiti';
import Wallet from './pages/Wallet';

// Placeholder pages
const Placeholder = ({ title }) => (
  <div>
    <h2 className="text-2xl font-bold mb-4">{title}</h2>
    <div className="glass-static rounded-2xl p-8 text-slate-400">In costruzione...</div>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="organizzazioni" element={<Organizzazioni />} />
          <Route path="strutture" element={<Strutture />} />
          <Route path="assistiti" element={<Assistiti />} />
          <Route path="wallet" element={<Wallet />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
