// routes/authRoutes.js
// ─────────────────────────────────────────────────────────────────────────────
// Authentication routes
//
// Mounted at /api/auth in server.js, so the full paths are:
//   POST   /api/auth/register  — create a new account
//   POST   /api/auth/login     — log in and receive a JWT
//   GET    /api/auth/me        — get the current user's profile (protected)
//   POST   /api/auth/logout    — server-side logout acknowledgement (protected)
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();

const { register, login, getMe, logout } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Public routes — no token required
router.post('/register', register); // register is an array [validationMiddleware, handler]
router.post('/login', login);       // login is an array [validationMiddleware, handler]

// Protected routes — must provide a valid JWT
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);

module.exports = router;
