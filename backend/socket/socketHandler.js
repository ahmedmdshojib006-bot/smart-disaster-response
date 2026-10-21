const jwt = require('jsonwebtoken');
const User = require('../models/User');

const initSocket = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error('Authentication token missing'));
      }

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (jwtErr) {
        return next(new Error('Invalid authentication token'));
      }

      const user = await User.findById(decoded.id).select('-passwordHash');

      if (!user) {
        return next(new Error('Invalid authentication token'));
      }

      socket.user = user;

      next();
    } catch (error) {
      console.error('Socket auth middleware error:', error);
      next(new Error('Internal server error during socket authentication'));
    }
  });

  io.on('connection', (socket) => {
    const { _id, role } = socket.user;

    socket.join(`user:${_id}`);

    socket.join(`role:${role}`);

    console.log(`🔌 Socket connected  — user: ${_id} | role: ${role} | socketId: ${socket.id}`);

    socket.on('disconnect', (reason) => {
      console.log(`🔌 Socket disconnected — user: ${_id} | reason: ${reason}`);
    });
  });
};

module.exports = { initSocket };
