// controllers/authController.js
// ─────────────────────────────────────────────────────────────────────────────
// Authentication controllers: register, login, getMe, logout
//
// These functions are called by the route handlers in routes/authRoutes.js.
// Each function is an async Express handler: (req, res) => { ... }
// ─────────────────────────────────────────────────────────────────────────────

const jwt = require('jsonwebtoken');
const { validationResult, body } = require('express-validator');
const User = require('../models/User');

// ── Helper: sign a JWT for a given user id ───────────────────────────────────
// Centralises token creation so we don't repeat ourselves in register & login.
const signToken = (userId) => {
  return jwt.sign(
    { id: userId },                    // payload — only store the user's DB id
    process.env.JWT_SECRET,            // secret key from .env
    { expiresIn: process.env.JWT_EXPIRES_IN } // e.g. '7d'
  );
};

// ── Validation rule sets ─────────────────────────────────────────────────────
// express-validator lets us define rules as arrays and then run them with
// `validationResult(req)` inside the handler.

/**
 * registerValidationRules
 * Rules run before the `register` handler body executes.
 */
const registerValidationRules = [
  body('name')
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),

  body('email')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(), // lowercases and strips dots from gmail addresses

  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),

  body('role')
    .optional()
    // The public registration endpoint must NOT allow users to self-assign Admin
    .isIn(['Volunteer', 'NGO', 'Citizen', 'Donor'])
    .withMessage('Invalid role. Admin role cannot be assigned via registration.'),
];

/**
 * loginValidationRules
 * Minimal rules — just check that both fields are present.
 */
const loginValidationRules = [
  body('email').notEmpty().withMessage('Email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

// ── Controllers ──────────────────────────────────────────────────────────────

/**
 * register
 * POST /api/auth/register
 * Creates a new user account. Returns a JWT on success.
 */
const register = [
  // 1. Run validation rules first (these are Express middleware themselves)
  ...registerValidationRules,

  // 2. The actual handler runs after validation
  async (req, res) => {
    try {
      // ── Check for validation errors ──────────────────────────────────────
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        // Return all error messages as an array so the frontend can display them
        return res.status(422).json({
          success: false,
          errors: errors.array().map((e) => e.msg),
        });
      }

      const { name, email, password, role, skills, availability, serviceArea, phone } = req.body;

      // ── Check for duplicate email ────────────────────────────────────────
      // MongoDB unique index would also catch this, but we want a friendly
      // error message rather than a raw MongoServerError.
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Email already registered.',
        });
      }

      // ── Create the user ──────────────────────────────────────────────────
      // We assign the plain-text password to `passwordHash`.
      // The pre-save hook in User.js will hash it before writing to MongoDB.
      const userData = {
        name,
        email,
        passwordHash: password, // will be hashed by the pre-save hook
        role: role || 'Citizen',  // default to Citizen if role not provided
      };

      if (Array.isArray(skills)) {
        userData.skills = skills;
      } else if (typeof skills === 'string' && skills.trim()) {
        userData.skills = skills.split(',').map((s) => s.trim()).filter(Boolean);
      }

      if (availability) {
        userData.availability = availability;
      }
      if (serviceArea) {
        userData.serviceArea = serviceArea;
      }
      if (phone) {
        userData.phone = phone;
      }

      const user = new User(userData);

      await user.save(); // triggers the pre-save bcrypt hook

      // ── Sign JWT & respond ───────────────────────────────────────────────
      const token = signToken(user._id);

      return res.status(201).json({
        success: true,
        message: 'Registration successful.',
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          skills: user.skills || [],
          availability: user.availability || 'Available',
          serviceArea: user.serviceArea || '',
          phone: user.phone || '',
        },
      });
    } catch (error) {
      console.error('Register error:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error during registration.',
      });
    }
  },
];

/**
 * login
 * POST /api/auth/login
 * Authenticates a user and returns a JWT.
 */
const login = [
  // 1. Validate input fields are present
  ...loginValidationRules,

  // 2. Main handler
  async (req, res) => {
    try {
      // ── Check for validation errors ──────────────────────────────────────
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({
          success: false,
          errors: errors.array().map((e) => e.msg),
        });
      }

      const { email, password } = req.body;

      // ── Find user by email ───────────────────────────────────────────────
      // We need the passwordHash field to do the comparison, so we explicitly
      // select it here (no '+passwordHash' trick needed since it's not set to
      // select:false in our schema, but we do it for clarity).
      const user = await User.findOne({ email: email.toLowerCase() });

      // ── Verify password ──────────────────────────────────────────────────
      // We do BOTH checks (user exists AND password matches) before responding
      // with the same error message to prevent "user enumeration" attacks —
      // an attacker should not be able to tell whether an email exists just
      // from the error message.
      const passwordMatch = user ? await user.comparePassword(password) : false;

      if (!user || !passwordMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.',
        });
      }

      // ── Sign JWT & respond ───────────────────────────────────────────────
      const token = signToken(user._id);

      return res.status(200).json({
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          skills: user.skills || [],
          availability: user.availability || 'Available',
          serviceArea: user.serviceArea || '',
          phone: user.phone || '',
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error during login.',
      });
    }
  },
];

/**
 * getMe
 * GET /api/auth/me  (protected)
 * Returns the currently authenticated user's profile.
 * req.user is already populated by the `protect` middleware.
 */
const getMe = async (req, res) => {
  // req.user was set by protect middleware — no DB call needed here
  return res.status(200).json({
    success: true,
    user: req.user,
  });
};

/**
 * logout
 * POST /api/auth/logout  (protected)
 * JWT logout is stateless — we just tell the client to discard the token.
 * For full server-side invalidation you would need a token blocklist (Redis, etc.).
 */
const logout = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully. Please remove the token from client storage.',
  });
};

module.exports = { register, login, getMe, logout };
