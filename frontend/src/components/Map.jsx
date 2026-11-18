import { Fragment, useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Loader2, WifiOff, DownloadCloud, AlertTriangle } from 'lucide-react';
import OfflineMapManager from './OfflineMapManager';

const STATUS_COLORS = {
  active: '#DC2626',      // Emergency Red
  verified: '#16A34A',    // Green
  uncertain: '#F59E0B',   // Amber
  false: '#64748B',       // Slate Grey
  pending: '#DC2626',     // Red for offline pending
};

// Custom SVG icon generator for Crisis Reports
const createCustomIcon = (color, isSelected = false, isPending = false) => {
  const size = isSelected ? 38 : 30;
  const anchorX = size / 2;
  const anchorY = size;
  const filter = isSelected
    ? `drop-shadow(0px 0px 8px ${color}) drop-shadow(0 4px 8px rgba(0,0,0,0.25))`
    : 'drop-shadow(0 2px 4px rgba(0,0,0,0.18))';

  const pulseRing = isSelected
    ? `<span style="position: absolute; width: ${size + 12}px; height: ${size + 12}px; border-radius: 50%; border: 2.5px solid ${color}; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; top: -6px; left: -6px; pointer-events: none;"></span>`
    : '';

  const pendingBadge = isPending
    ? `<span style="position: absolute; top: -3px; right: -3px; background: #DC2626; width: 10px; height: 10px; border-radius: 50%; border: 2px solid #FFFFFF;"></span>`
    : '';

  const svg = `
    <div style="position: relative; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center;">
      ${pulseRing}
      ${pendingBadge}
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="${size}px" height="${size}px" style="filter: ${filter}; transition: all 0.2s;">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" stroke="white" stroke-width="${isSelected ? 2 : 1}"/>
      </svg>
    </div>
  `;
  return L.divIcon({
    className: 'custom-leaflet-icon',
    html: svg,
    iconSize: [size, size],
    iconAnchor: [anchorX, anchorY],
  });
};

// User Location Blue Dot with pulsing halo
const userLocationIcon = L.divIcon({
  className: 'user-location-marker',
  html: `
    <div style="position: relative; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;">
      <span style="position: absolute; width: 20px; height: 20px; border-radius: 50%; background-color: rgba(220, 38, 38, 0.3); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
      <svg width="18" height="18" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="7.5" fill="#DC2626" stroke="white" stroke-width="2.5" />
      </svg>
    </div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -10],
});

// Selected Crisis Location Marker (Pulsing Pinpoint Pin)
const selectedLocationIcon = L.divIcon({
  className: 'selected-location-marker',
  html: `
    <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
      <span style="position: absolute; width: 34px; height: 34px; border-radius: 50%; background-color: rgba(220, 38, 38, 0.3); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
      <svg width="30" height="30" viewBox="0 0 24 24" fill="#DC2626" style="filter: drop-shadow(0 2px 6px rgba(0,0,0,0.25));">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" stroke="white" stroke-width="1.5"/>
      </svg>
    </div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 32],
});

// Controller to fly to user location or selected crisis
const MapController = ({ center, userLocation, selectedReport, shouldRecenter, onRecenterComplete, onBoundsChange }) => {
  const map = useMap();
  const initialCenteredRef = useRef(false);

  useEffect(() => {
    if (shouldRecenter && userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], 15, { animate: true, duration: 1.0 });
      if (onRecenterComplete) onRecenterComplete();
    }
  }, [shouldRecenter, userLocation, map, onRecenterComplete]);

  useEffect(() => {
    if (userLocation && !initialCenteredRef.current) {
      map.setView([userLocation.lat, userLocation.lng], 14);
      initialCenteredRef.current = true;
    }
  }, [userLocation, map]);

  useEffect(() => {
    if (selectedReport && selectedReport.location?.coordinates) {
      const [lng, lat] = selectedReport.location.coordinates;
      map.flyTo([lat, lng], 15, { animate: true, duration: 0.9 });
    }
  }, [selectedReport, map]);

  // Report center updates to parent for offline map downloading
  useEffect(() => {
    const handleMoveEnd = () => {
      const c = map.getCenter();
      if (onBoundsChange) {
        onBoundsChange({ lat: c.lat, lng: c.lng });
      }
    };
    map.on('moveend', handleMoveEnd);
    return () => map.off('moveend', handleMoveEnd);
  }, [map, onBoundsChange]);

  return null;
};

