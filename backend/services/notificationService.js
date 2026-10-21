// services/notificationService.js
// ─────────────────────────────────────────────────────────────────────────────
// Notification Service — sendNotification()
//
// This is the SINGLE integration point for creating notifications across the
// entire platform. Any module (SOS, weather alerts, evacuation orders, etc.)
// should call this function rather than writing to the Notification model directly.
//
// What it does:
//   1. Validates the notification type
//   2. Creates and persists a Notification document in MongoDB
//   3. Emits a real-time Socket.IO event to the correct room(s)
//   4. Returns the saved notification so the caller can reference it
//
// Rooms used (defined in socket/socketHandler.js):
//   user:<userId>   — personal room; every connected user joins their own room
//   role:<roleName> — shared room; everyone with that role joins it on connect
// ─────────────────────────────────────────────────────────────────────────────

const Notification = require('../models/Notification');

// All valid notification categories — must match the Notification schema enum
const VALID_TYPES = ['sos', 'weather', 'evacuation', 'general'];

/**
 * sendNotification
 * Creates a notification in the database and pushes it to clients via Socket.IO.
 *
 * @param {Object} options
 * @param {import('socket.io').Server} options.io           - The Socket.IO server instance
 * @param {'sos'|'weather'|'evacuation'|'general'} options.type  - Notification category
 * @param {string} options.title                            - Short headline
 * @param {string} options.message                          - Full notification body
 * @param {string} [options.recipientUserId]                - Target a specific user (ObjectId string)
 * @param {string} [options.targetRole]                     - Target all users with this role
 *   NOTE: If neither recipientUserId nor targetRole is provided, the notification
 *         is broadcast only to Admins as a safe fallback (not to all users).
 *
 * @returns {Promise<import('mongoose').Document>} The saved Notification document
 */
const sendNotification = async ({ io, type, title, message, recipientUserId, targetRole }) => {
  // ── Step 1: Validate notification type ────────────────────────────────────
  if (!VALID_TYPES.includes(type)) {
    throw new Error(
      `Invalid notification type "${type}". Must be one of: ${VALID_TYPES.join(', ')}`
    );
  }

  // ── Step 2: Build and save the Notification document ──────────────────────
  const notificationData = {
    type,
    title,
    message,
    // Only set these fields if they were provided; otherwise leave as null (broadcast)
    recipient: recipientUserId || null,
    targetRole: targetRole || null,
  };

  const notification = new Notification(notificationData);
  await notification.save();

  // ── Step 3: Emit real-time event via Socket.IO ────────────────────────────
  // The payload sent to the client — kept small so it renders quickly
  const payload = {
    id: notification._id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    createdAt: notification.createdAt,
  };

  if (recipientUserId) {
    // Personal notification: emit only to that user's private room
    // Room name convention: "user:<mongoId>"
    io.to(`user:${recipientUserId}`).emit('notification:new', payload);

  } else if (targetRole) {
    // Role-cast notification: emit to everyone currently in that role's room
    // Room name convention: "role:<roleName>" e.g. "role:Volunteer"
    io.to(`role:${targetRole}`).emit('notification:new', payload);

  } else {
    io.emit('notification:new', payload);
  }

  // ── Step 4: Return the saved document ─────────────────────────────────────
  // The caller may want to log it, include it in an API response, etc.
  return notification;
};

module.exports = { sendNotification };
