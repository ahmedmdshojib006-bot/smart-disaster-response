// models/Notification.js
// ─────────────────────────────────────────────────────────────────────────────
// Mongoose schema for platform notifications.
//
// A notification can be:
//   1. Personal  — targeted at a single user (recipient = ObjectId)
//   2. Role-cast — sent to everyone with a specific role (targetRole = 'Volunteer', etc.)
//   3. Broadcast — sent to all users (both recipient and targetRole are null)
//
// Indexes on `recipient` and `targetRole` speed up the common query pattern
// used in notificationController.getNotifications.
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require('mongoose');

// ── Schema definition ────────────────────────────────────────────────────────
const notificationSchema = new mongoose.Schema({
  // The specific user this notification is for.
  // null means it is NOT targeted at a single user (role-cast or broadcast).
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',      // Mongoose populate() can resolve this to a full User doc
    default: null,
  },

  // If set, this notification is visible to everyone with this role.
  // null means it is NOT role-targeted (personal or broadcast).
  targetRole: {
    type: String,
    enum: ['Admin', 'Volunteer', 'NGO', 'Citizen', 'Donor', null],
    default: null,
  },

  // Category of the notification — drives icon/colour in the frontend
  type: {
    type: String,
    enum: ['sos', 'weather', 'evacuation', 'general'],
    required: [true, 'Notification type is required'],
  },

  // Short headline shown in the notification list
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
  },

  // Full notification body text
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
  },

  // Tracks whether the user has seen/acknowledged this notification
  isRead: {
    type: Boolean,
    default: false,
  },

  // When the notification was created — used for sorting (newest first)
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// ── Indexes ──────────────────────────────────────────────────────────────────
// These indexes make the $or query in getNotifications fast even with
// millions of notifications in the collection.
notificationSchema.index({ recipient: 1 });
notificationSchema.index({ targetRole: 1 });

// ── Export ───────────────────────────────────────────────────────────────────
const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
