const Notification = require('../models/Notification');

const VALID_TYPES = ['sos', 'weather', 'evacuation', 'general'];

const sendNotification = async ({ io, type, title, message, recipientUserId, targetRole, relatedId, relatedType }) => {
  if (!VALID_TYPES.includes(type)) {
    throw new Error(
      `Invalid notification type "${type}". Must be one of: ${VALID_TYPES.join(', ')}`
    );
  }

  const notificationData = {
    type,
    title,
    message,
    recipient: recipientUserId || null,
    targetRole: targetRole || null,
    relatedId: relatedId || null,
    relatedType: relatedType || null,
  };

  const notification = new Notification(notificationData);
  await notification.save();

  const payload = {
    id: notification._id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    relatedId: notification.relatedId,
    relatedType: notification.relatedType,
    createdAt: notification.createdAt,
  };

  if (recipientUserId) {
    io.to(`user:${recipientUserId}`).emit('notification:new', payload);

  } else if (targetRole) {
    io.to(`role:${targetRole}`).emit('notification:new', payload);

  } else {
    io.emit('notification:new', payload);
  }

  return notification;
};

module.exports = { sendNotification };
