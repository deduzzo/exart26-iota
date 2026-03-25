import { useState, useEffect, useCallback } from 'react';
import { useRealtimeRefresh } from './useWebSocket';

export function useApi(fetcher, deps = [], realtimeEntities = null) {
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

  // Auto-refresh quando arriva un evento dataChanged via WebSocket
  // Se realtimeEntities non specificato, aggiorna su QUALSIASI cambiamento
  useRealtimeRefresh(reload, realtimeEntities);

  return { data, loading, error, reload, setData };
}
