// middleware/authMiddleware.js
// ─────────────────────────────────────────────────────────────────────────────
// Authentication middleware — `protect`
//
// Every protected route runs this function first. It:
//   1. Reads the JWT from the Authorization header ("Bearer <token>")
//   2. Verifies the token's signature and expiry
//   3. Loads the matching user from the database
//   4. Attaches the user to req.user so downstream controllers can use it
//
// Usage in a route file:
//   const { protect } = require('../middleware/authMiddleware');
//   router.get('/me', protect, authController.getMe);
// ─────────────────────────────────────────────────────────────────────────────

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * protect
 * Express middleware that verifies the JWT and attaches the user to the request.
 */
const protect = async (req, res, next) => {
  try {
    // ── Step 1: Extract the token ──────────────────────────────────────────
    // The convention is: Authorization: Bearer eyJhbGci...
    const authHeader = req.headers.authorization;

    let token;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Split "Bearer <token>" and take the second part
      token = authHeader.split(' ')[1];
    }

    // If there's no token at all, the user is not logged in
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated. Please log in.',
      });
    }

    // ── Step 2: Verify the token ───────────────────────────────────────────
    // jwt.verify throws if the token is tampered with or expired
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      // Covers TokenExpiredError, JsonWebTokenError, NotBeforeError, etc.
      return res.status(401).json({
        success: false,
        message: 'Token is invalid or has expired.',
      });
    }

    // ── Step 3: Load the user from the database ────────────────────────────
    // We exclude passwordHash so it never leaks into req.user accidentally
    const user = await User.findById(decoded.id).select('-passwordHash');

    // The user might have been deleted after the token was issued
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User no longer exists.',
      });
    }

    // ── Step 4: Attach the user and continue ──────────────────────────────
    req.user = user; // now available to all subsequent middleware and controllers
    next();
  } catch (error) {
    // Unexpected server error (e.g. DB down)
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.',
    });
  }
};

module.exports = { protect };
