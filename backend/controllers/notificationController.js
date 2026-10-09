// controllers/notificationController.js
// ─────────────────────────────────────────────────────────────────────────────
// Notification controllers: getNotifications, markOneRead, markAllRead
//
// All routes using these controllers must be protected (req.user is required).
// Notifications are fetched using a $or query that matches:
//   - Personal notifications addressed to this specific user
//   - Role-cast notifications addressed to the user's role group
//   - Broadcast notifications (both recipient and targetRole are null)
// ─────────────────────────────────────────────────────────────────────────────

const Notification = require('../models/Notification');

// ── Helper: build the $or query for the current user ─────────────────────────
// Extracted into a helper so both get and mark-all-read can share the same logic.
const buildUserQuery = (user) => ({
  $or: [
    { recipient: user._id },                           // personal notification
    { targetRole: user.role },                         // role-cast notification
    { recipient: null, targetRole: null },             // broadcast to everyone
  ],
});

/**
 * getNotifications
 * GET /api/notifications
 * Returns the 50 most recent notifications relevant to the logged-in user,
 * along with the count of unread ones (used to show a badge in the UI).
 */
const getNotifications = async (req, res) => {
  try {
    const query = buildUserQuery(req.user);

    // Fetch up to 50 notifications, newest first
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 }) // -1 = descending (most recent at the top)
      .limit(50);

    // Count how many are still unread so the frontend can show a badge number
    const unreadCount = await Notification.countDocuments({
      ...query,
      isRead: false,
    });

    return res.status(200).json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error('getNotifications error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching notifications.',
    });
  }
};

/**
 * markOneRead
 * PATCH /api/notifications/:id/read
 * Marks a single notification as read.
 * Only marks it if it actually belongs to the current user (security check).
 */
const markOneRead = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the notification AND verify it's visible to this user in the same query
    // This prevents users from marking other people's private notifications as read.
    const notification = await Notification.findOneAndUpdate(
      {
        _id: id,
        // Must match the ownership / visibility rules
        $or: [
          { recipient: req.user._id },
          { targetRole: req.user.role },
          { recipient: null, targetRole: null },
        ],
      },
      { isRead: true },
      { new: true } // return the UPDATED document (not the old one)
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or not accessible.',
      });
    }

    return res.status(200).json({
      success: true,
      notification,
    });
  } catch (error) {
    console.error('markOneRead error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while marking notification as read.',
    });
  }
};

/**
 * markAllRead
 * PATCH /api/notifications/read-all
 * Marks ALL of the current user's relevant notifications as read.
 */
const markAllRead = async (req, res) => {
  try {
    const query = buildUserQuery(req.user);

    // updateMany applies the change to every matching document at once
    await Notification.updateMany(query, { isRead: true });

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read.',
    });
  } catch (error) {
    console.error('markAllRead error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while marking all notifications as read.',
    });
  }
};

module.exports = { getNotifications, markOneRead, markAllRead };
