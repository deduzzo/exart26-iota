import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';

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
