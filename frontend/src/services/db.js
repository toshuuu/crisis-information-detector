import { openDB } from 'idb';

const DB_NAME = 'CrisisInformationDetectorDB';
const DB_VERSION = 1;

let dbPromise = null;

export const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        console.log(`[IndexedDB] Upgrading database from v${oldVersion} to v${newVersion}`);

        // 1. Previously fetched crisis reports
        if (!db.objectStoreNames.contains('reports')) {
          const reportStore = db.createObjectStore('reports', { keyPath: '_id' });
          reportStore.createIndex('by_createdAt', 'createdAt');
          reportStore.createIndex('by_status', 'status');
          reportStore.createIndex('by_type', 'type');
          reportStore.createIndex('by_reporter', 'reporter');
        }

        // 2. Pending incident reports created offline
        if (!db.objectStoreNames.contains('pending_reports')) {
          const pendingStore = db.createObjectStore('pending_reports', { keyPath: 'clientReportId' });
          pendingStore.createIndex('by_syncStatus', 'syncStatus');
          pendingStore.createIndex('by_createdAt', 'createdAt');
          pendingStore.createIndex('by_userId', 'userId');
        }

        // 3. Emergency resources and shelter information
        if (!db.objectStoreNames.contains('emergency_resources')) {
          const emergencyStore = db.createObjectStore('emergency_resources', { keyPath: 'id' });
          emergencyStore.createIndex('by_category', 'category');
          emergencyStore.createIndex('by_isSaved', 'isSaved');
        }

        // 4. Cached notification history
        if (!db.objectStoreNames.contains('notifications')) {
          const notifStore = db.createObjectStore('notifications', { keyPath: '_id' });
          notifStore.createIndex('by_userId', 'user');
          notifStore.createIndex('by_isRead', 'isRead');
          notifStore.createIndex('by_createdAt', 'createdAt');
          notifStore.createIndex('by_category', 'category');
        }

        // 5. User preferences
        if (!db.objectStoreNames.contains('user_preferences')) {
          db.createObjectStore('user_preferences', { keyPath: 'key' });
        }

        // 6. Pending synchronization operations (verifications, dismissals, etc.)
        if (!db.objectStoreNames.contains('sync_queue')) {
          const queueStore = db.createObjectStore('sync_queue', { keyPath: 'operationId' });
          queueStore.createIndex('by_status', 'status');
          queueStore.createIndex('by_type', 'type');
          queueStore.createIndex('by_createdAt', 'createdAt');
        }

        // 7. Last successful synchronization timestamps & health metadata
        if (!db.objectStoreNames.contains('sync_metadata')) {
          db.createObjectStore('sync_metadata', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
};

// ==========================================
// 1. CRISIS REPORTS OPERATIONS
// ==========================================

export const saveReportsToDB = async (reportsList) => {
  if (!Array.isArray(reportsList)) return;
  const db = await getDB();
  const tx = db.transaction('reports', 'readwrite');
  const now = Date.now();

  for (const report of reportsList) {
    if (report && report._id) {
      await tx.store.put({
        ...report,
        _cachedAt: now,
      });
    }
  }
  await tx.done;
  await setSyncMetadata('reports', { count: reportsList.length, status: 'success' });
};

export const getCachedReportsFromDB = async () => {
  const db = await getDB();
  const all = await db.getAll('reports');
  // Sort descending by createdAt
  return all.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
};

export const getCachedReportByIdFromDB = async (id) => {
  const db = await getDB();
  return db.get('reports', id);
};

export const deleteCachedReportFromDB = async (id) => {
  const db = await getDB();
  return db.delete('reports', id);
};

export const clearReportsDB = async () => {
  const db = await getDB();
  return db.clear('reports');
};

// ==========================================
// 2. PENDING OFFLINE REPORTS
// ==========================================

export const savePendingReportToDB = async (reportData) => {
  const db = await getDB();
  const clientReportId = reportData.clientReportId || `offline_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const record = {
    ...reportData,
    clientReportId,
    syncStatus: reportData.syncStatus || 'pending', // 'pending' | 'syncing' | 'synced' | 'failed'
    retryCount: reportData.retryCount || 0,
    error: reportData.error || null,
    createdAt: reportData.createdAt || Date.now(),
    updatedAt: Date.now(),
  };

  await db.put('pending_reports', record);
  return record;
};

export const getPendingReportsFromDB = async () => {
  const db = await getDB();
  const all = await db.getAll('pending_reports');
  return all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

export const getPendingReportById = async (clientReportId) => {
  const db = await getDB();
  return db.get('pending_reports', clientReportId);
};

export const updatePendingReportStatusInDB = async (clientReportId, syncStatus, updates = {}) => {
  const db = await getDB();
  const existing = await db.get('pending_reports', clientReportId);
  if (!existing) return null;

  const updated = {
    ...existing,
    ...updates,
    syncStatus,
    updatedAt: Date.now(),
  };

  await db.put('pending_reports', updated);
  return updated;
};

export const deletePendingReportFromDB = async (clientReportId) => {
  const db = await getDB();
  return db.delete('pending_reports', clientReportId);
};

export const getActivePendingCountFromDB = async () => {
  const db = await getDB();
  const all = await db.getAll('pending_reports');
  return all.filter((r) => r.syncStatus === 'pending' || r.syncStatus === 'syncing' || r.syncStatus === 'failed').length;
};

// ==========================================
// 3. EMERGENCY RESOURCES & SHELTERS
// ==========================================

export const saveEmergencyResourcesToDB = async (resources) => {
  if (!Array.isArray(resources)) return;
  const db = await getDB();
  const tx = db.transaction('emergency_resources', 'readwrite');
  for (const item of resources) {
    if (item && item.id) {
      const existing = await tx.store.get(item.id);
      await tx.store.put({
        ...item,
        isSaved: existing ? existing.isSaved : (item.isSaved || false),
        updatedAt: Date.now(),
      });
    }
  }
  await tx.done;
  await setSyncMetadata('emergency_resources', { count: resources.length });
};

export const getEmergencyResourcesFromDB = async (category = null) => {
  const db = await getDB();
  if (category) {
    const index = db.transaction('emergency_resources').store.index('by_category');
    return index.getAll(category);
  }
  return db.getAll('emergency_resources');
};

export const toggleSaveEmergencyResourceInDB = async (id) => {
  const db = await getDB();
  const item = await db.get('emergency_resources', id);
  if (!item) return null;
  item.isSaved = !item.isSaved;
  await db.put('emergency_resources', item);
  return item;
};

// ==========================================
// 4. NOTIFICATIONS
// ==========================================

export const saveNotificationsToDB = async (userId, notifications) => {
  if (!userId || !Array.isArray(notifications)) return;
  const db = await getDB();
  const tx = db.transaction('notifications', 'readwrite');
  for (const notif of notifications) {
    if (notif && notif._id) {
      await tx.store.put({
        ...notif,
        user: notif.user || userId,
        _cachedAt: Date.now(),
      });
    }
  }
  await tx.done;
  await setSyncMetadata(`notifications_${userId}`, { count: notifications.length });
};

export const getCachedNotificationsFromDB = async (userId) => {
  if (!userId) return [];
  const db = await getDB();
  const all = await db.getAll('notifications');
  const userNotifs = all.filter((n) => {
    const notifUser = typeof n.user === 'object' ? n.user?._id : n.user;
    return notifUser === userId;
  });
  return userNotifs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
};

export const updateNotificationInDB = async (id, updates) => {
  const db = await getDB();
  const item = await db.get('notifications', id);
  if (!item) return null;
  const updated = { ...item, ...updates, updatedAt: Date.now() };
  await db.put('notifications', updated);
  return updated;
};

export const deleteNotificationFromDB = async (id) => {
  const db = await getDB();
  return db.delete('notifications', id);
};

export const clearUserNotificationsFromDB = async (userId) => {
  if (!userId) return;
  const db = await getDB();
  const tx = db.transaction('notifications', 'readwrite');
  const all = await tx.store.getAll();
  for (const item of all) {
    const notifUser = typeof item.user === 'object' ? item.user?._id : item.user;
    if (notifUser === userId) {
      await tx.store.delete(item._id);
    }
  }
  await tx.done;
};

// ==========================================
// 5. USER PREFERENCES
// ==========================================

export const getUserPreference = async (key, defaultValue = null) => {
  const db = await getDB();
  const record = await db.get('user_preferences', key);
  return record ? record.value : defaultValue;
};

export const setUserPreference = async (key, value) => {
  const db = await getDB();
  await db.put('user_preferences', {
    key,
    value,
    updatedAt: Date.now(),
  });
  return value;
};

// ==========================================
// 6. SYNC QUEUE OPERATIONS
// ==========================================

export const enqueueSyncOperation = async (operation) => {
  const db = await getDB();
  const operationId = operation.operationId || `sync_op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const record = {
    ...operation,
    operationId,
    status: operation.status || 'pending', // 'pending' | 'syncing' | 'completed' | 'failed'
    retryCount: operation.retryCount || 0,
    createdAt: operation.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
  await db.put('sync_queue', record);
  return record;
};

export const getPendingSyncQueue = async () => {
  const db = await getDB();
  const all = await db.getAll('sync_queue');
  return all
    .filter((op) => op.status === 'pending' || op.status === 'failed')
    .sort((a, b) => a.createdAt - b.createdAt);
};

export const updateSyncOperationInDB = async (operationId, updates) => {
  const db = await getDB();
  const existing = await db.get('sync_queue', operationId);
  if (!existing) return null;
  const updated = { ...existing, ...updates, updatedAt: Date.now() };
  await db.put('sync_queue', updated);
  return updated;
};

export const removeSyncOperationFromDB = async (operationId) => {
  const db = await getDB();
  return db.delete('sync_queue', operationId);
};

// ==========================================
// 7. SYNC METADATA & HEALTH TIMESTAMPS
// ==========================================

export const setSyncMetadata = async (key, extra = {}) => {
  const db = await getDB();
  const record = {
    key,
    lastSyncTimestamp: Date.now(),
    ...extra,
  };
  await db.put('sync_metadata', record);
  return record;
};

export const getSyncMetadata = async (key) => {
  const db = await getDB();
  return db.get('sync_metadata', key);
};

export const getAllSyncMetadata = async () => {
  const db = await getDB();
  const list = await db.getAll('sync_metadata');
  const map = {};
  for (const item of list) {
    map[item.key] = item;
  }
  return map;
};
