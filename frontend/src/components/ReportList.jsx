import React from 'react';
import {
  Clock,
  Shield,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Trash2,
  Loader2,
  WifiOff,
  RefreshCw
} from 'lucide-react';
import { syncOfflineData } from '../services/offlineSync';

const STATUS_ICONS = {
  active: <AlertTriangle size={14} color="#FF3B3B" />,
  verified: <CheckCircle2 size={14} color="#10B981" />,
  uncertain: <Info size={14} color="#F59E0B" />,
  false: <XCircle size={14} color="#6B7280" />,
};

const SYNC_STATUS_BADGES = {
  pending: {
    label: 'Pending Sync',
    icon: <Clock size={11} />,
    className: 'badge-sync-pending',
  },
  syncing: {
    label: 'Syncing...',
    icon: <Loader2 size={11} className="spin-icon" />,
    className: 'badge-sync-syncing',
  },
  failed: {
    label: 'Sync Failed',
    icon: <AlertTriangle size={11} />,
    className: 'badge-sync-failed',
  },
  synced: {
    label: 'Synced',
    icon: <CheckCircle2 size={11} />,
    className: 'badge-sync-synced',
  },
};

const ReportList = ({ reports, onReportClick, selectedId, onDelete }) => {
  if (!reports || reports.length === 0) {
    return (
      <div className="empty-state">
        <Shield size={48} strokeWidth={1} />
        <p>No active reports in this area</p>
      </div>
    );
  }

  const handleRetrySync = (e) => {
    e.stopPropagation();
    syncOfflineData(true);
  };

  return (
    <div className="report-list">
      {reports.map((report) => {
        const isOfflinePending = report._isPendingSync || report.syncStatus === 'pending' || report.syncStatus === 'syncing' || report.syncStatus === 'failed';
        const syncBadge = report.syncStatus ? SYNC_STATUS_BADGES[report.syncStatus] : null;

        return (
          <div
            key={report._id || report.clientReportId}
            onClick={() => onReportClick(report)}
            className={`report-item ${selectedId === (report._id || report.clientReportId) ? 'selected' : ''} ${isOfflinePending ? 'offline-pending-item' : ''}`}
            title={`Crisis: ${report.type ? report.type.toUpperCase() : 'INCIDENT'} - Tap to view on map & vote`}
          >
            <div className="report-item-top">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span className="report-type-badge">{report.type}</span>

                {/* Offline Synchronization Status Chip */}
                {syncBadge && (
                  <span className={`sync-status-pill ${syncBadge.className}`}>
                    {syncBadge.icon}
                    <span>{syncBadge.label}</span>
                  </span>
                )}

                {report.isOfflineSubmission && !syncBadge && (
                  <span className="sync-status-pill badge-sync-offline">
                    <WifiOff size={10} />
                    <span>Offline Submission</span>
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className="report-time">
                  <Clock size={10} />
                  {new Date(report.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {report.syncStatus === 'failed' && (
                  <button
                    type="button"
                    className="icon-btn-retry"
                    onClick={handleRetrySync}
                    title="Retry syncing this report"
                  >
                    <RefreshCw size={12} />
                  </button>
                )}
                {onDelete && !isOfflinePending && (
                  <button
                    className="icon-btn"
                    style={{ color: 'var(--danger)', padding: 0, border: 'none', background: 'none' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(report._id);
                    }}
                    title="Delete Report"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className="report-desc">{report.description}</div>

            {/* If photo is attached, show subtle indicator or thumbnail */}
            {report.imageUrl && (
              <div className="report-has-photo-badge">
                <span className="photo-tag">📷 Photo attached</span>
              </div>
            )}

            <div className="report-bottom">
              <span className={`status-chip ${report.status || 'active'}`}>
                {STATUS_ICONS[report.status || 'active']}
                {report.status || 'active'}
              </span>

              {isOfflinePending ? (
                <>
                  <span className="dot-separator"></span>
                  <span className="unverified-offline-tag">Unverified Offline Draft</span>
                </>
              ) : (
                <>
                  <span className="dot-separator"></span>
                  <span className="vote-count">{(report.confirmations || 0) + (report.rejections || 0)} Votes</span>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ReportList;
