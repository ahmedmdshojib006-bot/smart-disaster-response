// socket/socketHandler.js
// ─────────────────────────────────────────────────────────────────────────────
// Socket.IO handler — initSocket(io)
//
// This module wires up all Socket.IO logic:
//   1. A middleware layer that runs before every connection is accepted.
//      It verifies the client's JWT token and rejects unauthenticated sockets.
//   2. A connection handler that joins the authenticated user to their personal
//      room and their role-based room so notifications can be routed correctly.
//
// Room naming conventions (must match notificationService.js):
//   "user:<mongoId>"  — personal room for one specific user
//   "role:<roleName>" — shared room for all users with a given role
//
// On the CLIENT SIDE, the frontend should connect with:
//   const socket = io('http://localhost:5000', {
//     auth: { token: '<JWT from localStorage>' }
//   });
// ─────────────────────────────────────────────────────────────────────────────

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * initSocket
 * Registers Socket.IO middleware and connection handlers on the given io instance.
 *
 * @param {import('socket.io').Server} io - The Socket.IO server instance
 */
const initSocket = (io) => {
  // ── Socket.IO Middleware: Authentication ───────────────────────────────────
  // This middleware runs for EVERY incoming socket connection attempt, BEFORE
  // the 'connection' event fires. Calling next(new Error(...)) rejects the
  // connection and sends the error message back to the client.
  io.use(async (socket, next) => {
    try {
      // The client sends its JWT in the auth handshake object:
      // io('http://...', { auth: { token: 'eyJ...' } })
      const token = socket.handshake.auth?.token;

      if (!token) {
        // No token provided — reject the connection immediately
        return next(new Error('Authentication token missing'));
      }

      // Verify the token's signature and expiry
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (jwtErr) {
        return next(new Error('Invalid authentication token'));
      }

      // Load the user from the database (exclude passwordHash for safety)
      const user = await User.findById(decoded.id).select('-passwordHash');

      if (!user) {
        // Token was valid but the user account was deleted
        return next(new Error('Invalid authentication token'));
      }

      // Attach the user to the socket object so the connection handler can use it
      socket.user = user;

      // Allow the connection to proceed
      next();
    } catch (error) {
      console.error('Socket auth middleware error:', error);
      next(new Error('Internal server error during socket authentication'));
    }
  });

  // ── Connection Handler ─────────────────────────────────────────────────────
  // This fires after the middleware chain succeeds — socket.user is guaranteed
  // to be set at this point.
  io.on('connection', (socket) => {
    const { _id, role } = socket.user;

    // ── Join personal room ─────────────────────────────────────────────────
    // Every user gets their own private room keyed by their MongoDB ID.
    // notificationService uses this to send direct (personal) notifications.
    socket.join(`user:${_id}`);

    // ── Join role room ─────────────────────────────────────────────────────
    // All users with the same role share a room.
    // notificationService uses this to send role-targeted notifications.
    socket.join(`role:${role}`);

    // Log the connection for server-side visibility (remove in prod if too noisy)
    console.log(`🔌 Socket connected  — user: ${_id} | role: ${role} | socketId: ${socket.id}`);

    // ── Disconnect handler ─────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      console.log(`🔌 Socket disconnected — user: ${_id} | reason: ${reason}`);
    });
  });
};

module.exports = { initSocket };
