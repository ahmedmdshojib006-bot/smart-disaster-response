require('dotenv').config();

const express = require('express');
const http = require('http');           
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const sosRoutes = require('./routes/sosRoutes');
const taskRoutes = require('./routes/taskRoutes');
const volunteerRoutes = require('./routes/volunteerRoutes');
const profileRoutes = require('./routes/profileRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { initSocket } = require('./socket/socketHandler');

const app = express();

const httpServer = http.createServer(app);

const isAllowedOrigin = (origin) => {
  if (!origin) return true; 
  if (process.env.CLIENT_ORIGIN === '*' || !process.env.CLIENT_ORIGIN) return true;
  const allowed = [process.env.CLIENT_ORIGIN, 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];
  if (allowed.includes(origin)) return true;
  if (origin.endsWith('.vercel.app')) return true; 
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

const io = new Server(httpServer, {
  cors: corsOptions,
});

app.set('io', io);

app.use(cors(corsOptions));

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);

app.use('/api/notifications', notificationRoutes);

app.use('/api/sos', sosRoutes);

app.use('/api/tasks', taskRoutes);
app.use('/api/volunteers', volunteerRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date(),
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'An unexpected error occurred.',
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`   Health check: http://localhost:${PORT}/api/health`);
    });

    initSocket(io);
    console.log('⚡ Socket.IO initialised');
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
