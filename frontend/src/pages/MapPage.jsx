import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GoogleMap, useJsApiLoader, InfoWindowF } from '@react-google-maps/api';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { api } from '../services/api.js';
import { format } from 'date-fns';
import { Btn, Badge, Seg, StatusDot } from '../components/ui/index.jsx';
import { IcoArrowRight, IcoSettings, IcoSearch } from '../components/ui/Icons.jsx';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const MAP_OPTIONS = {
  mapTypeId: 'hybrid',          // satellite + labels by default
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: true,
  mapTypeControlOptions: { position: 3 }, // TOP_RIGHT
  streetViewControl: false,
  fullscreenControl: true,
  styles: [
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  ],
};

const DEFAULT_CENTER = { lat: -4.5, lng: 35.0 };  // Tanzania center
const DEFAULT_ZOOM = 6;

function statusIcon(status) {
  const colors = {
    online:      '#22c55e',
    offline:     '#94a3b8',
    alert:       '#f43f5e',
    maintenance: '#f59e0b',
  };
  const color = colors[status] || '#94a3b8';
  const excl = status === 'alert' ? `<text x="17" y="20" font-size="9" font-weight="900" font-family="Arial,sans-serif" text-anchor="middle" fill="white">!</text>` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44">
    <defs><filter id="ds" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.65)"/>
    </filter></defs>
    <path d="M17 2C9.82 2 4 7.82 4 15c0 13 13 27 13 27S30 28 30 15C30 7.82 24.18 2 17 2z"
      fill="white" filter="url(#ds)"/>
    <path d="M17 4C10.93 4 6 8.93 6 15c0 12 11 25 11 25S28 27 28 15C28 8.93 23.07 4 17 4z"
      fill="${color}"/>
    <circle cx="17" cy="15" r="7" fill="white" fill-opacity="0.92"/>
    <circle cx="17" cy="15" r="3.5" fill="${color}"/>
    ${excl}
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: { width: 34, height: 44 },
    anchor: { x: 17, y: 44 },
  };
}

