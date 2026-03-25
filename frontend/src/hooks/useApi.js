import { useState, useEffect, useCallback, useRef } from 'react';
import { useRealtimeRefresh } from './useWebSocket';

export function useApi(fetcher, deps = [], realtimeEntities = null) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isFirstLoad = useRef(true);

  const reload = useCallback(async () => {
    // Solo il primo caricamento mostra il loading spinner
    if (isFirstLoad.current) setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
      isFirstLoad.current = false;
    } catch (err) {
      setError(err.message || 'Errore');
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => { reload(); }, [reload]);

  // Auto-refresh silenzioso su dataChanged (no loading spinner)
  useRealtimeRefresh(reload, realtimeEntities);

  return { data, loading, error, reload, setData };
}
