// ============================================================
// src/context/SocketContext.jsx — Real-Time Socket.IO Context
//
// Manages a single Socket.IO connection for the whole app.
// The socket connects only when the user is authenticated
// (we need the JWT to authenticate the socket connection).
//
// Usage in any component:
//   import { useSocket } from '../context/SocketContext';
//   const { socket, connected } = useSocket();
//   socket.on('some:event', handler);
// ============================================================

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';

// Create the context object
const SocketContext = createContext(undefined);

// ── PROVIDER COMPONENT ──────────────────────────────────────
export function SocketProvider({ children }) {
  // Get authentication state from AuthContext
  const { token, isAuthenticated } = useAuth();

  // socket: the Socket.IO client instance (or null when disconnected)
  const [socket, setSocket] = useState(null);

  // connected: true when the socket is actively connected to the server
  const [connected, setConnected] = useState(false);

  // ── SOCKET LIFECYCLE ────────────────────────────────────────
  // This effect runs whenever authentication status changes.
  // If the user logs in  → create and connect the socket.
  // If the user logs out → disconnect and clean up the socket.
  useEffect(() => {
    // Only create a socket connection if the user is logged in
    if (isAuthenticated && token) {
      console.log('[Socket] User authenticated — connecting to Socket.IO server...');

      // Create a new Socket.IO client connection.
      // We send the JWT token in the auth object so the server can verify
      // who is connecting via socket middleware.
      const SOCKET_URL =
        import.meta.env.VITE_SOCKET_URL ||
        (import.meta.env.PROD ? 'https://smart-disaster-response-b2uq.onrender.com' : 'http://localhost:5000');

      const newSocket = io(SOCKET_URL, {
        auth: {
          token, // Server reads this in socket.handshake.auth.token
        },
        reconnectionAttempts: 5,   // Try to reconnect up to 5 times if the connection drops
        reconnectionDelay: 1000,   // Wait 1 second between each reconnection attempt
      });

      // ── EVENT: Successfully connected ────────────────────────
      newSocket.on('connect', () => {
        console.log('[Socket] Connected! Socket ID:', newSocket.id);
        setConnected(true);
      });

      // ── EVENT: Disconnected from server ──────────────────────
      newSocket.on('disconnect', (reason) => {
        console.log('[Socket] Disconnected. Reason:', reason);
        setConnected(false);
      });

      // ── EVENT: Connection error ───────────────────────────────
      newSocket.on('connect_error', (err) => {
        console.error('[Socket] Connection error:', err.message);
        // Note: Socket.IO will automatically retry based on reconnectionAttempts
      });

      // Save the socket instance in state so other components can use it
      setSocket(newSocket);

      // ── CLEANUP FUNCTION ─────────────────────────────────────
      // React calls this cleanup when:
      //   1. The component unmounts (app closes / navigates away)
      //   2. isAuthenticated or token changes (e.g. user logs out)
      // This prevents multiple stale socket connections from piling up.
      return () => {
        console.log('[Socket] Disconnecting and cleaning up socket...');
        newSocket.disconnect();
        setSocket(null);
        setConnected(false);
      };
    } else {
      // User is not authenticated — make sure no socket lingers
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setConnected(false);
      }
    }
    // We intentionally exclude `socket` from deps to avoid an infinite loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, token]);

  const contextValue = {
    socket,    // The Socket.IO instance; use socket.on() / socket.emit()
    connected, // Boolean: true when actively connected
    // Defensive forwarding helpers:
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

// ── CUSTOM HOOK ──────────────────────────────────────────────
export function useSocket() {
  const context = useContext(SocketContext);

  if (context === undefined) {
    throw new Error('useSocket() must be used inside a <SocketProvider>');
  }

  return context;
}

export default SocketContext;
