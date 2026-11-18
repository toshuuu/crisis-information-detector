import { useState, useMemo } from 'react';
import {
  Bell,
  CheckCheck,
  X,
  Trash2,
  AlertTriangle,
  ShieldCheck,
  Trophy,
  Activity,
  Info,
  Clock,
  Flame,
  Droplets
} from 'lucide-react';

// Format timestamp into human-readable relative time
const formatTimeAgo = (dateInput) => {
  if (!dateInput) return '';
  const now = new Date();
  const date = new Date(dateInput);
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 30) return 'Just now';
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

// Category Icon mapping
const getCategoryIcon = (category, title = '') => {
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes('fire')) return <Flame size={16} className="notif-cat-icon fire" />;
  if (lowerTitle.includes('flood')) return <Droplets size={16} className="notif-cat-icon flood" />;

  switch (category) {
    case 'new_report':
      return <AlertTriangle size={16} className="notif-cat-icon alert" />;
    case 'verification':
      return <ShieldCheck size={16} className="notif-cat-icon verification" />;
    case 'reward':
      return <Trophy size={16} className="notif-cat-icon reward" />;
    case 'status_change':
      return <Activity size={16} className="notif-cat-icon status" />;
    default:
      return <Info size={16} className="notif-cat-icon info" />;
  }
};

const NotificationCenter = ({
  notifications = [],
  unreadCount = 0,
  isOpen,
  onClose,
  onMarkAsRead,
  onMarkAllAsRead,
  onDismiss,
  onDismissAll,
  onSelectReport,
  loading = false,
  isOffline = false
}) => {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'unread'

  const filteredNotifications = useMemo(() => {
    if (activeTab === 'unread') {
      return notifications.filter((n) => !n.isRead);
    }
    return notifications;
  }, [notifications, activeTab]);

  if (!isOpen) return null;

  return (
    <div className="notif-overlay" onClick={onClose}>
      <div
        className="notif-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Notification Center"
      >
        {/* Panel Header */}
        <div className="notif-header">
          <div className="notif-header-title">
            <div className="notif-bell-icon-wrap">
              <Bell size={18} />
              {unreadCount > 0 && <span className="notif-badge-count">{unreadCount}</span>}
            </div>
            <h3>Notifications</h3>
            {isOffline && <span className="notif-offline-pill">Offline</span>}
          </div>

          <div className="notif-header-actions">
            {unreadCount > 0 && (
              <button
                type="button"
                className="notif-action-btn"
                onClick={onMarkAllAsRead}
                title="Mark all as read"
                aria-label="Mark all as read"
              >
                <CheckCheck size={16} />
                <span className="notif-action-text">Read all</span>
              </button>
            )}
            <button
              type="button"
              className="notif-close-btn"
              onClick={onClose}
              title="Close notifications"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="notif-tabs">
          <button
            type="button"
            className={`notif-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All <span className="tab-pill">{notifications.length}</span>
          </button>
          <button
            type="button"
            className={`notif-tab ${activeTab === 'unread' ? 'active' : ''}`}
            onClick={() => setActiveTab('unread')}
          >
            Unread <span className="tab-pill">{unreadCount}</span>
          </button>
        </div>

        {/* Notifications Body */}
        <div className="notif-body">
          {loading ? (
            <div className="notif-empty-state">
              <div className="spin-icon">
                <Bell size={28} />
              </div>
              <p>Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="notif-empty-state">
              <div className="empty-icon-circle">
                <Bell size={28} />
              </div>
              <h4>
                {activeTab === 'unread' ? 'No unread notifications' : 'All caught up!'}
              </h4>
              <p>
                {activeTab === 'unread'
                  ? "You've reviewed all incoming alerts."
                  : 'New incident alerts and verification updates will appear here.'}
              </p>
            </div>
          ) : (
            <div className="notif-list">
              {filteredNotifications.map((notif) => {
                const isUnread = !notif.isRead;
                return (
                  <div
                    key={notif._id}
                    className={`notif-item ${isUnread ? 'unread' : 'read'}`}
                    onClick={() => {
                      if (isUnread && onMarkAsRead) {
                        onMarkAsRead(notif._id);
                      }
                      if (notif.report && onSelectReport) {
                        onSelectReport(notif.report);
                        onClose();
                      }
                    }}
                  >
                    <div className="notif-item-icon">
                      {getCategoryIcon(notif.category, notif.title)}
                    </div>

                    <div className="notif-item-content">
                      <div className="notif-item-top">
                        <span className="notif-item-title">{notif.title}</span>
                        {isUnread && <span className="unread-dot" title="Unread" />}
                      </div>

                      <p className="notif-item-msg">{notif.message}</p>

                      <div className="notif-item-meta">
                        <span className="notif-item-time">
                          <Clock size={11} />
                          {formatTimeAgo(notif.createdAt)}
                        </span>

                        {notif.report && (
                          <span className="notif-item-link">View incident &rarr;</span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="notif-dismiss-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDismiss && onDismiss(notif._id);
                      }}
                      title="Dismiss notification"
                      aria-label="Dismiss"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Panel Footer */}
        {notifications.length > 0 && (
          <div className="notif-footer">
            <button
              type="button"
              className="notif-clear-all-btn"
              onClick={onDismissAll}
            >
              <Trash2 size={13} />
              <span>Clear all notifications</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationCenter;
