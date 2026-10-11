// server.js
// ─────────────────────────────────────────────────────────────────────────────
// Main entry point for the Smart Disaster Response Platform backend.
//
// Start-up sequence:
//   1. Load environment variables (.env)
//   2. Create Express app + HTTP server
//   3. Attach Socket.IO to the HTTP server
//   4. Register global middleware (CORS, JSON body parser)
//   5. Mount API routes
//   6. Register 404 and global error handlers
//   7. Connect to MongoDB
//   8. Start listening on the configured port
//   9. Initialise Socket.IO authentication + room logic
// ─────────────────────────────────────────────────────────────────────────────

// ── Load environment variables first — everything else depends on them ───────
require('dotenv').config();

const express = require('express');
const http = require('http');           // Node's built-in HTTP module
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');

// Internal modules
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const sosRoutes = require('./routes/sosRoutes');
const taskRoutes = require('./routes/taskRoutes');
const volunteerRoutes = require('./routes/volunteerRoutes');
const { initSocket } = require('./socket/socketHandler');

// ── Create the Express application ───────────────────────────────────────────
const app = express();

// ── Create an HTTP server that wraps the Express app ─────────────────────────
// We need a raw HTTP server (not just Express) so that Socket.IO can attach to
// the same port rather than needing a separate WebSocket server.
const httpServer = http.createServer(app);

// ── CORS Configuration ────────────────────────────────────────────────────────
// Allows requests from the React dev server, whether running on port 3000, 3001,
// or any other local port, as well as the configured CLIENT_ORIGIN.
const isAllowedOrigin = (origin) => {
  if (!origin) return true; // allow curl, Postman, server-to-server requests
  if (process.env.CLIENT_ORIGIN === '*' || !process.env.CLIENT_ORIGIN) return true;
  const allowed = [process.env.CLIENT_ORIGIN, 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];
  if (allowed.includes(origin)) return true;
  if (origin.endsWith('.vercel.app')) return true; // allow all Vercel deployments
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Blocked by CORS for origin: ${origin}`));
    }
  },
  credentials: true,
};

// ── Attach Socket.IO to the HTTP server ──────────────────────────────────────
const io = new Server(httpServer, {
  cors: corsOptions,
});

// Make `io` available anywhere you have access to the Express app.
// Usage in a controller: const io = req.app.get('io');
app.set('io', io);

// ── Global middleware ─────────────────────────────────────────────────────────

// CORS — allows the React frontend to make requests to this backend
app.use(cors(corsOptions));

// Parse incoming JSON request bodies (e.g. from fetch / axios)
app.use(express.json());

// Parse URL-encoded bodies (e.g. from HTML form submissions)
app.use(express.urlencoded({ extended: true }));

// Serve uploaded photos (SOS evidence/damage pictures)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── API Routes ────────────────────────────────────────────────────────────────

// Authentication: register, login, me, logout
app.use('/api/auth', authRoutes);

// Notifications: list, mark-read, mark-all-read
app.use('/api/notifications', notificationRoutes);

// Emergency SOS / Help Requests (Member-2)
app.use('/api/sos', sosRoutes);

// Member-3: Volunteer task management and roster/profiles
app.use('/api/tasks', taskRoutes);
app.use('/api/volunteers', volunteerRoutes);

// ── Health check endpoint ─────────────────────────────────────────────────────
// Useful for uptime monitors, container orchestrators (Kubernetes liveness probes),
// and a quick sanity check that the server is running.
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date(),
  });
});

// ── 404 handler ───────────────────────────────────────────────────────────────
// Catches any request that didn't match a route above.
// This must come AFTER all route registrations.
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ── Global error handler ──────────────────────────────────────────────────────
// Express recognises a 4-argument middleware as an error handler.
// Any call to next(error) or an unhandled throw inside async routes lands here.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Always log the full stack trace on the server so we can debug
  console.error('Unhandled server error:', err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'An unexpected error occurred.',
  });
});

// ── Bootstrap: connect to DB then start the HTTP server ──────────────────────
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to MongoDB first — don't start the server if the DB is unreachable
    await connectDB();

    // Start listening for HTTP (and WebSocket upgrade) requests
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`   Health check: http://localhost:${PORT}/api/health`);
    });

    // Wire up Socket.IO authentication middleware and connection handlers
    // Must be called AFTER the server is set up but timing relative to listen() doesn't matter
    initSocket(io);
    console.log('⚡ Socket.IO initialised');
  } catch (error) {
    // If the DB connection fails, log and exit so the process manager can restart
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
