import api from './api';
import {
  saveNotificationsToDB,
  getCachedNotificationsFromDB,
  updateNotificationInDB,
  deleteNotificationFromDB,
  clearUserNotificationsFromDB,
  enqueueSyncOperation,
} from './db';

/**
 * Fetch notifications from backend (with offline fallback to IndexedDB)
 */
export const fetchUserNotifications = async (userId, unreadOnly = false) => {
  if (!userId) return { notifications: [], unreadCount: 0, isOffline: !navigator.onLine };

  if (!navigator.onLine) {
    const cached = await getCachedNotificationsFromDB(userId);
    const filtered = unreadOnly ? cached.filter((n) => !n.isRead) : cached;
    const unreadCount = cached.filter((n) => !n.isRead).length;
    return { notifications: filtered, unreadCount, isOffline: true };
  }

  try {
    const url = unreadOnly ? '/notifications?unreadOnly=true' : '/notifications';
    const res = await api.get(url, { timeout: 6000 });
    const { notifications, unreadCount } = res.data;

    // Update offline IndexedDB cache for this user
    await saveNotificationsToDB(userId, notifications);

    return { notifications, unreadCount, isOffline: false };
  } catch (err) {
    console.warn('[Notifications] Failed to fetch from backend, loading IndexedDB cache:', err.message);
    const cached = await getCachedNotificationsFromDB(userId);
    const filtered = unreadOnly ? cached.filter((n) => !n.isRead) : cached;
    const unreadCount = cached.filter((n) => !n.isRead).length;
    return { notifications: filtered, unreadCount, isOffline: true };
  }
};

/**
 * Mark a single notification as read (with offline queue)
 */
export const markNotificationAsRead = async (id, userId) => {
  // Update local IndexedDB state immediately
  await updateNotificationInDB(id, { isRead: true });

  if (!navigator.onLine) {
    await enqueueSyncOperation({
      type: 'NOTIFICATION_READ',
      id,
      userId,
    });
    return { _id: id, isRead: true };
  }

  try {
    const res = await api.patch(`/notifications/${id}/read`, {}, { timeout: 5000 });
    return res.data;
  } catch (err) {
    console.warn('[Notifications] Failed to mark read online, enqueuing offline operation:', err.message);
    await enqueueSyncOperation({
      type: 'NOTIFICATION_READ',
      id,
      userId,
    });
    return { _id: id, isRead: true };
  }
};

/**
 * Mark all notifications as read (with offline queue)
 */
export const markAllNotificationsAsRead = async (userId) => {
  const cached = await getCachedNotificationsFromDB(userId);
  for (const notif of cached) {
    if (!notif.isRead) {
      await updateNotificationInDB(notif._id, { isRead: true });
    }
  }

  if (!navigator.onLine) {
    await enqueueSyncOperation({
      type: 'NOTIFICATION_ALL_READ',
      userId,
    });
    return { success: true };
  }

  try {
    const res = await api.patch('/notifications/mark-all-read', {}, { timeout: 5000 });
    return res.data;
  } catch (err) {
    await enqueueSyncOperation({
      type: 'NOTIFICATION_ALL_READ',
      userId,
    });
    return { success: true };
  }
};

/**
 * Dismiss a single notification (with offline queue)
 */
export const dismissNotification = async (id, userId) => {
  await deleteNotificationFromDB(id);

  if (!navigator.onLine) {
    await enqueueSyncOperation({
      type: 'NOTIFICATION_DISMISS',
      id,
      userId,
    });
    return { success: true };
  }

  try {
    const res = await api.delete(`/notifications/${id}`, { timeout: 5000 });
    return res.data;
  } catch (err) {
    await enqueueSyncOperation({
      type: 'NOTIFICATION_DISMISS',
      id,
      userId,
    });
    return { success: true };
  }
};

/**
 * Dismiss all notifications (with offline queue)
 */
export const dismissAllNotifications = async (userId) => {
  await clearUserNotificationsFromDB(userId);

  if (!navigator.onLine) {
    await enqueueSyncOperation({
      type: 'NOTIFICATION_ALL_DISMISS',
      userId,
    });
    return { success: true };
  }

  try {
    const res = await api.delete('/notifications/dismiss-all', { timeout: 5000 });
    return res.data;
  } catch (err) {
    await enqueueSyncOperation({
      type: 'NOTIFICATION_ALL_DISMISS',
      userId,
    });
    return { success: true };
  }
};

/**
 * Helper to queue local offline notification events (e.g. sync status alerts)
 */
export const createLocalNotification = async (userId, { title, message, category = 'system' }) => {
  const localNotif = {
    _id: `local_notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    user: userId,
    title,
    message,
    category,
    isRead: false,
    isLocal: true,
    createdAt: new Date().toISOString(),
  };
  await saveNotificationsToDB(userId, [localNotif]);
  return localNotif;
};
