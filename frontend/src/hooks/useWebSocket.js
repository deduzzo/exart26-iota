import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export function useWebSocket(onMessage) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const socket = io('/', {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('blockchainUpdate', (data) => {
      setMessages((prev) => [...prev, data]);
      onMessage?.(data);
    });

    socket.on('operationProgress', (data) => {
      setMessages((prev) => [...prev, data]);
      onMessage?.(data);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return { connected, messages, socket: socketRef.current };
}
