// ============================================================
// src/api/axiosInstance.js — Shared Axios HTTP Client
//
// Instead of calling axios.get(...) directly in every component,
// we create ONE configured instance here and import it everywhere.
// This keeps auth headers and error handling in a single place.
// ============================================================

import axios from 'axios';

// Create an axios instance pre-configured with our backend's base URL.
// VITE_API_URL comes from the .env file (e.g. http://localhost:5000).
// If the env variable is missing, fall back to localhost:5000.
const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── REQUEST INTERCEPTOR ─────────────────────────────────────
// This function runs BEFORE every request is sent.
// We use it to automatically attach the JWT token so the user
// does not have to manually add it in every API call.
axiosInstance.interceptors.request.use(
  (config) => {
    // Read the saved token from browser localStorage
    const token = localStorage.getItem('authToken');

    if (token) {
      // Attach the token as a Bearer token in the Authorization header.
      // The backend will read this header to identify the user.
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    return config; // Return the modified config so the request proceeds
  },
  (error) => {
    // If something goes wrong BEFORE the request is sent, reject the promise
    return Promise.reject(error);
  }
);

// ── RESPONSE INTERCEPTOR ────────────────────────────────────
// This function runs AFTER every response is received.
// We use it to handle authentication errors globally.
axiosInstance.interceptors.response.use(
  (response) => {
    // If the response is successful (2xx), just return it unchanged
    return response;
  },
  (error) => {
    // If the server returns 401 Unauthorized, the token is invalid/expired.
    // We clear local storage and redirect the user to the login page.
    if (error.response && error.response.status === 401) {
      console.warn('Session expired or unauthorized — redirecting to login.');

      // Remove the stale token from localStorage
      localStorage.removeItem('authToken');

      // Hard redirect to login page.
      // We use window.location.href instead of React Router's navigate()
      // because this interceptor lives outside React components.
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    // Always propagate the error so individual API calls can handle it too
    return Promise.reject(error);
  }
);

export default axiosInstance;
