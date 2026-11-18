const Notification = require('../models/Notification');

/**
 * GET /api/notifications
 * Returns all non-dismissed notifications for the authenticated user, newest first.
 * Supports ?unreadOnly=true query param.
 */
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { unreadOnly } = req.query;

    const filter = { user: userId, isDismissed: false };
    if (unreadOnly === 'true') filter.isRead = false;

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const unreadCount = await Notification.countDocuments({ user: userId, isRead: false, isDismissed: false });

    res.status(200).json({ notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/notifications/unread-count
 * Returns just the unread count (lightweight poll endpoint).
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      user: req.user.id,
      isRead: false,
      isDismissed: false,
    });
    res.status(200).json({ unreadCount: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read.
 */
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id }, // ownership check
      { isRead: true },
      { returnDocument: 'after' }
    );
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.status(200).json(notification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * PATCH /api/notifications/mark-all-read
 * Mark all notifications for this user as read.
 */
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, isRead: false, isDismissed: false },
      { isRead: true }
    );
    res.status(200).json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * DELETE /api/notifications/:id
 * Dismiss (soft-delete) a single notification.
 */
exports.dismissNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { isDismissed: true },
      { returnDocument: 'after' }
    );
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.status(200).json({ message: 'Notification dismissed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * DELETE /api/notifications
 * Dismiss ALL notifications for this user.
 */
exports.dismissAll = async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, isDismissed: false },
      { isDismissed: true }
    );
    res.status(200).json({ message: 'All notifications dismissed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
