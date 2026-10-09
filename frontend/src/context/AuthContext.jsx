// ============================================================
// src/context/AuthContext.jsx — Authentication Context
//
// This file creates a React Context that stores the logged-in
// user's data and provides login/logout functions to every
// component in the app without prop drilling.
//
// Usage in any component:
//   import { useAuth } from '../context/AuthContext';
//   const { user, isAuthenticated, login, logout } = useAuth();
// ============================================================

import React, { createContext, useContext, useState, useEffect } from 'react';
import axiosInstance from '../api/axiosInstance.js';

// Create the context object. The default value is undefined because
// components must be wrapped in AuthProvider to use it.
const AuthContext = createContext(undefined);

// ── PROVIDER COMPONENT ──────────────────────────────────────
// Wrap your application in <AuthProvider> so all children can
// access auth state via the useAuth() hook.
export function AuthProvider({ children }) {
  // user: the logged-in user's profile object, or null if not logged in
  const [user, setUser] = useState(null);

  // token: the JWT string, stored in both state and localStorage
  const [token, setToken] = useState(null);

  // loading: true while we are checking if a saved token is still valid.
  // We start as true so the app shows a loading screen instead of
  // flashing the login page before the check completes.
  const [loading, setLoading] = useState(true);

  // ── ON MOUNT: Restore session from localStorage ─────────────
  // When the app first loads (or the page is refreshed), check if
  // the user already has a saved token and verify it with the server.
  useEffect(() => {
    const savedToken = localStorage.getItem('authToken');

    if (savedToken) {
      // Token exists — verify it with the backend before trusting it.
      // axiosInstance will automatically attach the token via its interceptor.
      axiosInstance
        .get('/api/auth/me')
        .then((response) => {
          // Token is valid — restore the user session
          setUser(response.data.user || response.data);
          setToken(savedToken);
        })
        .catch((err) => {
          // Token is invalid or expired — clear everything
          console.warn('Saved token invalid:', err.message);
          localStorage.removeItem('authToken');
          setUser(null);
          setToken(null);
        })
        .finally(() => {
          // Whether success or failure, we are done checking — hide the loading screen
          setLoading(false);
        });
    } else {
      // No saved token — user is definitely not logged in
      setLoading(false);
    }
  }, []); // Empty array = run only once when the component first mounts

  // ── LOGIN FUNCTION ───────────────────────────────────────────
  // Call this after a successful /api/auth/login response.
  // It saves the token and updates app state so all components
  // immediately know the user is authenticated.
  const login = (userData, authToken) => {
    // Persist the token in localStorage so it survives page refreshes
    localStorage.setItem('authToken', authToken);

    // Update React state so the UI re-renders
    setUser(userData);
    setToken(authToken);
  };

  // ── LOGOUT FUNCTION ──────────────────────────────────────────
  // Call this when the user clicks "Logout".
  // Clears all auth data from memory and localStorage.
  const logout = () => {
    localStorage.removeItem('authToken');
    setUser(null);
    setToken(null);
  };

  // ── CONTEXT VALUE ────────────────────────────────────────────
  // Everything inside this object is available to any component
  // that calls useAuth().
  const contextValue = {
    user,           // The user profile object (or null)
    token,          // The JWT string (or null)
    loading,        // True while checking saved session on startup
    login,          // Function: login(userData, token)
    logout,         // Function: logout()
    isAuthenticated: !!user, // Boolean shorthand: true if user exists
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// ── CUSTOM HOOK ──────────────────────────────────────────────
// useAuth() is a convenience wrapper so components don't need to
// import both useContext and AuthContext — just import useAuth.
export function useAuth() {
  const context = useContext(AuthContext);

  // If someone calls useAuth() outside of <AuthProvider>, warn them clearly
  if (context === undefined) {
    throw new Error('useAuth() must be used inside an <AuthProvider>');
  }

  return context;
}

export default AuthContext;
