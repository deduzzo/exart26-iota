import { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';

// Singleton socket: una sola connessione per tutta l'app
let _socket = null;
let _listeners = new Set();

function getSocket() {
  if (!_socket) {
    // socket.io v2 client compatibile con Sails.js (server socket.io v2)
    _socket = io('/', {
      transports: ['websocket', 'polling'],
    });
    _socket.on('connect', () => {
      console.log('[ws] Connesso:', _socket.id);
    });
    _socket.on('disconnect', () => {
      console.log('[ws] Disconnesso');
    });
    _socket.on('connect_error', (err) => {
      console.log('[ws] Errore connessione:', err.message || err);
    });
    // Relay dataChanged a tutti i listener registrati
    _socket.on('dataChanged', (data) => {
      console.log('[ws] dataChanged:', data?.action, data?.label);
      _listeners.forEach(fn => fn(data));
    });
  }
  return _socket;
}

/**
 * Hook base per WebSocket. Ascolta eventi e gestisce connessione.
 */
export function useWebSocket(onMessage) {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    setConnected(socket.connected);

    const handler = (data) => {
      setMessages(prev => [...prev.slice(-49), data]);
      onMessage?.(data);
    };
    _listeners.add(handler);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      _listeners.delete(handler);
    };
  }, []);

  return { connected, messages, socket: getSocket() };
}

/**
 * Hook per auto-refresh: ricarica i dati quando arriva un evento dataChanged.
 * Usalo in ogni pagina: useRealtimeRefresh(reload)
 * Opzionale: filtra per entity type.
 */
export function useRealtimeRefresh(reloadFn, filterEntities = null) {
  const reloadRef = useRef(reloadFn);
  reloadRef.current = reloadFn;

  useEffect(() => {
    getSocket(); // Assicura connessione

    const handler = (data) => {
      if (filterEntities && !filterEntities.includes(data.entity)) return;
      clearTimeout(handler._timer);
      handler._timer = setTimeout(() => {
        reloadRef.current?.();
      }, 300);
    };

    _listeners.add(handler);
    return () => {
      clearTimeout(handler._timer);
      _listeners.delete(handler);
    };
  }, [filterEntities?.join?.(',')]);
}
