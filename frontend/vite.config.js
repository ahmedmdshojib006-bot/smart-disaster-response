import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    // Dev server runs on port 3000 instead of Vite's default 5173
    port: 3000,

    // Proxy API requests to the backend during development.
    // This avoids browser CORS errors because from the browser's perspective
    // all requests go to localhost:3000 (same origin), and Vite forwards them
    // internally to the backend on port 5000.
    proxy: {
      // Any request starting with /api is forwarded to the backend
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true, // Changes the Host header to match the target
      },

      // Socket.IO uses WebSockets — ws:true enables WebSocket proxying
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,          // IMPORTANT: must be true for Socket.IO to work through proxy
        changeOrigin: true,
      },
    },
  },
});
