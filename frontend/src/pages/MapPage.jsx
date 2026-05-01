import { useState, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { GoogleMap, useJsApiLoader, InfoWindowF } from '@react-google-maps/api';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { api } from '../services/api.js';
import { format } from 'date-fns';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const MAP_OPTIONS = {
  mapTypeId: 'roadmap',
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: true,
  streetViewControl: false,
  fullscreenControl: true,
  styles: [
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  ],
};

// Default center: Nairobi, Kenya — adjusts once devices load
const DEFAULT_CENTER = { lat: -1.286389, lng: 36.817223 };
const DEFAULT_ZOOM = 5;

const STATUS_COLORS = {
  online:      '#16a34a',
  offline:     '#6b7280',
  alert:       '#dc2626',
  maintenance: '#d97706',
};

function statusIcon(status) {
  const color = STATUS_COLORS[status] || '#6b7280';
  // Custom SVG pin as Data URL
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 9.625 14 22 14 22S28 23.625 28 14C28 6.268 21.732 0 14 0z" fill="${color}" stroke="white" stroke-width="1.5"/>
    <circle cx="14" cy="14" r="6" fill="white" fill-opacity="0.9"/>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: { width: 28, height: 36 },
    anchor: { x: 14, y: 36 },
  };
}

function DeviceInfoWindow({ device, onClose }) {
  const readings = device.latestReadings || [];

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 200, maxWidth: 260, padding: '12px 16px' }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: '#111827' }}>
        {device.name}
      </div>

      <div style={{ marginBottom: 8 }}>
        <span style={{
          display: 'inline-block', padding: '2px 8px', borderRadius: 9999,
          fontSize: 11, fontWeight: 600,
          background: device.status === 'online' ? '#dcfce7' : '#f3f4f6',
          color: device.status === 'online' ? '#166534' : '#374151',
        }}>
          {device.status}
        </span>
      </div>

      {device.locationName && (
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
          📍 {device.locationName}
        </div>
      )}
      {device.lastSeenAt && (
        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>
          Last seen: {format(new Date(device.lastSeenAt), 'MMM d, HH:mm')}
        </div>
      )}
      {device.batteryLevel != null && (
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
          🔋 Battery: {device.batteryLevel}%
        </div>
      )}

      {readings.length > 0 && (
        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Latest Readings
          </div>
          {readings.slice(0, 5).map(r => (
            <div key={r._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: '1px solid #f9fafb' }}>
              <span style={{ fontSize: 11, color: '#6b7280' }}>{r._id}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#111827' }}>{r.value?.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MapPage() {
  const { t } = useTranslation();
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [map, setMap] = useState(null);
  const clustererRef = useRef(null);
  const markersRef = useRef([]);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: ['marker'],
  });

  const { data: devices, isLoading } = useQuery({
    queryKey: ['map-data'],
    queryFn: api.getMapData,
    refetchInterval: 30_000,
  });

  const onMapLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
  }, []);

  // Place markers + clusterer once map + devices are ready
  const onMapIdle = useCallback(() => {
    if (!map || !devices) return;

    // Clear previous markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
    }

    const positioned = devices.filter(d => d.location?.coordinates);

    const newMarkers = positioned.map(device => {
      const [lng, lat] = device.location.coordinates;
      const icon = statusIcon(device.status);

      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        icon,
        title: device.name,
        optimized: true,
      });

      marker.addListener('click', () => setSelectedDevice(device));
      return marker;
    });

    markersRef.current = newMarkers;

    // Clusterer
    clustererRef.current = new MarkerClusterer({
      map,
      markers: newMarkers,
      renderer: {
        render: ({ count, position }) => new window.google.maps.Marker({
          position,
          label: {
            text: String(count),
            color: 'white',
            fontSize: '12px',
            fontWeight: 'bold',
          },
          icon: {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="18" fill="#2563eb" fill-opacity="0.85" stroke="white" stroke-width="2"/></svg>`
            )}`,
            scaledSize: new window.google.maps.Size(40, 40),
          },
        }),
      },
    });

    // Auto-fit bounds if devices exist
    if (positioned.length > 0 && positioned.length <= 100) {
      const bounds = new window.google.maps.LatLngBounds();
      positioned.forEach(d => {
        const [lng, lat] = d.location.coordinates;
        bounds.extend({ lat, lng });
      });
      map.fitBounds(bounds, { top: 60, right: 40, bottom: 40, left: 40 });
      if (map.getZoom() > 14) map.setZoom(14);
    }
  }, [map, devices]);

  const onlineCount  = devices?.filter(d => d.status === 'online').length ?? 0;
  const offlineCount = devices?.filter(d => d.status === 'offline').length ?? 0;
  const alertCount   = devices?.filter(d => d.status === 'alert').length ?? 0;
  const withCoords   = devices?.filter(d => d.location?.coordinates).length ?? 0;

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        Failed to load Google Maps: {loadError.message}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="px-6 py-3 flex items-center justify-between border-b border-gray-200 bg-white flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('nav.map')}</h1>
          <p className="text-gray-500 text-xs mt-0.5">{withCoords} devices with coordinates</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Legend */}
          {Object.entries(STATUS_COLORS).map(([s, c]) => (
            <div key={s} className="flex items-center gap-1.5 text-xs text-gray-600 capitalize">
              <span style={{ background: c }} className="w-2.5 h-2.5 rounded-full inline-block shadow-sm" />
              {s}
            </div>
          ))}

          {/* Quick stats */}
          <div className="flex gap-2 ml-4 border-l pl-4">
            <span className="badge badge-green">{onlineCount} online</span>
            {alertCount > 0 && <span className="badge badge-red">{alertCount} alert</span>}
            <span className="badge badge-gray">{offlineCount} offline</span>
          </div>
        </div>
      </div>

      {/* Map container */}
      <div className="flex-1 relative">
        {(!isLoaded || isLoading) && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">{t('common.loading')}</span>
            </div>
          </div>
        )}

        {isLoaded && (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={DEFAULT_CENTER}
            zoom={DEFAULT_ZOOM}
            options={MAP_OPTIONS}
            onLoad={onMapLoad}
            onIdle={onMapIdle}
          >
            {selectedDevice && selectedDevice.location?.coordinates && (
              <InfoWindowF
                position={{
                  lat: selectedDevice.location.coordinates[1],
                  lng: selectedDevice.location.coordinates[0],
                }}
                onCloseClick={() => setSelectedDevice(null)}
                options={{ pixelOffset: new window.google.maps.Size(0, -36) }}
              >
                <DeviceInfoWindow
                  device={selectedDevice}
                  onClose={() => setSelectedDevice(null)}
                />
              </InfoWindowF>
            )}
          </GoogleMap>
        )}
      </div>
    </div>
  );
}
