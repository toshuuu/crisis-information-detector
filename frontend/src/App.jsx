import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { MapPin, AlertTriangle, ShieldCheck, Trophy, Bell, LogOut, Loader2 } from 'lucide-react';
import MapComponent from './components/Map';
import ReportList from './components/ReportList';
import ReportForm from './components/ReportForm';
import Leaderboard from './components/Leaderboard';
import VerificationPanel from './components/VerificationPanel';
import NotificationCenter from './components/NotificationCenter';
import Login from './pages/Login';
import Signup from './pages/Signup';
import api from './services/api';
import { syncOfflineReports } from './services/offlineSync';
import {
  fetchUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  dismissNotification,
  dismissAllNotifications,
  syncOfflineNotificationActions
} from './services/notificationService';

const rawApiUrl = import.meta.env.VITE_API_URL || 'https://crisis-misinformation-detector.onrender.com/api';
const API_BASE_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl.replace(/\/$/, '')}/api`;
const socket = io(import.meta.env.VITE_SOCKET_URL || 'https://crisis-misinformation-detector.onrender.com');

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
  const [crisisLocation, setCrisisLocation] = useState(null);

  // Notifications State
  const [toasts, setToasts] = useState([]);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [persistentNotifications, setPersistentNotifications] = useState([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [notifsLoading, setNotifsLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Initialize User
  useEffect(() => {
    const initUser = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data);
        } catch (err) {
          console.error("Auth check failed", err);
          localStorage.removeItem('token');
        }
      }
    };
    initUser();
  }, []);

  // Fetch persistent notifications for the user
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

  // When user is initialized or changes, load their notifications and join their private socket room
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
    if (!("geolocation" in navigator)) {
      const errMsg = "Geolocation is not supported by your browser.";
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
        let errMsg = "Unable to retrieve your current location.";
        if (err.code === 1) {
          errMsg = "Location permission denied. Please allow location access in your browser settings and try again.";
        } else if (err.code === 2) {
          errMsg = "Location information is unavailable. Please check your network or device GPS connection.";
        } else if (err.code === 3) {
          errMsg = "Location request timed out. Please click 'Locate Me' again.";
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
    if ("geolocation" in navigator && location) {
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
        (err) => console.warn("Geolocation watch warning:", err),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [user, !!location]);

  // Fetch Reports
  const fetchReports = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/reports`);
      setReports(res.data);
    } catch (err) {
      console.error("Failed to fetch reports:", err);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Sync offline reports and notification actions when internet comes back
  useEffect(() => {
    const handleOnline = async () => {
      console.log("Internet connection restored.");
      setIsOffline(false);

      await syncOfflineReports();
      await syncOfflineNotificationActions();

      fetchReports();
      if (user?._id) {
        loadNotifications(user._id);
      }
    };

    const handleOffline = () => {
      console.log("Internet connection lost.");
      setIsOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [fetchReports, user?._id, loadNotifications]);

  const handleDeleteReport = async (reportId) => {
    try {
      await api.delete(`/reports/${reportId}`);
      setReports((prev) => prev.filter((r) => r._id !== reportId));
      if (selectedReport?._id === reportId) {
        setSelectedReport(null);
      }
    } catch (err) {
      console.error("Failed to delete report:", err);
    }
  };

  // Socket Listeners (Real-time events)
  useEffect(() => {
    // 1. New crisis report broadcast
    socket.on('new_report', (report) => {
      setReports((prev) => [report, ...prev]);
      setToasts((prev) => [
        { id: Date.now(), message: `Active Alert: New ${report.type} report nearby!` },
        ...prev
      ]);
      setTimeout(() => {
        setToasts((prev) => prev.slice(0, -1));
      }, 5000);
    });

    // 2. Personal persistent notification event
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
      setTimeout(() => {
        setToasts((prev) => prev.slice(0, -1));
      }, 5000);
    });

    socket.on('status_change', ({ reportId, status }) => {
      setReports((prev) => prev.map((r) => (r._id === reportId ? { ...r, status } : r)));
    });

    socket.on('verification_update', ({ reportId, status, legitimacyScore }) => {
      setReports((prev) => prev.map((r) => (r._id === reportId ? { ...r, status, legitimacyScore } : r)));
    });

    socket.on('delete_report', (reportId) => {
      setReports((prev) => prev.filter((r) => r._id !== reportId));
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
    const target = reports.find((r) => r._id === reportId);
    if (target) {
      handleReportClick(target);
    }
  };

  const trustDisplay = user ? `${(user.trustScore * 100).toFixed(0)}%` : '—';

  if (!user) {
    return isLoginView ? (
      <Login onLogin={setUser} onSwitchToSignup={() => setIsLoginView(false)} />
    ) : (
      <Signup onLogin={setUser} onSwitchToLogin={() => setIsLoginView(true)} />
    );
  }

  return (
    <div className="app-layout">
      {/* Alert Banner */}
      <div className="alert-banner">
        <AlertTriangle size={14} className="alert-banner-icon" />
        <span className="alert-banner-text">ACTIVE EMERGENCY GROUND TRUTH SYSTEM — LIVE VALIDATION ONLY</span>
      </div>

      {/* Header */}
      <header className="app-header">
        <div className="header-brand">
          <div className="brand-icon">
            <ShieldCheck size={22} />
          </div>
          <div className="brand-text">
            <h1>Crisis <span>Ground Truth</span></h1>
            <p>Validator System</p>
          </div>
        </div>

        <div className="header-right">
          <div className="user-info">
            <div className="user-name">{user?.name || 'Guest'}</div>
            <div className="user-stats">{user?.points || 0} Points • Trust: {trustDisplay}</div>
          </div>

          <button
            className="icon-btn"
            onClick={() => {
              localStorage.removeItem('token');
              setUser(null);
            }}
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
            onMarkerClick={handleReportClick}
            onMapClick={(loc) => showReportForm && setCrisisLocation(loc)}
            selectedCrisisLocation={crisisLocation}
            shouldRecenter={shouldRecenter}
            onRecenterComplete={() => setShouldRecenter(false)}
          />
          <div className="map-overlay-buttons">
            <button
              type="button"
              className="btn btn-secondary btn-locate"
              onClick={handleLocateUser}
              disabled={isLocating}
              title="Locate Me"
              aria-label="Locate Me"
            >
              {isLocating ? <Loader2 size={18} className="spin-icon" /> : <MapPin size={18} />}
              <span>{isLocating ? "Locating..." : "Locate Me"}</span>
            </button>
            <button
              className="btn btn-primary btn-report"
              onClick={() => {
                setShowReportForm(true);
                setCrisisLocation(location);
              }}
            >
              <AlertTriangle size={22} />
              Report Crisis
            </button>
          </div>
        </div>

        {/* Side Panel */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2>
              <MapPin size={18} color="var(--primary)" />
              Nearby Incidents
            </h2>
          </div>
          <div className="sidebar-body">
            <ReportList
              reports={reports}
              onReportClick={handleReportClick}
              selectedId={selectedReport?._id}
              onDelete={handleDeleteReport}
            />
          </div>
          {/* Verification Panel inside sidebar */}
          {selectedReport && !showReportForm && (
            <VerificationPanel
              report={selectedReport}
              user={user}
              userLocation={location}
              onClose={() => setSelectedReport(null)}
              onUpdate={fetchReports}
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
            onSuccess={fetchReports}
          />
        )}

        {/* Leaderboard Modal */}
        {showLeaderboard && (
          <Leaderboard onClose={() => setShowLeaderboard(false)} />
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

      {/* Floating Toast Notifications for Real-Time Feedback */}
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
