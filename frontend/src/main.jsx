// ============================================================
// src/main.jsx — Application Entry Point
// This is the first file Vite loads. It mounts the React app
// into the <div id="root"> in index.html.
// ============================================================

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';

// Import global CSS styles (resets, fonts, shared utilities)
import './styles/app.css';

// Find the #root div in index.html and mount the React application
ReactDOM.createRoot(document.getElementById('root')).render(
  // StrictMode helps catch common bugs during development
  // (it double-invokes some functions in dev mode only — this is intentional)
  <React.StrictMode>
    {/*
      BrowserRouter — enables client-side routing with the HTML5 History API.
      Must wrap everything that uses <Routes>, <Link>, useNavigate, etc.
    */}
    <BrowserRouter>
      {/*
        AuthProvider — provides login/logout state to the whole app.
        Any component can call useAuth() to get user info.
      */}
      <AuthProvider>
        {/*
          SocketProvider — manages the Socket.IO real-time connection.
          It sits inside AuthProvider so it can read the auth token.
          Any component can call useSocket() to get the socket instance.
        */}
        <SocketProvider>
          <App />
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