// Map click handler
const MapClickHandler = ({ onMapClick }) => {
  useMapEvents({
    click(e) {
      if (onMapClick) {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
  });
  return null;
};

const MapComponent = ({
  center,
  reports,
  userLocation,
  selectedReport,
  onMarkerClick,
  onMapClick,
  selectedCrisisLocation,
  shouldRecenter,
  onRecenterComplete,
  isOffline = false,
  onLocateUser,
  isLocating = false,
  onOpenReportForm,
}) => {
  const [currentMapCenter, setCurrentMapCenter] = useState(center || { lat: 18.5204, lng: 73.8567 });
  const [showMapManager, setShowMapManager] = useState(false);
  const mapRef = useRef(null);

  return (
    <div className="map-view-wrapper" style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Offline Map Mode Indicator Pill */}
      {isOffline && (
        <div className="offline-map-badge" title="Map is operating in offline mode. Previously cached tiles are being served.">
          <WifiOff size={13} />
          <span>Offline Map Mode — Cached Tiles</span>
        </div>
      )}

      {/* Vertical Map Action Rail (Organized vertically, no collisions) */}
      <div className="map-floating-rail">
        {onLocateUser && (
          <button
            type="button"
            className="map-rail-btn btn-rail-locate btn-locate"
            onClick={onLocateUser}
            disabled={isLocating}
            title="Locate My Position"
            aria-label="Locate My Position"
          >
            {isLocating ? (
              <Loader2 size={18} className="spin-icon" color="#DC2626" />
            ) : (
              <MapPin size={18} color="#DC2626" />
            )}
          </button>
        )}

        <button
          type="button"
          className="map-rail-btn btn-rail-offline btn-offline-map-manager"
          onClick={() => setShowMapManager(true)}
          title="Offline Map Cache"
          aria-label="Offline Map Manager"
        >
          <DownloadCloud size={18} color="#DC2626" />
        </button>
      </div>

      {/* Floating Report Button */}
      {onOpenReportForm && (
        <button
          type="button"
          className="btn btn-primary btn-report btn-floating-report"
          onClick={onOpenReportForm}
          title="Report Emergency Incident"
        >
          <AlertTriangle size={18} />
          <span>Report Crisis</span>
        </button>
      )}

      <MapContainer
        center={[center.lat, center.lng]}
        zoom={13}
        style={{ height: '100%', width: '100%', background: '#F8FAFC' }}
        ref={mapRef}
      >
        <MapController
          center={center}
          userLocation={userLocation}
          selectedReport={selectedReport}
          shouldRecenter={shouldRecenter}
          onRecenterComplete={onRecenterComplete}
          onBoundsChange={setCurrentMapCenter}
        />
        <MapClickHandler onMapClick={onMapClick} />

        {/* OpenStreetMap Base Layer - Intercepted & cached by Service Worker */}
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={18}
          keepBuffer={4}
        />

        {/* User Location Marker & Accuracy Circle */}
        {userLocation && (
          <Fragment>
            <Marker position={[userLocation.lat, userLocation.lng]} icon={userLocationIcon}>
              <Popup>
                <div style={{ textAlign: 'center', padding: '4px' }}>
                  <strong style={{ color: '#DC2626' }}>Your Current Location</strong>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                    Accuracy: ±{Math.round(userLocation.accuracy || 0)}m
                  </div>
                </div>
              </Popup>
            </Marker>
            {userLocation.accuracy && (
              <Circle
                center={[userLocation.lat, userLocation.lng]}
                radius={Math.min(userLocation.accuracy, 500)}
                pathOptions={{
                  fillColor: '#DC2626',
                  fillOpacity: 0.08,
                  color: '#DC2626',
                  opacity: 0.35,
                  weight: 1.5,
                }}
              />
            )}
          </Fragment>
        )}

        {/* Selected Crisis Location Pinpoint (during report creation) */}
        {selectedCrisisLocation && (
          <Marker
            position={[selectedCrisisLocation.lat, selectedCrisisLocation.lng]}
            icon={selectedLocationIcon}
          >
            <Popup>
              <div style={{ textAlign: 'center', padding: '4px' }}>
                <strong style={{ color: '#DC2626' }}>Selected Incident Location</strong>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                  {selectedCrisisLocation.lat.toFixed(4)}, {selectedCrisisLocation.lng.toFixed(4)}
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Crisis Reports Markers */}
        {reports.map((report) => {
          if (!report.location?.coordinates) return null;
          const [lng, lat] = report.location.coordinates;
          const isSelected = selectedReport?._id === report._id || selectedReport?.clientReportId === report.clientReportId;
          const isPending = report.syncStatus === 'pending' || report.syncStatus === 'syncing' || report.syncStatus === 'failed';
          const markerColor = isPending ? STATUS_COLORS.pending : (STATUS_COLORS[report.status] || STATUS_COLORS.active);

          return (
            <Marker
              key={report._id || report.clientReportId}
              position={[lat, lng]}
              icon={createCustomIcon(markerColor, isSelected, isPending)}
              eventHandlers={{
                click: () => onMarkerClick(report),
              }}
            >
              <Tooltip
                direction="top"
                offset={[0, -28]}
                opacity={0.96}
                className="crisis-leaflet-tooltip"
              >
                <div className="crisis-tooltip-content">
                  <div className="crisis-tooltip-badge-row">
                    <span className="crisis-tooltip-type" style={{ backgroundColor: markerColor }}>
                      {report.type}
                    </span>
                    <span className="crisis-tooltip-status">
                      {isPending ? 'Pending Sync' : report.status}
                    </span>
                  </div>
                  <div className="crisis-tooltip-title">{report.description}</div>
                  <div className="crisis-tooltip-meta">
                    <span>
                      {isPending
                        ? 'Saved Offline'
                        : `${(report.confirmations || 0) + (report.rejections || 0)} votes`}
                    </span>
                    <span className="crisis-tooltip-cta">Tap to view</span>
                  </div>
                </div>
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Offline Map Manager Modal */}
      {showMapManager && (
        <OfflineMapManager
          isOpen={showMapManager}
          onClose={() => setShowMapManager(false)}
          currentCenter={currentMapCenter}
          onSelectRegion={(coords) => {
            if (mapRef.current) {
              mapRef.current.flyTo([coords.lat, coords.lng], 14);
            }
            setShowMapManager(false);
          }}
        />
      )}
    </div>
  );
};

export default MapComponent;
