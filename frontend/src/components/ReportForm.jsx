import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import {
  X,
  Send,
  AlertCircle,
  MapPin,
  Navigation,
  Check,
  Camera,
  Image as ImageIcon,
  Trash2,
  WifiOff
} from 'lucide-react';
import { savePendingReportToDB, saveReportsToDB } from '../services/db';

const rawApiUrl = import.meta.env.VITE_API_URL || 'https://crisis-misinformation-detector.onrender.com/api';
const API_BASE_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl.replace(/\/$/, '')}/api`;

const ReportForm = ({ onClose, user, location, onDetectLocation, onSuccess }) => {
  const { t } = useTranslation();
  const [type, setType] = useState('accident');
  const [description, setDescription] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Mobile mode: allow collapsing form to see full map and tap anywhere
  const [isMinimizedForMap, setIsMinimizedForMap] = useState(false);
  const fileInputRef = useRef(null);

  // Compress and convert image to Base64 data URL
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Selected file is not an image');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Resize down if excessively large to save IndexedDB storage and bandwidth
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
        setPhotoDataUrl(compressedDataUrl);
        setError('');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoDataUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!location) {
      setError('Please tap on the map or click "Use My Location" to set the incident location');
      return;
    }
    if (!user) {
      setError('User session not initialized yet');
      return;
    }

    setLoading(true);
    setError('');

    // Generate unique client idempotency ID
    const clientReportId = `offline_rep_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const reportData = {
      _id: clientReportId, // Temporary ID for immediate local rendering
      clientReportId,
      userId: user._id,
      reporter: user,
      type,
      description,
      longitude: location.lng,
      latitude: location.lat,
      location: {
        type: 'Point',
        coordinates: [location.lng, location.lat],
      },
      imageUrl: photoDataUrl || null,
      status: 'active',
      confirmations: 0,
      rejections: 0,
      legitimacyScore: 0,
      isOfflineSubmission: !navigator.onLine,
      createdAt: new Date().toISOString(),
    };

    try {
      if (navigator.onLine) {
        // Attempt immediate submission with clientReportId for idempotency
        try {
          const res = await axios.post(`${API_BASE_URL}/reports`, {
            userId: user._id,
            type,
            description,
            longitude: location.lng,
            latitude: location.lat,
            imageUrl: photoDataUrl,
            clientReportId,
            isOfflineSubmission: false,
          }, { timeout: 8000 });

          // Save to IndexedDB
          await saveReportsToDB([res.data]);

          onSuccess && onSuccess(res.data);
          onClose();
          return;
        } catch (onlineErr) {
          console.warn('Online submission failed, falling back to IndexedDB pending queue:', onlineErr.message);
          // If network failed mid-flight, fall through to offline storage
        }
      }

      // Offline storage into IndexedDB
      const pendingRecord = await savePendingReportToDB({
        ...reportData,
        syncStatus: 'pending',
      });

      // Also trigger success with pending record so it immediately appears in the report list
      onSuccess && onSuccess({
        ...reportData,
        _isPendingSync: true,
        syncStatus: 'pending',
      });

      onClose();
    } catch (err) {
      console.error('Failed to submit or save report:', err);
      setError(err.response?.data?.error || 'Failed to submit report. Stored locally.');
    } finally {
      setLoading(false);
    }
  };

  const crisisTypes = ['flood', 'fire', 'accident', 'earthquake', 'storm', 'medical', 'other'];

  // Minimized Banner Mode: gives user full-screen access to map to pinpoint location
  if (isMinimizedForMap) {
    return (
      <div className="slide-panel minimized-map-mode">
        <div className="sheet-handle-pill" onClick={() => setIsMinimizedForMap(false)} />
        <div className="map-picker-banner">
          <div className="map-picker-info">
            <div className="picker-icon-badge">
              <MapPin size={20} className="pulse-icon" />
            </div>
            <div className="picker-text">
              <strong>Tap anywhere on map to drop pin</strong>
              <span>
                {location
                  ? `Location set: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
                  : 'Touch map to pinpoint crisis location'}
              </span>
            </div>
          </div>

          <div className="map-picker-buttons">
            <button
              type="button"
              className="btn btn-primary btn-picker-done"
              onClick={() => setIsMinimizedForMap(false)}
            >
              <Check size={16} />
              <span>{location ? 'Confirm Pin' : 'Continue Form'}</span>
            </button>
            <button
              type="button"
              className="close-btn picker-close-btn"
              onClick={onClose}
              title="Cancel Report"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="slide-panel">
      {/* Mobile top handle */}
      <div className="sheet-handle-pill" onClick={() => setIsMinimizedForMap(true)} />

      <div className="slide-panel-header">
        <div>
          <h2>{t('reportEmergency')}</h2>
          <p>
            {!navigator.onLine ? (
              <span style={{ color: '#DC2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                <WifiOff size={13} />
                Offline Mode — Will sync when connected
              </span>
            ) : (
              'Tap map to pinpoint or fill details below'
            )}
          </p>
        </div>
        <div className="header-action-group">
          <button
            type="button"
            className="btn btn-ghost btn-map-toggle-mobile"
            onClick={() => setIsMinimizedForMap(true)}
            title="View full map to pinpoint location"
          >
            <MapPin size={16} />
            <span>Pinpoint</span>
          </button>
          <button
            type="button"
            className="close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="slide-panel-body">
        {error && (
          <div className="error-banner">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="form-label">{t('crisisType')}</label>
          <div className="type-grid">
            {crisisTypes.map((tItem) => (
              <button
                key={tItem}
                type="button"
                onClick={() => setType(tItem)}
                className={`type-option ${type === tItem ? 'selected' : ''}`}
              >
                {tItem}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="form-label">{t('description')}</label>
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what is happening at the scene..."
            className="form-textarea"
          />
        </div>

        {/* Location selector box */}
        <div className="geo-tag-box">
          <div className="geo-tag-header">
            <div className="geo-tag-icon">
              <MapPin size={18} />
            </div>
            <div className="geo-tag-info">
              <p className="geo-tag-label">Crisis Location</p>
              <p className="geo-tag-value">
                {location
                  ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
                  : 'Tap map or click buttons below'}
              </p>
            </div>
          </div>

          <div className="geo-tag-actions">
            <button
              type="button"
              onClick={() => setIsMinimizedForMap(true)}
              className="btn btn-secondary btn-pick-on-map"
              title="Collapse form and tap map to place pin"
            >
              <MapPin size={14} />
              <span>Pinpoint on Map</span>
            </button>
            <button
              type="button"
              onClick={onDetectLocation}
              className="btn btn-ghost btn-use-my-loc"
              title="Use current GPS location"
            >
              <Navigation size={14} />
              <span>{t('detectLocation')}</span>
            </button>
          </div>

          <p className="geo-tag-tip">
            * Coordinates are saved locally even without internet.
          </p>
        </div>

        {/* Photo Attachment Section */}
        <div className="photo-attachment-box">
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Camera size={15} />
            <span>Attach Photo (Saved Offline)</span>
          </label>

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            capture="environment"
            onChange={handlePhotoSelect}
            style={{ display: 'none' }}
            id="report-photo-input"
          />

          {!photoDataUrl ? (
            <button
              type="button"
              className="btn-add-photo"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon size={18} />
              <span>Take photo or choose from gallery</span>
            </button>
          ) : (
            <div className="photo-preview-wrapper">
              <img src={photoDataUrl} alt="Crisis preview" className="photo-preview-img" />
              <button
                type="button"
                className="btn-remove-photo"
                onClick={handleRemovePhoto}
                title="Remove photo"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>

        <button
          disabled={loading}
          type="submit"
          className="btn btn-primary btn-submit-report"
        >
          {loading ? (
            t('submitting')
          ) : !navigator.onLine ? (
            'Save Report Offline'
          ) : (
            t('submitReport')
          )}
        </button>
      </form>
    </div>
  );
};

export default ReportForm;
