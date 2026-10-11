// routes/notificationRoutes.js
// ─────────────────────────────────────────────────────────────────────────────
// Notification routes (all protected — valid JWT required)
//
// Mounted at /api/notifications in server.js, so the full paths are:
//   GET   /api/notifications           — fetch notifications for current user
//   PATCH /api/notifications/read-all  — mark all as read
//   PATCH /api/notifications/:id/read  — mark one as read
//
// ⚠️  IMPORTANT ORDER: /read-all must be registered BEFORE /:id/read
//    because Express matches routes top-to-bottom. If /:id/read came first,
//    a request to /read-all would match /:id where id="read-all", which
//    is wrong (and would cause a CastError when Mongoose tries to use
//    "read-all" as a MongoDB ObjectId).
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();

const {
  getNotifications,
  markOneRead,
  markAllRead,
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

// Apply `protect` to every route in this file
// (using router.use is cleaner than repeating `protect` on each line)
router.use(protect);

// GET  /api/notifications — list notifications for the logged-in user
router.get('/', getNotifications);

// PATCH /api/notifications/read-all — mark all relevant notifications as read
// NOTE: This MUST come before /:id/read to avoid Express treating "read-all" as an id param
router.patch('/read-all', markAllRead);

// PATCH /api/notifications/:id/read — mark a single notification as read
router.patch('/:id/read', markOneRead);

module.exports = router;
