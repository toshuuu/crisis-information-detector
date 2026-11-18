import { useState } from 'react';
import axios from 'axios';
import {
  ThumbsUp,
  ThumbsDown,
  Shield,
  MapPin,
  X,
  AlertTriangle,
  CheckCircle2,
  Navigation,
  WifiOff,
  Image as ImageIcon
} from 'lucide-react';
import { enqueueSyncOperation } from '../services/db';

const rawApiUrl = import.meta.env.VITE_API_URL || 'https://crisis-misinformation-detector.onrender.com/api';
const API_BASE_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl.replace(/\/$/, '')}/api`;

// Simple distance calculation using Haversine formula
function calcDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const VerificationPanel = ({ report, user, userLocation, onClose, onUpdate, onDetectLocation }) => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [voteSubmitted, setVoteSubmitted] = useState(false);

  const isPendingSync = report._isPendingSync || report.syncStatus === 'pending' || report.syncStatus === 'syncing' || report.syncStatus === 'failed';

  const reportLat = report.location?.coordinates?.[1];
  const reportLng = report.location?.coordinates?.[0];

  const distance =
    userLocation && reportLat != null && reportLng != null
      ? calcDistanceMeters(userLocation.lat, userLocation.lng, reportLat, reportLng)
      : null;

  const distanceKm = distance != null ? (distance / 1000).toFixed(1) : null;
  const canVerify = distance != null && distance <= 10000;

  const handleVerify = async (status) => {
    if (!userLocation || !user) return;
    setLoading(true);

    const votePayload = {
      userId: user._id,
      reportId: report._id,
      status,
      longitude: userLocation.lng,
      latitude: userLocation.lat,
    };

    if (!navigator.onLine) {
      // Queue offline verification vote into IndexedDB
      try {
        await enqueueSyncOperation({
          type: 'VERIFICATION',
          payload: votePayload,
          reportId: report._id,
          userId: user._id,
        });
        setVoteSubmitted(true);
        setMessage(`Offline vote saved! Your validation (${status === 'yes' ? 'Confirmed' : 'Disputed'}) will sync automatically when back online.`);
        setTimeout(() => {
          onClose && onClose();
        }, 3000);
      } catch (err) {
        setMessage('Failed to queue offline verification vote.');
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      await axios.post(`${API_BASE_URL}/verifications`, votePayload, { timeout: 8000 });
      setVoteSubmitted(true);
      setMessage(`Vote recorded! You earned +2 points for this ${status === 'yes' ? 'confirmation' : 'rejection'}.`);
      onUpdate && onUpdate();
      setTimeout(() => {
        onClose && onClose();
      }, 2500);
    } catch (err) {
      if (!navigator.onLine || err.code === 'ERR_NETWORK') {
        // Fallback to queueing
        await enqueueSyncOperation({
          type: 'VERIFICATION',
          payload: votePayload,
          reportId: report._id,
          userId: user._id,
        });
        setVoteSubmitted(true);
        setMessage(`Offline vote queued! Will be submitted when connection restores.`);
      } else {
        setMessage(err.response?.data?.error || 'Verification failed. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Mobile backdrop overlay to tap-outside to close */}
      <div className="verify-sheet-backdrop" onClick={onClose} />

      <div className="verify-panel-wrapper">
        <div className="sheet-handle-pill" />

        <div className="verify-panel">
          {/* Header */}
          <div className="verify-info-header">
            <div className="verify-info-title">
              <div className="verify-badge-icon">
                <Shield size={18} />
              </div>
              <div>
                <h3>Crisis Verification</h3>
                <span className="verify-incident-type">
                  {report.type ? report.type.toUpperCase() : 'INCIDENT'}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="close-btn verify-close-btn"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          {/* Offline Pending Draft Notice */}
          {isPendingSync && (
            <div className="unverified-offline-banner">
              <WifiOff size={16} color="#DC2626" />
              <div>
                <strong>Unverified Offline Submission</strong>
                <p>Saved on your device. Pending synchronization with the emergency server.</p>
              </div>
            </div>
          )}

          {/* Details Card */}
          <div className="verify-desc-box">
            <p className="verify-desc-text">{report.description}</p>
          </div>

          {/* Image preview if attached */}
          {report.imageUrl && (
            <div className="verify-image-preview-box">
              <div className="preview-label">
                <ImageIcon size={13} />
                <span>Incident Photograph</span>
              </div>
              <img
                src={report.imageUrl}
                alt="Crisis Incident"
                className="verify-attached-image"
              />
            </div>
          )}

          {/* Meta stats bar */}
          <div className="verify-meta-bar">
            <div className="verify-meta-item">
              <MapPin size={14} className="meta-icon" />
              <span>{distanceKm != null ? `${distanceKm} km away` : 'Location not detected'}</span>
            </div>

            <div className="verify-meta-divider" />

            <div className="verify-meta-item">
              <span
                className={`verify-status-chip ${report.status || 'active'}`}
                style={{
                  color: report.status === 'verified' ? 'var(--success)' : 'var(--primary)',
                }}
              >
                ● Status: {report.status || 'active'}
              </span>
            </div>

            <div className="verify-meta-divider" />

            <div className="verify-meta-item votes-pill">
              {(report.confirmations || 0) + (report.rejections || 0)} votes
            </div>
          </div>

          {/* Verification Voting Actions */}
          <div className="verify-actions">
            {isPendingSync ? (
              <div className="verify-pending-draft-msg">
                <span>Community voting will open once this report is broadcast to the network.</span>
              </div>
            ) : message ? (
              <div className={`verify-message-banner ${voteSubmitted ? 'success' : 'error'}`}>
                {voteSubmitted ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                <span>{message}</span>
              </div>
            ) : !userLocation ? (
              <div className="verify-loc-needed-box">
                <div className="loc-needed-icon">
                  <Navigation size={20} />
                </div>
                <div className="loc-needed-text">
                  <strong>Location required to vote</strong>
                  <p>You must be within 10km to submit ground-truth validation</p>
                </div>
                {onDetectLocation && (
                  <button
                    type="button"
                    className="btn btn-primary btn-detect-loc"
                    onClick={onDetectLocation}
                  >
                    Locate Me
                  </button>
                )}
              </div>
            ) : !canVerify ? (
              <div className="too-far-box">
                <AlertTriangle size={18} className="too-far-icon" />
                <div>
                  <p className="too-far-title">TOO FAR TO VOTE ({distanceKm} km away)</p>
                  <p className="too-far-sub">Validators must be within 10km of the event</p>
                </div>
              </div>
            ) : (
              <div className="voting-section">
                <p className="verify-prompt">Is this crisis happening now?</p>
                <div className="verify-buttons">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleVerify('yes')}
                    className="btn btn-success btn-vote-yes"
                  >
                    <ThumbsUp size={18} />
                    <span>Yes, Confirmed</span>
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleVerify('no')}
                    className="btn btn-danger btn-vote-no"
                  >
                    <ThumbsDown size={18} />
                    <span>No, Disputed</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default VerificationPanel;
