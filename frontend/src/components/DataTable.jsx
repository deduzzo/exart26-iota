import { motion, AnimatePresence } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';

export default function DataTable({ columns, data, onRowClick, emptyMessage = 'Nessun dato', actions }) {
  // Traccia i key gia visti per evidenziare le nuove righe
  const seenKeys = useRef(new Set());
  const [newKeys, setNewKeys] = useState(new Set());
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (!data || data.length === 0) return;

    if (isFirstRender.current) {
      // Prima render: segna tutte come "viste"
      data.forEach((row, i) => seenKeys.current.add(row.id || row.timestamp || i));
      isFirstRender.current = false;
      return;
    }

    // Trova nuove righe
    const fresh = new Set();
    data.forEach((row, i) => {
      const key = row.id || row.timestamp || i;
      if (!seenKeys.current.has(key)) {
        fresh.add(key);
        seenKeys.current.add(key);
      }
    });

    if (fresh.size > 0) {
      setNewKeys(fresh);
      const timer = setTimeout(() => setNewKeys(new Set()), 2000);
      return () => clearTimeout(timer);
    }
  }, [data]);

  return (
    <div className="glass-static rounded-2xl overflow-hidden">
      {actions && (
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          {actions}
        </div>
      )}
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
            {(!data || data.length === 0) ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-8 text-center text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              <AnimatePresence mode="popLayout">
                {data.map((row, i) => {
                  const key = row.id || row.timestamp || i;
                  const isNew = newKeys.has(key);
                  return (
                    <motion.tr
                      key={key}
                      layout
                      initial={{ opacity: 0, x: -20, backgroundColor: 'rgba(0,229,255,0.15)' }}
                      animate={{
                        opacity: 1,
                        x: 0,
                        backgroundColor: isNew ? ['rgba(0,229,255,0.15)', 'rgba(0,229,255,0)', 'rgba(0,0,0,0)'] : 'rgba(0,0,0,0)',
                      }}
                      transition={{ duration: isNew ? 1.5 : 0.3, delay: isNew ? 0 : i * 0.02 }}
                      onClick={() => onRowClick?.(row)}
                      className={`border-b border-white/5 hover:bg-white/5 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                    >
                      {columns.map((col) => (
                        <td key={col.key} className="px-5 py-3.5 text-sm">
                          {col.render ? col.render(row[col.key], row) : row[col.key]}
                        </td>
                      ))}
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
