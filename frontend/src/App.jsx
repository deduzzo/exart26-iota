import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Organizzazioni from './pages/Organizzazioni';
import Strutture from './pages/Strutture';
import Assistiti from './pages/Assistiti';
import Liste from './pages/Liste';
import Wallet from './pages/Wallet';
import Grafo from './pages/Grafo';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="organizzazioni" element={<Organizzazioni />} />
          <Route path="strutture" element={<Strutture />} />
          <Route path="assistiti" element={<Assistiti />} />
          <Route path="liste" element={<Liste />} />
          <Route path="wallet" element={<Wallet />} />
          <Route path="grafo" element={<Grafo />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
