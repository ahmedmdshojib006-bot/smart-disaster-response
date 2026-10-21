import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext(undefined);

export function SocketProvider({ children }) {
  const { token, isAuthenticated } = useAuth();

  const [socket, setSocket] = useState(null);

  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (isAuthenticated && token) {
      console.log('[Socket] User authenticated — connecting to Socket.IO server...');

      const SOCKET_URL =
        import.meta.env.VITE_SOCKET_URL ||
        (import.meta.env.PROD ? 'https://smart-disaster-response-b2uq.onrender.com' : 'http://localhost:5000');

      const newSocket = io(SOCKET_URL, {
        auth: {
          token, 
        },
        reconnectionAttempts: 5,   
        reconnectionDelay: 1000,   
      });

      newSocket.on('connect', () => {
        console.log('[Socket] Connected! Socket ID:', newSocket.id);
        setConnected(true);
      });

      newSocket.on('disconnect', (reason) => {
        console.log('[Socket] Disconnected. Reason:', reason);
        setConnected(false);
      });

      newSocket.on('connect_error', (err) => {
        console.error('[Socket] Connection error:', err.message);
      });

      setSocket(newSocket);

      return () => {
        console.log('[Socket] Disconnecting and cleaning up socket...');
        newSocket.disconnect();
        setSocket(null);
        setConnected(false);
      };
    } else {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setConnected(false);
      }
    }
  }, [isAuthenticated, token]);

  const contextValue = {
    socket,    
    connected, 
    on: (...args) => socket?.on(...args),
    off: (...args) => socket?.off(...args),
    emit: (...args) => socket?.emit(...args),
  };

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);

  if (context === undefined) {
    throw new Error('useSocket() must be used inside a <SocketProvider>');
  }

  return context;
}

export default SocketContext;
