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

const { register, login, getMe, logout, forgotPassword, resetPassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

router.get('/me', protect, getMe);
router.post('/logout', protect, logout);

module.exports = router;
