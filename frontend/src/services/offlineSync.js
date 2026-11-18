import axios from 'axios';
import {
  getPendingReportsFromDB,
  updatePendingReportStatusInDB,
  deletePendingReportFromDB,
  saveReportsToDB,
  getPendingSyncQueue,
  removeSyncOperationFromDB,
  updateSyncOperationInDB,
  setSyncMetadata,
  getSyncMetadata,
  getActivePendingCountFromDB,
} from './db';

const rawApiUrl =
  import.meta.env.VITE_API_URL ||
  'https://crisis-misinformation-detector.onrender.com/api';

const API_BASE_URL = rawApiUrl.endsWith('/api')
  ? rawApiUrl
  : `${rawApiUrl.replace(/\/$/, '')}/api`;

// Sync Status Listeners
const listeners = new Set();
let currentSyncState = {
  status: navigator.onLine ? 'online' : 'offline', // 'online' | 'offline' | 'synchronizing' | 'sync_failed'
  isOnline: navigator.onLine,
  isSyncing: false,
  pendingCount: 0,
  lastSyncTime: null,
  error: null,
};

export const subscribeSyncStatus = (callback) => {
  listeners.add(callback);
  callback(currentSyncState);
  return () => listeners.delete(callback);
};

const notifyListeners = (updates = {}) => {
  currentSyncState = { ...currentSyncState, ...updates };
  listeners.forEach((cb) => {
    try {
      cb(currentSyncState);
    } catch (e) {
      console.error('Error in sync status listener:', e);
    }
  });
};

/**
 * Perform a real health-check ping to verify server connectivity
 */