function DeviceSidePanel({ device, onClose }) {
  const readings = device.latestReadings || [];
  return (
    <div style={{ padding: 16 }}>
      <div className="row gap-2" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="row gap-2">
          <StatusDot status={device.status} pulse={device.status === 'alert'} />
          <span style={{ fontWeight: 600 }}>{device.name}</span>
        </div>
        <button className="btn btn--ghost btn--icon btn--sm" onClick={onClose}>✕</button>
      </div>
      <div className="text-xs mono muted" style={{ marginBottom: 8 }}>{device.serialNumber || device._id?.toString().slice(-8)}</div>
      <div className="row gap-2" style={{ marginBottom: 10 }}>
        <Badge kind={device.status === 'online' ? 'ok' : device.status === 'alert' ? 'danger' : 'neutral'}>{device.status}</Badge>
        {device.locationName && <Badge kind="outline">{device.locationName}</Badge>}
      </div>
      {device.location?.coordinates && (
        <div className="text-xs muted mono" style={{ marginBottom: 10 }}>
          {device.location.coordinates[1].toFixed(4)}, {device.location.coordinates[0].toFixed(4)}
        </div>
      )}
      <div className="grid grid-cols-2" style={{ gap: 8, marginBottom: 14 }}>
        <div style={{ padding: 10, background: 'var(--bg-subtle)', borderRadius: 8 }}>
          <div className="text-xs muted">Battery</div>
          <div className="text-lg font-semibold">{device.batteryLevel != null ? `${device.batteryLevel}%` : '—'}</div>
        </div>
        <div style={{ padding: 10, background: 'var(--bg-subtle)', borderRadius: 8 }}>
          <div className="text-xs muted">Last seen</div>
          <div className="text-sm font-medium">
            {device.lastSeenAt ? format(new Date(device.lastSeenAt), 'HH:mm') : '—'}
          </div>
        </div>
      </div>
      {readings.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="text-xs uppercase tracking-wide subtle" style={{ marginBottom: 6 }}>Latest readings</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {readings.slice(0, 5).map(r => (
              <div key={r._id} className="row gap-2" style={{ justifyContent: 'space-between' }}>
                <span className="text-xs muted">{r._id}</span>
                <span className="text-xs mono font-medium">{r.value?.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Btn kind="secondary" full size="sm" iconRight={IcoArrowRight}>Open in Data Explorer</Btn>
        <Btn kind="ghost" full size="sm" icon={IcoSettings}>Configure</Btn>
      </div>
    </div>
  );
}

export default function MapPage() {
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [layer, setLayer] = useState('status');
  const [map, setMap] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const clustererRef = useRef(null);
  const markersRef = useRef([]);
  const hasFitRef = useRef(false);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: ['marker'],
  });

  const { data: devices, isLoading } = useQuery({
    queryKey: ['map-data'],
    queryFn: api.getMapData,
    refetchInterval: 30_000,
  });

  const onMapLoad = useCallback((mapInstance) => setMap(mapInstance), []);

  // Create/update markers when map or devices change — NOT on idle (that caused the pan loop)
  useEffect(() => {
    if (!map || !devices || !window.google) return;

    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    if (clustererRef.current) { clustererRef.current.clearMarkers(); clustererRef.current = null; }

    const positioned = devices.filter(d => d.location?.coordinates);
    const newMarkers = positioned.map(device => {
      const [lng, lat] = device.location.coordinates;
      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        icon: statusIcon(device.status),
        title: device.name,
        optimized: true,
      });
      marker.addListener('click', () => setSelectedDevice(device));
      return marker;
    });
    markersRef.current = newMarkers;
    if (newMarkers.length) {
      clustererRef.current = new MarkerClusterer({ map, markers: newMarkers });
    }

    // Only fit bounds on first load — never again (avoids pan loop)
    if (!hasFitRef.current && positioned.length > 0) {
      hasFitRef.current = true;
      const bounds = new window.google.maps.LatLngBounds();
      positioned.forEach(d => {
        const [lng, lat] = d.location.coordinates;
        bounds.extend({ lat, lng });
      });
      map.fitBounds(bounds, { top: 60, right: 40, bottom: 40, left: 40 });
      setTimeout(() => { if (map.getZoom() > 13) map.setZoom(13); }, 400);
    }
  }, [map, devices]);

  function handleSearch(e) {
    e.preventDefault();
    if (!searchQuery.trim() || !map || !window.google) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: searchQuery + ', Tanzania' }, (results, status) => {
      if (status === 'OK' && results[0]) {
        map.fitBounds(results[0].geometry.viewport);
      }
    });
  }

  const devList = devices || [];
  const online   = devList.filter(d => d.status === 'online').length;
  const offline  = devList.filter(d => d.status === 'offline').length;
  const alerting = devList.filter(d => d.status === 'alert').length;
  const maint    = devList.filter(d => d.status === 'maintenance').length;
  const withCoords = devList.filter(d => d.location?.coordinates).length;

  if (loadError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="error-banner">Failed to load Google Maps: {loadError.message}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 0, maxWidth: 'none', height: 'calc(100vh - var(--topbar-h))', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="row gap-3" style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elev)', flexShrink: 0, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Map</h1>
          <div className="text-xs muted">{withCoords} of {devList.length} devices · Tanzania</div>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="row gap-2" style={{ flex: 1, maxWidth: 340 }}>
          <div className="search" style={{ flex: 1 }}>
            <IcoSearch size={13} />
            <input
              placeholder="Search location…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <Btn kind="secondary" size="sm" type="submit">Go</Btn>
        </form>

        <Seg value={layer} onChange={setLayer} options={[
          { value: 'status', label: 'Status' },
          { value: 'temp',   label: 'Temperature' },
          { value: 'rain',   label: 'Rainfall' },
          { value: 'wind',   label: 'Wind' },
        ]} />

        <div className="row gap-3 text-xs muted" style={{ flexShrink: 0 }}>
          <span className="row gap-1"><span className="dot dot--ok" /> Online {online}</span>
          <span className="row gap-1"><span className="dot dot--danger" /> Alert {alerting}</span>
          <span className="row gap-1"><span className="dot dot--off" /> Offline {offline}</span>
          <span className="row gap-1"><span className="dot dot--warn" /> Maint. {maint}</span>
        </div>
      </div>

      {/* Map + side panel */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          {(!isLoaded || isLoading) && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-subtle)', zIndex: 10 }}>
              <svg className="spin" width={24} height={24} viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="var(--border-strong)" strokeWidth="2" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
          )}
          {isLoaded && (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={DEFAULT_CENTER}
              zoom={DEFAULT_ZOOM}
              options={MAP_OPTIONS}
              onLoad={onMapLoad}>
              {selectedDevice && selectedDevice.location?.coordinates && (
                <InfoWindowF
                  position={{
                    lat: selectedDevice.location.coordinates[1],
                    lng: selectedDevice.location.coordinates[0],
                  }}
                  onCloseClick={() => setSelectedDevice(null)}
                  options={{ pixelOffset: new window.google.maps.Size(0, -44) }}>
                  <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 160 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{selectedDevice.name}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{selectedDevice.locationName || ''}</div>
                  </div>
                </InfoWindowF>
              )}
            </GoogleMap>
          )}
        </div>

        {/* Side panel */}
        {selectedDevice && (
          <aside style={{ width: 300, borderLeft: '1px solid var(--border)', background: 'var(--bg-elev)', overflowY: 'auto' }}>
            <DeviceSidePanel device={selectedDevice} onClose={() => setSelectedDevice(null)} />
          </aside>
        )}
      </div>
    </div>
  );
}
