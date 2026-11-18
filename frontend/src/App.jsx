import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import {
  MapPin,
  AlertTriangle,
  ShieldCheck,
  Trophy,
  Bell,
  LogOut,
  Loader2,
  Wifi,
  WifiOff,
  RefreshCw,
  HeartPulse,
  Download,
  CheckCircle2,
  Info,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import MapComponent from './components/Map';
import ReportList from './components/ReportList';
import ReportForm from './components/ReportForm';
import Leaderboard from './components/Leaderboard';
import VerificationPanel from './components/VerificationPanel';
import NotificationCenter from './components/NotificationCenter';
import EmergencyResourcesModal from './components/EmergencyResourcesModal';
import Login from './pages/Login';
import Signup from './pages/Signup';
import api from './services/api';
import {
  getCachedReportsFromDB,
  saveReportsToDB,
  getPendingReportsFromDB,
  deleteCachedReportFromDB,
  clearUserNotificationsFromDB,
  getLastActiveUser,
  saveOfflineUserProfile
} from './services/db';
import {
  initConnectivitySync,
  syncOfflineData,
  subscribeSyncStatus
} from './services/offlineSync';
import {
  fetchUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  dismissNotification,
  dismissAllNotifications,
  createLocalNotification
} from './services/notificationService';

const rawApiUrl = import.meta.env.VITE_API_URL || 'https://crisis-misinformation-detector.onrender.com/api';
const API_BASE_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl.replace(/\/$/, '')}/api`;
const socket = io(import.meta.env.VITE_SOCKET_URL || 'https://crisis-misinformation-detector.onrender.com');

// Helper to format last sync timestamp
const formatLastSync = (timestamp) => {
  if (!timestamp) return 'Never';
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 15) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

function App() {
  const [isLoginView, setIsLoginView] = useState(true);
  const [user, setUser] = useState(null);
  const [location, setLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [shouldRecenter, setShouldRecenter] = useState(false);
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showReportForm, setShowReportForm] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [crisisLocation, setCrisisLocation] = useState(null);

  // Notifications State
  const [toasts, setToasts] = useState([]);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [persistentNotifications, setPersistentNotifications] = useState([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [notifsLoading, setNotifsLoading] = useState(false);

  // Connectivity & Synchronization State
  const [syncState, setSyncState] = useState({
    status: navigator.onLine ? 'online' : 'offline',
    isOnline: navigator.onLine,
    isSyncing: false,
    pendingCount: 0,
    lastSyncTime: null,
    error: null,
  });

  // PWA Installation prompt
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  // Listen for PWA beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      console.log('[PWA] beforeinstallprompt event captured');
    };

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setInstallPrompt(null);
      console.log('[PWA] App successfully installed!');
      setToasts((prev) => [{ id: Date.now(), message: 'Crisis Information Detector installed successfully!' }, ...prev]);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    console.log(`[PWA] Install choice: ${outcome}`);
    setInstallPrompt(null);
  };

  // Subscribe to offline sync and connectivity monitor
  useEffect(() => {
    const unsubscribe = subscribeSyncStatus((state) => {
      setSyncState(state);
    });

    const cleanupConnectivity = initConnectivitySync();

    return () => {
      unsubscribe();
      cleanupConnectivity();
    };
  }, []);

  // Listen for sync events
  useEffect(() => {
    const handleSyncComplete = (e) => {
      const { reportResults } = e.detail || {};
      if (reportResults?.syncedCount > 0) {
        setToasts((prev) => [
          { id: Date.now(), message: `Synced ${reportResults.syncedCount} offline incident report(s)!` },
          ...prev
        ]);
        setTimeout(() => setToasts((prev) => prev.slice(0, -1)), 5000);
      }
      fetchReports();
      if (user?._id) {
        loadNotifications(user._id);
      }
    };

    const handleAuthExpired = () => {
      setToasts((prev) => [
        { id: Date.now(), message: 'Session expired. Please log in again to sync pending reports.' },
        ...prev
      ]);
      setTimeout(() => setToasts((prev) => prev.slice(0, -1)), 6000);
    };

    window.addEventListener('offline_sync_completed', handleSyncComplete);
    window.addEventListener('offline_sync_auth_expired', handleAuthExpired);

    return () => {
      window.removeEventListener('offline_sync_completed', handleSyncComplete);
      window.removeEventListener('offline_sync_auth_expired', handleAuthExpired);
    };
  }, [user?._id]);

  // Initialize User session (supports online verification & offline profile recovery)
  useEffect(() => {
    const initUser = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        if (navigator.onLine) {
          try {
            const res = await api.get('/auth/me', { timeout: 4000 });
            setUser(res.data);
            await saveOfflineUserProfile(res.data, token);
          } catch (err) {
            console.warn('Auth online check warning:', err.message);
            if (err.response?.status === 401) {
              localStorage.removeItem('token');
              setUser(null);
            } else {
              // Network timeout/unreachable: recover cached offline profile
              const cachedUser = await getLastActiveUser();
              if (cachedUser) {
                setUser(cachedUser);
              }
            }
          }
        } else {
          // Offline mode: restore cached user profile from IndexedDB
          const cachedUser = await getLastActiveUser();
          if (cachedUser) {
            setUser(cachedUser);
          }
        }
      }
    };
    initUser();
  }, []);

  // Fetch persistent notifications with IndexedDB fallback
  const loadNotifications = useCallback(async (userId) => {
    if (!userId) return;
    setNotifsLoading(true);
    try {
      const data = await fetchUserNotifications(userId);
      setPersistentNotifications(data.notifications || []);
      setUnreadNotifCount(data.unreadCount || 0);
    } catch (e) {
      console.error('Failed to load notifications:', e);
    } finally {
      setNotifsLoading(false);
    }
  }, []);

  // When user is initialized or changes, load notifications & join private socket room
  useEffect(() => {
    if (user?._id) {
      loadNotifications(user._id);
      socket.emit('join_user', user._id);
      if (location) {
        socket.emit('join_location', {
          lat: location.lat,
          lng: location.lng,
          userId: user._id
        });
      }
    } else {
      setPersistentNotifications([]);
      setUnreadNotifCount(0);
      setShowNotificationCenter(false);
    }
  }, [user?._id, loadNotifications]);

  // Handler to locate user via browser geolocation API
  const handleLocateUser = useCallback(() => {
    if (!('geolocation' in navigator)) {
      const errMsg = 'Geolocation is not supported by your browser.';
      setLocationError(errMsg);
      setToasts((prev) => [{ id: Date.now(), message: errMsg }, ...prev]);
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setLocation(newCoords);
        setShouldRecenter(true);
        setIsLocating(false);
        setLocationError(null);

        if (user) {
          socket.emit('join_location', {
            lat: newCoords.lat,
            lng: newCoords.lng,
            userId: user._id,
          });
        }
      },
      (err) => {
        setIsLocating(false);
        let errMsg = 'Unable to retrieve your current location.';
        if (err.code === 1) {
          errMsg = 'Location permission denied. Please allow location access in your browser settings.';
        } else if (err.code === 2) {
          errMsg = 'Location information is unavailable. Check device GPS.';
        } else if (err.code === 3) {
          errMsg = 'Location request timed out. Please click "Locate Me" again.';
        }
        setLocationError(errMsg);
        setToasts((prev) => [{ id: Date.now(), message: errMsg }, ...prev]);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [user]);

  // Keep location updated in background once location is granted
  useEffect(() => {
    if ('geolocation' in navigator && location) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setLocation((prev) => ({
            ...(prev || {}),
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          }));
          if (user) {
            socket.emit('join_location', { lat: pos.coords.latitude, lng: pos.coords.longitude, userId: user._id });
          }
        },
        (err) => console.warn('Geolocation watch warning:', err),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [user, !!location]);

  // Fetch Reports (Offline-First: loads IndexedDB first, merges pending reports, then attempts online fetch)
  const fetchReports = useCallback(async () => {
    try {
      // 1. Instantly load cached reports from IndexedDB
      const cached = await getCachedReportsFromDB();
      // 2. Load pending offline reports
      const pending = await getPendingReportsFromDB();

      // Merge: pending items first with _isPendingSync tag, then cached
      const pendingMap = new Set(pending.map((p) => p.serverReportId || p.clientReportId));
      const initialMerged = [
        ...pending.map((p) => ({ ...p, _isPendingSync: true })),
        ...cached.filter((c) => !pendingMap.has(c._id) && !pendingMap.has(c.clientReportId)),
      ];
      setReports(initialMerged);

      // 3. If online, fetch fresh reports from backend
      if (navigator.onLine) {
        try {
          const res = await axios.get(`${API_BASE_URL}/reports`, { timeout: 6000 });
          // Save server list into IndexedDB
          await saveReportsToDB(res.data);

          // Re-fetch pending to ensure no collision
          const freshPending = await getPendingReportsFromDB();
          const freshPendingMap = new Set(freshPending.map((p) => p.serverReportId || p.clientReportId));

          const merged = [
            ...freshPending.map((p) => ({ ...p, _isPendingSync: true })),
            ...res.data.filter((c) => !freshPendingMap.has(c._id) && !freshPendingMap.has(c.clientReportId)),
          ];
          setReports(merged);
        } catch (netErr) {
          console.warn('[Reports] Online fetch failed, relying on IndexedDB cache:', netErr.message);
        }
      }
    } catch (err) {
      console.error('Failed to load reports from database:', err);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleDeleteReport = async (reportId) => {
    try {
      await api.delete(`/reports/${reportId}`);
      await deleteCachedReportFromDB(reportId);
      setReports((prev) => prev.filter((r) => r._id !== reportId));
      if (selectedReport?._id === reportId) {
        setSelectedReport(null);
      }
    } catch (err) {
      console.error('Failed to delete report:', err);
    }
  };

  // Real-time Socket.IO Listeners
  useEffect(() => {
    socket.on('new_report', (report) => {
      setReports((prev) => [report, ...prev]);
      saveReportsToDB([report]); // Cache immediately in IndexedDB
      setToasts((prev) => [
        { id: Date.now(), message: `Active Alert: New ${report.type} report nearby!` },
        ...prev
      ]);
      setTimeout(() => setToasts((prev) => prev.slice(0, -1)), 5000);
    });

    socket.on('notification', (notif) => {
      setPersistentNotifications((prev) => [
        notif,
        ...prev.filter((n) => n._id !== notif._id)
      ]);
      if (!notif.isRead) {
        setUnreadNotifCount((prev) => prev + 1);
      }
      setToasts((prev) => [
        { id: Date.now(), message: `${notif.title}: ${notif.message}` },
        ...prev
      ]);
      setTimeout(() => setToasts((prev) => prev.slice(0, -1)), 5000);
    });

    socket.on('status_change', ({ reportId, status }) => {
      setReports((prev) => prev.map((r) => (r._id === reportId ? { ...r, status } : r)));
    });

    socket.on('verification_update', ({ reportId, status, legitimacyScore }) => {
      setReports((prev) => prev.map((r) => (r._id === reportId ? { ...r, status, legitimacyScore } : r)));
    });

    socket.on('delete_report', (reportId) => {
      setReports((prev) => prev.filter((r) => r._id !== reportId));
      deleteCachedReportFromDB(reportId);
      setSelectedReport((prev) => (prev?._id === reportId ? null : prev));
    });

    return () => {
      socket.off('new_report');
      socket.off('notification');
      socket.off('status_change');
      socket.off('verification_update');
      socket.off('delete_report');
    };
  }, []);

  const handleReportClick = (report) => {
    setSelectedReport(report);
    setShowReportForm(false);
  };

  // Notification interaction handlers
  const handleMarkAsRead = async (id) => {
    if (!user?._id) return;
    setPersistentNotifications((prev) =>
      prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
    );
    setUnreadNotifCount((prev) => Math.max(0, prev - 1));
    await markNotificationAsRead(id, user._id);
  };

  const handleMarkAllAsRead = async () => {
    if (!user?._id) return;
    setPersistentNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true }))
    );
    setUnreadNotifCount(0);
    await markAllNotificationsAsRead(user._id);
  };

  const handleDismissNotification = async (id) => {
    if (!user?._id) return;
    const item = persistentNotifications.find((n) => n._id === id);
    if (item && !item.isRead) {
      setUnreadNotifCount((prev) => Math.max(0, prev - 1));
    }
    setPersistentNotifications((prev) => prev.filter((n) => n._id !== id));
    await dismissNotification(id, user._id);
  };

  const handleDismissAllNotifications = async () => {
    if (!user?._id) return;
    setPersistentNotifications([]);
    setUnreadNotifCount(0);
    await dismissAllNotifications(user._id);
  };

  const handleSelectReportFromNotif = (reportRef) => {
    const reportId = typeof reportRef === 'object' ? reportRef._id : reportRef;
    const target = reports.find((r) => r._id === reportId || r.clientReportId === reportId);
    if (target) {
      handleReportClick(target);
    }
  };

  const handleManualSync = async () => {
    await syncOfflineData(true);
    fetchReports();
    if (user?._id) {
      loadNotifications(user._id);
    }
  };

  const handleLogout = async () => {
    if (user?._id) {
      // Clear user private cached notifications for multi-user security
      await clearUserNotificationsFromDB(user._id);
    }
    localStorage.removeItem('token');
    setUser(null);
  };

  const trustDisplay = user ? `${(user.trustScore * 100).toFixed(0)}%` : '—';
  const isOffline = !syncState.isOnline || syncState.status === 'offline';

  if (!user) {
    return isLoginView ? (
      <Login onLogin={setUser} onSwitchToSignup={() => setIsLoginView(false)} />
    ) : (
      <Signup onLogin={setUser} onSwitchToLogin={() => setIsLoginView(true)} />
    );
  }

  return (
    <div className="app-layout">
      {/* Alert Banner / Dynamic Connectivity Banner */}
      <div className={`alert-banner ${isOffline ? 'offline-banner' : syncState.status === 'synchronizing' ? 'syncing-banner' : ''}`}>
        {isOffline ? (
          <>
            <WifiOff size={14} className="alert-banner-icon offline" />
            <span className="alert-banner-text">
              OFFLINE ARCHIVE — DISPLAYING CACHED INCIDENTS (LAST SYNC: {formatLastSync(syncState.lastSyncTime)})
            </span>
          </>
        ) : syncState.status === 'synchronizing' ? (
          <>
            <Loader2 size={14} className="alert-banner-icon spin-icon" />
            <span className="alert-banner-text">
              SYNCHRONIZING WITH EMERGENCY NETWORK...
            </span>
          </>
        ) : syncState.status === 'sync_failed' ? (
          <>
            <AlertTriangle size={14} className="alert-banner-icon" />
            <span className="alert-banner-text">
              SYNC FAILED — {syncState.pendingCount} ITEM(S) PENDING — CLICK 'SYNC NOW' TO RETRY
            </span>
          </>
        ) : (
          <>
            <AlertTriangle size={14} className="alert-banner-icon" />
            <span className="alert-banner-text">
              ACTIVE EMERGENCY GROUND TRUTH SYSTEM — LIVE VALIDATION ONLY
            </span>
          </>
        )}
      </div>

      {/* Global Connectivity & Synchronization Status Section */}
      <div className="sync-status-strip">
        <div className="status-strip-left">
          <div className={`connection-pill ${syncState.status}`}>
            <span className="connection-dot" />
            <span className="connection-label">
              {syncState.status === 'synchronizing'
                ? 'Syncing...'
                : syncState.status === 'sync_failed'
                ? 'Sync Failed'
                : isOffline
                ? 'Offline'
                : 'Online'}
            </span>
          </div>

          <span className="sync-timestamp">
            Last Synced: {formatLastSync(syncState.lastSyncTime)}
          </span>

          {syncState.pendingCount > 0 && (
            <span className="pending-badge-counter" title={`${syncState.pendingCount} reports waiting to sync`}>
              {syncState.pendingCount} Pending
            </span>
          )}
        </div>

        <div className="status-strip-right">
          <button
            type="button"
            className="btn-sync-action"
            onClick={handleManualSync}
            disabled={syncState.isSyncing}
            title="Verify server connection and sync pending data"
          >
            <RefreshCw size={13} className={syncState.isSyncing ? 'spin-icon' : ''} />
            <span>{syncState.isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>

          <button
            type="button"
            className="btn-emergency-action"
            onClick={() => setShowEmergencyModal(true)}
            title="Offline Emergency Helplines, First-Aid & Shelters"
          >
            <HeartPulse size={13} color="#FFFFFF" />
            <span>Emergency Info</span>
          </button>

          {installPrompt && (
            <button
              type="button"
              className="btn-install-pwa"
              onClick={handleInstallClick}
              title="Install app to home screen for offline access"
            >
              <Download size={13} />
              <span>Install App</span>
            </button>
          )}
        </div>
      </div>

      {/* Header */}
      <header className="app-header">
        <div className="header-brand">
          <div className="brand-icon">
            <ShieldCheck size={22} />
          </div>
          <div className="brand-text">
            <h1>Crisis <span>Ground Truth</span></h1>
            <p>Validator System {isOffline ? '(Offline)' : ''}</p>
          </div>
        </div>

        <div className="header-right">
          <div className="user-info">
            <div className="user-name">{user?.name || 'Guest'}</div>
            <div className="user-stats">{user?.points || 0} Points • Trust: {trustDisplay}</div>
          </div>

          <button
            className="icon-btn"
            onClick={handleLogout}
            title="Logout"
            style={{ color: 'var(--primary)' }}
          >
            <LogOut size={20} />
          </button>

          <button
            className="icon-btn"
            onClick={() => setShowLeaderboard(!showLeaderboard)}
            title="Leaderboard"
          >
            <Trophy size={20} />
          </button>

          {/* Persistent Notification Bell Button */}
          <button
            type="button"
            className="icon-btn notif-bell-btn"
            onClick={() => setShowNotificationCenter(!showNotificationCenter)}
            title={`Notifications (${unreadNotifCount} unread)`}
            aria-label={`Notifications (${unreadNotifCount} unread)`}
          >
            <Bell size={20} />
            {unreadNotifCount > 0 && (
              <span className="notification-badge">
                {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* Map */}
        <div className="map-container">
          {locationError && (
            <div className="location-error-alert">
              <AlertTriangle size={18} />
              <span>{locationError}</span>
              <button
                type="button"
                className="close-error-btn"
                onClick={() => setLocationError(null)}
                aria-label="Dismiss error"
              >
                &times;
              </button>
            </div>
          )}
          <MapComponent
            center={location || { lat: 18.5204, lng: 73.8567 }}
            reports={reports}
            userLocation={location}
            selectedReport={selectedReport}
            onMarkerClick={handleReportClick}
            onMapClick={(loc) => showReportForm && setCrisisLocation(loc)}
            selectedCrisisLocation={crisisLocation}
            shouldRecenter={shouldRecenter}
            onRecenterComplete={() => setShouldRecenter(false)}
            isOffline={isOffline}
            onLocateUser={handleLocateUser}
            isLocating={isLocating}
            onOpenReportForm={() => {
              setShowReportForm(true);
              setCrisisLocation(location);
            }}
          />
        </div>

        {/* Backdrop for mobile drawer */}
        {isMobileDrawerOpen && (
          <div
            className="mobile-drawer-backdrop"
            onClick={() => setIsMobileDrawerOpen(false)}
          />
        )}

        {/* Side Panel / Collapsible Mobile Bottom Sheet */}
        <aside className={`sidebar ${isMobileDrawerOpen ? 'mobile-drawer-open' : 'mobile-drawer-collapsed'}`}>
          {/* Mobile Peek Handle Bar */}
          <div
            className="mobile-drawer-peek-bar"
            onClick={() => setIsMobileDrawerOpen(!isMobileDrawerOpen)}
          >
            <div className="drawer-handle-pill" />
            <div className="drawer-peek-row">
              <div className="drawer-peek-info">
                <MapPin size={15} color="#DC2626" />
                <span className="drawer-peek-count">{reports.length} Incidents</span>
                {syncState.pendingCount > 0 && (
                  <span className="pending-sidebar-pill">
                    {syncState.pendingCount} pending
                  </span>
                )}
              </div>
              <button
                type="button"
                className="drawer-peek-toggle-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMobileDrawerOpen(!isMobileDrawerOpen);
                }}
              >
                <span>{isMobileDrawerOpen ? 'View Map' : 'View List'}</span>
                {isMobileDrawerOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </button>
            </div>
          </div>

          <div className="sidebar-header">
            <h2>
              <MapPin size={18} color="var(--primary)" />
              {isOffline ? 'Cached Incidents' : 'Nearby Incidents'}
              {syncState.pendingCount > 0 && (
                <span className="pending-sidebar-pill">
                  {syncState.pendingCount} pending
                </span>
              )}
            </h2>
          </div>
          <div className="sidebar-body">
            <ReportList
              reports={reports}
              onReportClick={(rep) => {
                handleReportClick(rep);
                setIsMobileDrawerOpen(false);
              }}
              selectedId={selectedReport?._id || selectedReport?.clientReportId}
              onDelete={handleDeleteReport}
            />
          </div>

          {/* Verification Panel inside sidebar / mobile sheet */}
          {selectedReport && !showReportForm && (
            <VerificationPanel
              report={selectedReport}
              user={user}
              userLocation={location}
              onClose={() => setSelectedReport(null)}
              onUpdate={fetchReports}
              onDetectLocation={handleLocateUser}
            />
          )}
        </aside>

        {/* Report Form */}
        {showReportForm && (
          <ReportForm
            onClose={() => {
              setShowReportForm(false);
              setCrisisLocation(null);
            }}
            user={user}
            location={crisisLocation}
            userLocation={location}
            onDetectLocation={() => {
              if (location) {
                setCrisisLocation(location);
              } else {
                handleLocateUser();
              }
            }}
            onSuccess={(newReport) => {
              fetchReports();
              if (newReport) {
                setSelectedReport(newReport);
              }
            }}
          />
        )}

        {/* Leaderboard Modal */}
        {showLeaderboard && (
          <Leaderboard onClose={() => setShowLeaderboard(false)} />
        )}

        {/* Emergency Resources Modal */}
        {showEmergencyModal && (
          <EmergencyResourcesModal
            isOpen={showEmergencyModal}
            onClose={() => setShowEmergencyModal(false)}
            userLocation={location}
          />
        )}

        {/* Persistent Notification Center Dropdown / Panel */}
        <NotificationCenter
          notifications={persistentNotifications}
          unreadCount={unreadNotifCount}
          isOpen={showNotificationCenter}
          onClose={() => setShowNotificationCenter(false)}
          onMarkAsRead={handleMarkAsRead}
          onMarkAllAsRead={handleMarkAllAsRead}
          onDismiss={handleDismissNotification}
          onDismissAll={handleDismissAllNotifications}
          onSelectReport={handleSelectReportFromNotif}
          loading={notifsLoading}
          isOffline={isOffline}
        />
      </main>

      {/* Floating Toast Notifications */}
      <div className="toast-container">
        {toasts.slice(0, 3).map((n) => (
          <div key={n.id} className="toast">
            <Bell size={18} />
            <span>{n.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
