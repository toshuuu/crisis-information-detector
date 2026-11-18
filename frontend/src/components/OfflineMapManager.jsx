import React, { useState, useEffect } from 'react';
import {
  DownloadCloud,
  Check,
  Trash2,
  MapPin,
  HardDrive,
  AlertCircle,
  X,
  Loader2,
  Layers,
  Info
} from 'lucide-react';
import {
  downloadMapArea,
  getDownloadedRegions,
  deleteDownloadedRegion,
  getMapCacheStats
} from '../services/mapOffline';

const OfflineMapManager = ({ isOpen, onClose, currentCenter, onSelectRegion }) => {
  const [regions, setRegions] = useState([]);
  const [stats, setStats] = useState({ count: 0, estimatedSizeMB: 0 });
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [regionName, setRegionName] = useState('');
  const [radiusKm, setRadiusKm] = useState(3);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const loadData = async () => {
    try {
      const [savedRegions, cacheStats] = await Promise.all([
        getDownloadedRegions(),
        getMapCacheStats(),
      ]);
      setRegions(savedRegions || []);
      setStats(cacheStats || { count: 0, estimatedSizeMB: 0 });
    } catch (err) {
      console.warn('Failed to load map cache info:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setError(null);
      setSuccessMsg(null);
      setRegionName(
        currentCenter
          ? `Area around ${currentCenter.lat.toFixed(2)}, ${currentCenter.lng.toFixed(2)}`
          : 'My Local Crisis Zone'
      );
    }
  }, [isOpen, currentCenter]);

  if (!isOpen) return null;

  const handleDownload = async () => {
    if (!currentCenter) {
      setError('Current map center is unavailable');
      return;
    }

    setIsDownloading(true);
    setError(null);
    setSuccessMsg(null);
    setDownloadProgress({ total: 0, completed: 0, percent: 0 });

    try {
      const result = await downloadMapArea({
        name: regionName.trim() || 'Offline Zone',
        center: currentCenter,
        radiusKm: Number(radiusKm),
        zoomLevels: [13, 14],
        onProgress: (p) => setDownloadProgress(p),
      });

      setSuccessMsg(`Cached ${result.tileCount} map tiles for offline navigation!`);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to download map tiles');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  };

  const handleDeleteRegion = async (id, e) => {
    e.stopPropagation();
    try {
      const updated = await deleteDownloadedRegion(id);
      setRegions(updated);
      await loadData();
    } catch (err) {
      console.error('Failed to delete region:', err);
    }
  };

  return (
    <div className="offline-map-modal-backdrop" onClick={onClose}>
      <div className="offline-map-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="offline-map-header">
          <div className="map-modal-title">
            <div className="map-badge-icon">
              <DownloadCloud size={22} color="#FFFFFF" />
            </div>
            <div>
              <h2>Offline Map Cache</h2>
              <p>Download map areas for browsing without internet connection</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Cache Storage Stats Card */}
        <div className="map-cache-stats-card">
          <div className="stats-box">
            <HardDrive size={18} color="#DC2626" />
            <div className="stats-text">
              <span className="stats-label">Cached Tiles</span>
              <strong className="stats-value">{stats.count} tiles ({stats.estimatedSizeMB} MB)</strong>
            </div>
          </div>
          <div className="stats-box">
            <Layers size={18} color="#DC2626" />
            <div className="stats-text">
              <span className="stats-label">Saved Areas</span>
              <strong className="stats-value">{regions.length} regions</strong>
            </div>
          </div>
        </div>

        {/* Fair-use Notice Alert */}
        <div className="map-fairuse-banner">
          <Info size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Complies with OpenStreetMap tile usage guidelines. Downloads a bounded radius (max 45 tiles) with polite request rate-limiting.
          </span>
        </div>

        {error && (
          <div className="map-error-banner">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="map-success-banner">
            <Check size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Download Current Area Form */}
        <div className="download-area-section">
          <h3 className="section-title">Save Current View Offline</h3>
          <div className="form-group">
            <label className="form-label">Area Label</label>
            <input
              type="text"
              value={regionName}
              onChange={(e) => setRegionName(e.target.value)}
              placeholder="e.g. Pune Central, North District"
              className="map-input-text"
              disabled={isDownloading}
            />
          </div>

          <div className="form-row-2col">
            <div className="form-group">
              <label className="form-label">Coverage Radius</label>
              <select
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="map-select"
                disabled={isDownloading}
              >
                <option value={2}>2 km (~18 tiles)</option>
                <option value={3}>3 km (~32 tiles)</option>
                <option value={4}>4 km (~45 tiles)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Center Point</label>
              <div className="coords-display">
                <MapPin size={13} color="var(--primary)" />
                <span>
                  {currentCenter
                    ? `${currentCenter.lat.toFixed(4)}, ${currentCenter.lng.toFixed(4)}`
                    : 'Map view'}
                </span>
              </div>
            </div>
          </div>

          {/* Download Progress Bar */}
          {downloadProgress && (
            <div className="download-progress-container">
              <div className="progress-labels">
                <span>Caching tiles for offline use...</span>
                <strong>
                  {downloadProgress.completed}/{downloadProgress.total} ({downloadProgress.percent}%)
                </strong>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${downloadProgress.percent}%` }}
                />
              </div>
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary btn-start-download"
            onClick={handleDownload}
            disabled={isDownloading || !currentCenter}
          >
            {isDownloading ? (
              <>
                <Loader2 size={18} className="spin-icon" />
                <span>Downloading Map Tiles...</span>
              </>
            ) : (
              <>
                <DownloadCloud size={18} />
                <span>Cache Map Area Offline</span>
              </>
            )}
          </button>
        </div>

        {/* List of previously downloaded areas */}
        <div className="saved-regions-section">
          <h3 className="section-title">Saved Offline Regions</h3>
          {regions.length === 0 ? (
            <div className="no-regions-note">
              No custom areas saved yet. All tiles you browse while online are also automatically cached for offline viewing.
            </div>
          ) : (
            <div className="regions-list">
              {regions.map((reg) => (
                <div
                  key={reg.id}
                  className="region-item-row"
                  onClick={() => onSelectRegion && onSelectRegion(reg.center)}
                  title="Click to jump to this region"
                >
                  <div className="region-info">
                    <strong className="region-name">{reg.name}</strong>
                    <span className="region-meta">
                      {reg.radiusKm} km radius • {reg.tileCount} tiles •{' '}
                      {new Date(reg.downloadedAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-delete-region"
                    onClick={(e) => handleDeleteRegion(reg.id, e)}
                    title="Remove from saved areas"
                    aria-label="Delete region"
                  >
                    <Trash2 size={15} color="#DC2626" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="offline-map-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default OfflineMapManager;
