const Notification = require('../models/Notification');
const socketHandler = require('../socket/socketHandler');

/**
 * Create a notification for a user and emit it via socket.
 * Returns the saved notification document.
 */
const createNotification = async ({ userId, title, message, category = 'system', reportId = null }) => {
  const notification = await Notification.create({
    user: userId,
    title,
    message,
    category,
    report: reportId,
  });

  // Real-time delivery — emit to the user's private room
  socketHandler.emitToUser(userId.toString(), 'notification', notification);

  return notification;
};

module.exports = { createNotification };
