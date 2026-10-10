import { Fragment, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Loader2 } from 'lucide-react';

const STATUS_COLORS = {
  active: '#EA4335',      // Google Red
  verified: '#34A853',    // Google Green
  uncertain: '#FBBC05',   // Google Yellow
  false: '#9AA0A6',       // Google Grey
};

// Custom SVG icon generator for Crisis Reports
const createCustomIcon = (color) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="32px" height="32px">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" stroke="white" stroke-width="1"/>
    </svg>
  `;
  return L.divIcon({
    className: 'custom-leaflet-icon',
    html: svg,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
};

// User Location Blue Dot with pulsing halo
const userLocationIcon = L.divIcon({
  className: 'user-location-marker',
  html: `
    <div style="position: relative; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;">
      <span style="position: absolute; width: 22px; height: 22px; border-radius: 50%; background-color: rgba(59, 130, 246, 0.4); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
      <svg width="20" height="20" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="8" fill="#3B82F6" stroke="white" stroke-width="3" />
      </svg>
    </div>
  `,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -11],
});

// Selected Crisis Location Marker
const selectedLocationIcon = L.divIcon({
  className: 'selected-location-marker',
  html: `
    <svg width="24" height="24" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="transparent" stroke="#10B981" stroke-width="4" stroke-dasharray="4 4" />
      <circle cx="12" cy="12" r="4" fill="#10B981" />
    </svg>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Component to center map on user location when coordinates become available or recenter is requested
const MapController = ({ center, userLocation, shouldRecenter, onRecenterComplete }) => {
  const map = useMap();
  const initialCenteredRef = useRef(false);

  // Recenter explicitly when requested (e.g. Locate Me clicked)
  useEffect(() => {
    if (shouldRecenter && userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], 16, {
        duration: 1.5,
      });
      if (onRecenterComplete) {
        onRecenterComplete();
      }
    }
  }, [shouldRecenter, userLocation, map, onRecenterComplete]);

  // Initial setView: center once on user location (zoom 15) or fallback center (zoom 13)
  useEffect(() => {
    if (!initialCenteredRef.current) {
      if (userLocation) {
        map.setView([userLocation.lat, userLocation.lng], 15);
        initialCenteredRef.current = true;
      } else if (center) {
        map.setView([center.lat, center.lng], 13);
        initialCenteredRef.current = true;
      }
    }
  }, [userLocation, center, map]);

  return null;
};

const MapClickHandler = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => {
      onMapClick && onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
};

const MapComponent = ({
  center,
  reports,
  userLocation,
  onMarkerClick,
  onMapClick,
  selectedCrisisLocation,
  shouldRecenter,
  onRecenterComplete,
  onLocate,
  isLocating,
  showLocateButton = false,
}) => {
  const defaultCenter = [18.5204, 73.8567]; // Pune coords fallback
  const mapCenter = userLocation
    ? [userLocation.lat, userLocation.lng]
    : center
    ? [center.lat, center.lng]
    : defaultCenter;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <MapContainer
        center={mapCenter}
        zoom={userLocation ? 15 : 13}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <MapController
          center={center}
          userLocation={userLocation}
          shouldRecenter={shouldRecenter}
          onRecenterComplete={onRecenterComplete}
        />
        <MapClickHandler onMapClick={onMapClick} />

        {/* OpenStreetMap Base Layer */}
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* User Location */}
        {userLocation && (
          <Fragment>
            <Marker
              position={[userLocation.lat, userLocation.lng]}
              icon={userLocationIcon}
            >
              <Popup>You are here</Popup>
            </Marker>
            {userLocation.accuracy && (
              <Circle
                center={[userLocation.lat, userLocation.lng]}
                radius={userLocation.accuracy}
                pathOptions={{
                  fillColor: '#3B82F6',
                  fillOpacity: 0.12,
                  color: '#3B82F6',
                  opacity: 0.4,
                  weight: 1.5,
                }}
              />
            )}
          </Fragment>
        )}

        {/* Selected Crisis Location */}
        {selectedCrisisLocation && (
          <Marker
            position={[selectedCrisisLocation.lat, selectedCrisisLocation.lng]}
            icon={selectedLocationIcon}
          />
        )}

        {/* Crisis Reports */}
        {reports.map((report) => {
          const lat = report.location?.coordinates?.[1];
          const lng = report.location?.coordinates?.[0];
          if (lat == null || lng == null) return null;

          const color = STATUS_COLORS[report.status] || '#FF3B3B';

          return (
            <Fragment key={report._id}>
              <Marker
                position={[lat, lng]}
                icon={createCustomIcon(color)}
                eventHandlers={{
                  click: () => onMarkerClick(report),
                }}
              />
              {report.status === 'active' && (
                <Circle
                  center={[lat, lng]}
                  radius={2000}
                  pathOptions={{
                    fillColor: '#FF3B3B',
                    fillOpacity: 0.08,
                    color: '#FF3B3B',
                    opacity: 0.2,
                    weight: 1,
                  }}
                />
              )}
            </Fragment>
          );
        })}
      </MapContainer>

      {/* Optional In-Map Locate Button */}
      {showLocateButton && onLocate && (
        <button
          type="button"
          className="btn btn-secondary btn-locate btn-map-standalone"
          onClick={onLocate}
          disabled={isLocating}
          title="Locate Me"
          aria-label="Locate Me"
        >
          {isLocating ? <Loader2 size={18} className="spin-icon" /> : <MapPin size={18} />}
          <span>{isLocating ? "Locating..." : "Locate Me"}</span>
        </button>
      )}
    </div>
  );
};

export default MapComponent;