export const verifyServerConnectivity = async (timeoutMs = 3500) => {
  if (!navigator.onLine) {
    return false;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // Call health check endpoint with cache-busting timestamp
    const res = await fetch(`${API_BASE_URL}/health?_t=${Date.now()}`, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    return res.status >= 200 && res.status < 400;
  } catch (err) {
    console.warn('[Sync] Server ping failed:', err.message);
    return false;
  }
};

/**
 * Synchronize all pending offline reports with server
 */
export const syncPendingReports = async () => {
  const pendingReports = await getPendingReportsFromDB();
  const actionableReports = pendingReports.filter(
    (r) => r.syncStatus === 'pending' || r.syncStatus === 'failed' || r.syncStatus === 'syncing'
  );

  if (actionableReports.length === 0) {
    return { syncedCount: 0, failedCount: 0 };
  }

  console.log(`[Sync] Processing ${actionableReports.length} pending offline report(s)...`);
  let syncedCount = 0;
  let failedCount = 0;
  let authExpired = false;

  for (const report of actionableReports) {
    try {
      await updatePendingReportStatusInDB(report.clientReportId, 'syncing');
      notifyListeners({ isSyncing: true, status: 'synchronizing' });

      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const payload = {
        userId: report.userId,
        type: report.type,
        description: report.description,
        longitude: report.longitude,
        latitude: report.latitude,
        imageUrl: report.imageUrl || null,
        clientReportId: report.clientReportId,
        isOfflineSubmission: true,
        clientCreatedAt: report.createdAt,
      };

      const res = await axios.post(`${API_BASE_URL}/reports`, payload, {
        headers,
        timeout: 10000,
      });

      if (res.status === 200 || res.status === 201) {
        console.log(`[Sync] Report ${report.clientReportId} synced successfully:`, res.data);
        // Save server version into IndexedDB reports
        await saveReportsToDB([res.data]);
        // Update pending report status to synced
        await updatePendingReportStatusInDB(report.clientReportId, 'synced', {
          serverReportId: res.data._id,
        });
        // Remove from pending store
        await deletePendingReportFromDB(report.clientReportId);
        syncedCount++;
      }
    } catch (err) {
      console.error(`[Sync] Failed to sync report ${report.clientReportId}:`, err);

      if (err.response?.status === 401) {
        // Expired auth session: safely preserve pending report and prompt user
        authExpired = true;
        await updatePendingReportStatusInDB(report.clientReportId, 'failed', {
          error: 'Authentication session expired. Please log in again to sync.',
        });
        failedCount++;
        break; // Stop sync queue to prevent cascade errors
      }

      const isFatal = err.response?.status === 400; // Validation error
      const retryCount = (report.retryCount || 0) + 1;
      const status = isFatal || retryCount >= 5 ? 'failed' : 'pending';

      await updatePendingReportStatusInDB(report.clientReportId, status, {
        retryCount,
        error: err.response?.data?.error || err.message || 'Network error during sync',
      });
      failedCount++;
    }
  }

  if (authExpired) {
    window.dispatchEvent(new CustomEvent('offline_sync_auth_expired'));
  }

  return { syncedCount, failedCount, authExpired };
};

/**
 * Synchronize generic sync operations (verifications, notification read/dismiss)
 */
export const syncGenericOperationsQueue = async () => {
  const operations = await getPendingSyncQueue();
  if (operations.length === 0) return { synced: 0, failed: 0 };

  console.log(`[Sync] Syncing ${operations.length} generic queued action(s)...`);
  const token = localStorage.getItem('token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  let synced = 0;
  let failed = 0;

  for (const op of operations) {
    try {
      await updateSyncOperationInDB(op.operationId, { status: 'syncing' });

      if (op.type === 'VERIFICATION') {
        await axios.post(`${API_BASE_URL}/verifications`, op.payload, { headers, timeout: 8000 });
      } else if (op.type === 'NOTIFICATION_READ') {
        await axios.patch(`${API_BASE_URL}/notifications/${op.id}/read`, {}, { headers, timeout: 5000 });
      } else if (op.type === 'NOTIFICATION_ALL_READ') {
        await axios.patch(`${API_BASE_URL}/notifications/mark-all-read`, {}, { headers, timeout: 5000 });
      } else if (op.type === 'NOTIFICATION_DISMISS') {
        await axios.delete(`${API_BASE_URL}/notifications/${op.id}`, { headers, timeout: 5000 });
      } else if (op.type === 'NOTIFICATION_ALL_DISMISS') {
        await axios.delete(`${API_BASE_URL}/notifications/dismiss-all`, { headers, timeout: 5000 });
      }

      await removeSyncOperationFromDB(op.operationId);
      synced++;
    } catch (err) {
      console.warn(`[Sync] Operation ${op.operationId} failed:`, err.message);
      const retryCount = (op.retryCount || 0) + 1;
      await updateSyncOperationInDB(op.operationId, {
        status: retryCount >= 4 ? 'failed' : 'pending',
        retryCount,
        error: err.message,
      });
      failed++;
    }
  }
  return { synced, failed };
};

/**
 * Main synchronization orchestrator
 */
export const syncOfflineData = async (forceCheck = false) => {
  // Prevent concurrent executions
  if (currentSyncState.isSyncing) {
    return { success: false, reason: 'Sync already in progress' };
  }

  notifyListeners({ isSyncing: true, status: 'synchronizing', error: null });

  // 1. Verify true server connectivity
  const isServerReachable = await verifyServerConnectivity();

  if (!isServerReachable) {
    const pendingCount = await getActivePendingCountFromDB();
    notifyListeners({
      isSyncing: false,
      isOnline: false,
      status: 'offline',
      pendingCount,
      error: 'Cannot reach emergency server. Operating in offline mode.',
    });
    return { success: false, isOnline: false };
  }

  // Server is verified online
  try {
    // 2. Sync pending incident reports
    const reportResults = await syncPendingReports();

    // 3. Sync pending generic operations (verifications, notifications)
    const opResults = await syncGenericOperationsQueue();

    // 4. Update sync metadata
    const now = Date.now();
    await setSyncMetadata('global_sync', {
      lastSyncTimestamp: now,
      status: 'success',
      reportResults,
      opResults,
    });

    const pendingCount = await getActivePendingCountFromDB();

    notifyListeners({
      isSyncing: false,
      isOnline: true,
      status: reportResults.failedCount > 0 ? 'sync_failed' : 'online',
      pendingCount,
      lastSyncTime: now,
      error: reportResults.failedCount > 0 ? 'Some pending items failed to sync' : null,
    });

    // Notify application to refresh reports and notifications
    window.dispatchEvent(new CustomEvent('offline_sync_completed', {
      detail: { reportResults, opResults, timestamp: now }
    }));

    return {
      success: true,
      isOnline: true,
      reportResults,
      opResults,
    };
  } catch (err) {
    console.error('[Sync] Error during synchronization:', err);
    const pendingCount = await getActivePendingCountFromDB();
    notifyListeners({
      isSyncing: false,
      status: 'sync_failed',
      pendingCount,
      error: err.message || 'Synchronization encountered an error',
    });
    return { success: false, error: err.message };
  }
};

/**
 * Initialize background connectivity monitor and auto-sync
 */
export const initConnectivitySync = () => {
  // Load initial sync metadata
  getSyncMetadata('global_sync').then((meta) => {
    if (meta?.lastSyncTimestamp) {
      notifyListeners({ lastSyncTime: meta.lastSyncTimestamp });
    }
  });

  getActivePendingCountFromDB().then((count) => {
    notifyListeners({ pendingCount: count });
  });

  const handleOnline = async () => {
    console.log('[Connectivity] Browser online event detected. Verifying server...');
    notifyListeners({ isOnline: true });
    await syncOfflineData();
  };

  const handleOffline = () => {
    console.log('[Connectivity] Browser offline event detected.');
    notifyListeners({
      isOnline: false,
      status: 'offline',
      isSyncing: false,
    });
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Periodic connectivity & sync check every 45 seconds when page is visible
  const interval = setInterval(async () => {
    if (document.visibilityState === 'visible') {
      const pendingCount = await getActivePendingCountFromDB();
      notifyListeners({ pendingCount });
      if (navigator.onLine && pendingCount > 0) {
        await syncOfflineData();
      }
    }
  }, 45000);

  // Initial check on load
  if (navigator.onLine) {
    syncOfflineData();
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    clearInterval(interval);
  };
};

// Backwards compatibility alias
export const syncOfflineReports = syncOfflineData;
