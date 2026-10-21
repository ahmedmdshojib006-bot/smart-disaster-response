import React, { createContext, useContext, useState, useEffect } from 'react';
import axiosInstance from '../api/axiosInstance.js';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const [token, setToken] = useState(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('authToken');

    if (savedToken) {
      axiosInstance
        .get('/api/auth/me')
        .then((response) => {
          setUser(response.data.user || response.data);
          setToken(savedToken);
        })
        .catch((err) => {
          console.warn('Saved token invalid:', err.message);
          localStorage.removeItem('authToken');
          setUser(null);
          setToken(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []); 

  const login = (userData, authToken) => {
    localStorage.setItem('authToken', authToken);

    setUser(userData);
    setToken(authToken);
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    setUser(null);
    setToken(null);
  };

  const contextValue = {
    user,           
    token,          
    loading,        
    login,          
    logout,         
    isAuthenticated: !!user, 
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth() must be used inside an <AuthProvider>');
  }

  return context;
}

export default AuthContext;
