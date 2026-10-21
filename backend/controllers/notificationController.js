const Notification = require('../models/Notification');

const buildUserQuery = (user) => ({
  $or: [
    { recipient: user._id },                           
    { targetRole: user.role },                         
    { recipient: null, targetRole: null },             
  ],
});

const getNotifications = async (req, res) => {
  try {
    const query = buildUserQuery(req.user);

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 }) 
      .limit(50);

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

const markOneRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOneAndUpdate(
      {
        _id: id,
        $or: [
          { recipient: req.user._id },
          { targetRole: req.user.role },
          { recipient: null, targetRole: null },
        ],
      },
      { isRead: true },
      { new: true } 
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

const markAllRead = async (req, res) => {
  try {
    const query = buildUserQuery(req.user);

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
