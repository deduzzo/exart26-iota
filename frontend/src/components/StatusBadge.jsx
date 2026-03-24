export default function StatusBadge({ status }) {
  const map = {
    1: { label: 'In coda', color: 'bg-neon-cyan/20 text-neon-cyan' },
    2: { label: 'In assistenza', color: 'bg-amber-500/20 text-amber-500' },
    3: { label: 'Completato', color: 'bg-neon-emerald/20 text-neon-emerald' },
    4: { label: 'Cambio lista', color: 'bg-slate-500/20 text-slate-400' },
    5: { label: 'Rinuncia', color: 'bg-red-500/20 text-red-400' },
    6: { label: 'Annullato', color: 'bg-slate-700/20 text-slate-500' },
  };
  const s = map[status] || { label: status || '?', color: 'bg-slate-500/20 text-slate-400' };
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium ${s.color}`}>
      {s.label}
    </span>
  );
}
