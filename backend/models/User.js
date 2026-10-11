// models/User.js
// ─────────────────────────────────────────────────────────────────────────────
// Mongoose schema and model for platform users.
// Passwords are NEVER stored as plain text — a pre-save hook automatically
// hashes them using bcryptjs before they reach the database.
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ── Schema definition ────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  // Full display name of the user
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,           // strips leading/trailing whitespace
    maxlength: [100, 'Name cannot exceed 100 characters'],
  },

  // Email is used as the login identifier; must be unique across all users
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,         // creates a unique index in MongoDB
    lowercase: true,      // always stored in lowercase to avoid duplicates like "User@mail.com" vs "user@mail.com"
    trim: true,
  },

  // We store the BCRYPT HASH here, never the plain-text password.
  // The field is named "passwordHash" to make it explicit.
  passwordHash: {
    type: String,
    required: [true, 'Password is required'],
  },

  // Role controls what parts of the application the user can access.
  // Admin is intentionally excluded from public self-registration.
  role: {
    type: String,
    enum: ['Admin', 'Volunteer', 'NGO', 'Citizen', 'Donor'],
    default: 'Citizen',
  },

  // Timestamp recorded when the document is first created
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// ── Pre-save hook: password hashing ─────────────────────────────────────────
// This hook runs automatically BEFORE every `.save()` call.
// We only re-hash if the passwordHash field was actually changed to avoid
// double-hashing an already-hashed value on unrelated updates (e.g. role change).
userSchema.pre('save', async function (next) {
  // `this` refers to the User document being saved
  if (!this.isModified('passwordHash')) {
    // Nothing to do — the password didn't change, move on
    return next();
  }

  try {
    // saltRounds=12 means bcrypt runs 2^12 iterations — strong but still fast
    const saltRounds = 12;
    const salt = await bcrypt.genSalt(saltRounds);

    // Replace the plain-text value with its bcrypt hash
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);

    next(); // continue the save operation
  } catch (err) {
    next(err); // pass any error to Express error handler
  }
});

// ── Instance method: comparePassword ────────────────────────────────────────
// Used during login to check a candidate password against the stored hash.
// Returns true if they match, false otherwise.
// This lives on the model instance so we can call: user.comparePassword('abc123')
userSchema.methods.comparePassword = async function (candidatePassword) {
  // bcrypt.compare hashes the candidate and compares byte-by-byte — safe against timing attacks
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// ── Export ───────────────────────────────────────────────────────────────────
const User = mongoose.model('User', userSchema);
module.exports = User;
