import api from './api';

const CACHE_PREFIX = 'notifications_cache_';
const QUEUE_KEY = 'offline_notification_actions';

/**
 * Get cached notifications from localStorage for a given user
 */
export const getCachedNotifications = (userId) => {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error reading cached notifications:', e);
    return [];
  }
};

/**
 * Save notifications array to localStorage cache
 */
export const setCachedNotifications = (userId, notifications) => {
  if (!userId) return;
  try {
    localStorage.setItem(`${CACHE_PREFIX}${userId}`, JSON.stringify(notifications));
  } catch (e) {
    console.error('Error saving cached notifications:', e);
  }
};

/**
 * Queue an offline action to be executed when back online
 */
export const queueOfflineAction = (action) => {
  try {
    const currentQueue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    currentQueue.push({ ...action, timestamp: Date.now() });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(currentQueue));
  } catch (e) {
    console.error('Error queueing offline notification action:', e);
  }
};

/**
 * Fetch notifications from backend (with offline fallback to localStorage)
 */
export const fetchUserNotifications = async (userId, unreadOnly = false) => {
  if (!navigator.onLine) {
    const cached = getCachedNotifications(userId);
    const filtered = unreadOnly ? cached.filter(n => !n.isRead) : cached;
    const unreadCount = cached.filter(n => !n.isRead).length;
    return { notifications: filtered, unreadCount, isOffline: true };
  }

  try {
    const url = unreadOnly ? '/notifications?unreadOnly=true' : '/notifications';
    const res = await api.get(url);
    const { notifications, unreadCount } = res.data;

    // Update offline cache for this user
    setCachedNotifications(userId, notifications);

    return { notifications, unreadCount, isOffline: false };
  } catch (err) {
    console.warn('Failed to fetch from backend, loading cached notifications:', err.message);
    const cached = getCachedNotifications(userId);
    const filtered = unreadOnly ? cached.filter(n => !n.isRead) : cached;
    const unreadCount = cached.filter(n => !n.isRead).length;
    return { notifications: filtered, unreadCount, isOffline: true };
  }
};

/**
 * Mark a single notification as read (with offline queue)
 */
export const markNotificationAsRead = async (id, userId) => {
  if (!navigator.onLine) {
    queueOfflineAction({ type: 'MARK_READ', id });
    const cached = getCachedNotifications(userId).map(n => (n._id === id ? { ...n, isRead: true } : n));
    setCachedNotifications(userId, cached);
    return { _id: id, isRead: true };
  }

  try {
    const res = await api.patch(`/notifications/${id}/read`);
    const cached = getCachedNotifications(userId).map(n => (n._id === id ? { ...n, isRead: true } : n));
    setCachedNotifications(userId, cached);
    return res.data;
  } catch (err) {
    queueOfflineAction({ type: 'MARK_READ', id });
    return { _id: id, isRead: true };
  }
};

/**
 * Mark all notifications as read (with offline queue)
 */
export const markAllNotificationsAsRead = async (userId) => {
  if (!navigator.onLine) {
    queueOfflineAction({ type: 'MARK_ALL_READ' });
    const cached = getCachedNotifications(userId).map(n => ({ ...n, isRead: true }));
    setCachedNotifications(userId, cached);
    return { success: true };
  }

  try {
    const res = await api.patch('/notifications/mark-all-read');
    const cached = getCachedNotifications(userId).map(n => ({ ...n, isRead: true }));
    setCachedNotifications(userId, cached);
    return res.data;
  } catch (err) {
    queueOfflineAction({ type: 'MARK_ALL_READ' });
    return { success: true };
  }
};

/**
 * Dismiss a single notification (with offline queue)
 */
export const dismissNotification = async (id, userId) => {
  if (!navigator.onLine) {
    queueOfflineAction({ type: 'DISMISS', id });
    const cached = getCachedNotifications(userId).filter(n => n._id !== id);
    setCachedNotifications(userId, cached);
    return { success: true };
  }

  try {
    const res = await api.delete(`/notifications/${id}`);
    const cached = getCachedNotifications(userId).filter(n => n._id !== id);
    setCachedNotifications(userId, cached);
    return res.data;
  } catch (err) {
    queueOfflineAction({ type: 'DISMISS', id });
    return { success: true };
  }
};

/**
 * Dismiss all notifications (with offline queue)
 */
export const dismissAllNotifications = async (userId) => {
  if (!navigator.onLine) {
    queueOfflineAction({ type: 'DISMISS_ALL' });
    setCachedNotifications(userId, []);
    return { success: true };
  }

  try {
    const res = await api.delete('/notifications/dismiss-all');
    setCachedNotifications(userId, []);
    return res.data;
  } catch (err) {
    queueOfflineAction({ type: 'DISMISS_ALL' });
    return { success: true };
  }
};

/**
 * Sync all queued offline notification actions to the backend
 */
export const syncOfflineNotificationActions = async () => {
  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  if (queue.length === 0) return;

  console.log(`Syncing ${queue.length} offline notification actions...`);

  for (const action of queue) {
    try {
      if (action.type === 'MARK_READ') {
        await api.patch(`/notifications/${action.id}/read`);
      } else if (action.type === 'MARK_ALL_READ') {
        await api.patch('/notifications/mark-all-read');
      } else if (action.type === 'DISMISS') {
        await api.delete(`/notifications/${action.id}`);
      } else if (action.type === 'DISMISS_ALL') {
        await api.delete('/notifications/dismiss-all');
      }
    } catch (e) {
      console.warn('Failed to sync offline action:', action, e.message);
    }
  }

  localStorage.removeItem(QUEUE_KEY);
  console.log('Offline notification actions synced successfully');
};
