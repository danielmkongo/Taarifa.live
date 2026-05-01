import { useState, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GoogleMap, useJsApiLoader, InfoWindowF } from '@react-google-maps/api';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { api } from '../services/api.js';
import { format } from 'date-fns';
import { Btn, Badge, Seg, StatusDot } from '../components/ui/index.jsx';
import { IcoArrowRight, IcoSettings } from '../components/ui/Icons.jsx';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const MAP_OPTIONS = {
  mapTypeId: 'roadmap',
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  styles: [
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  ],
};

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

function DeviceInfoWindow({ device }) {
  const readings = device.latestReadings || [];
  return (
    <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 200, maxWidth: 260, padding: '12px 16px' }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: 'var(--fg)' }}>{device.name}</div>
      <div style={{ marginBottom: 8 }}>
        <Badge kind={device.status === 'online' ? 'ok' : device.status === 'alert' ? 'danger' : 'neutral'}>
          {device.status}
        </Badge>
      </div>
      {device.locationName && <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>📍 {device.locationName}</div>}
      {device.lastSeenAt && <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>Last seen: {format(new Date(device.lastSeenAt), 'MMM d, HH:mm')}</div>}
      {device.batteryLevel != null && <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>🔋 {device.batteryLevel}%</div>}
      {readings.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Latest Readings</div>
          {readings.slice(0, 5).map(r => (
            <div key={r._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
              <span style={{ fontSize: 11, color: '#6b7280' }}>{r._id}</span>
              <span style={{ fontSize: 11, fontWeight: 600 }}>{r.value?.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MapPage() {
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [layer, setLayer] = useState('status');
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

  const onMapLoad = useCallback((mapInstance) => setMap(mapInstance), []);

  const onMapIdle = useCallback(() => {
    if (!map || !devices) return;
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    if (clustererRef.current) clustererRef.current.clearMarkers();

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
    clustererRef.current = new MarkerClusterer({ map, markers: newMarkers });

    if (positioned.length > 0 && positioned.length <= 100) {
      const bounds = new window.google.maps.LatLngBounds();
      positioned.forEach(d => { const [lng, lat] = d.location.coordinates; bounds.extend({ lat, lng }); });
      map.fitBounds(bounds, { top: 60, right: 40, bottom: 40, left: 40 });
      if (map.getZoom() > 14) map.setZoom(14);
    }
  }, [map, devices]);

  const devList = devices || [];
  const online  = devList.filter(d => d.status === 'online').length;
  const offline = devList.filter(d => d.status === 'offline').length;
  const alerting= devList.filter(d => d.status === 'alert').length;
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
      <div className="row gap-3" style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elev)', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Map</h1>
          <div className="text-xs muted">{withCoords} of {devList.length} devices have coordinates</div>
        </div>
        <div style={{ flex: 1 }} />
        <Seg value={layer} onChange={setLayer} options={[
          { value: 'status', label: 'Status' },
          { value: 'temp',   label: 'Temperature' },
        ]} />
        <div className="row gap-3 text-xs muted">
          <span className="row gap-1"><span className="dot dot--ok" /> Online {online}</span>
          <span className="row gap-1"><span className="dot dot--danger" /> Alert {alerting}</span>
          <span className="row gap-1"><span className="dot dot--off" /> Offline {offline}</span>
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative', display: 'flex' }}>
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
              center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM}
              options={MAP_OPTIONS}
              onLoad={onMapLoad} onIdle={onMapIdle}>
              {selectedDevice && selectedDevice.location?.coordinates && (
                <InfoWindowF
                  position={{ lat: selectedDevice.location.coordinates[1], lng: selectedDevice.location.coordinates[0] }}
                  onCloseClick={() => setSelectedDevice(null)}
                  options={{ pixelOffset: new window.google.maps.Size(0, -36) }}>
                  <DeviceInfoWindow device={selectedDevice} />
                </InfoWindowF>
              )}
            </GoogleMap>
          )}
        </div>

        {selectedDevice && (
          <aside style={{ width: 300, borderLeft: '1px solid var(--border)', background: 'var(--bg-elev)', overflowY: 'auto', padding: 16 }}>
            <div className="row gap-2" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <div className="row gap-2">
                <StatusDot status={selectedDevice.status} pulse={selectedDevice.status === 'alert'} />
                <span style={{ fontWeight: 600 }}>{selectedDevice.name}</span>
              </div>
              <button className="btn btn--ghost btn--icon btn--sm" onClick={() => setSelectedDevice(null)}>✕</button>
            </div>
            <div className="row gap-2" style={{ marginBottom: 12 }}>
              <Badge kind={selectedDevice.status === 'online' ? 'ok' : selectedDevice.status === 'alert' ? 'danger' : 'neutral'}>
                {selectedDevice.status}
              </Badge>
            </div>
            {selectedDevice.locationName && (
              <div className="text-xs muted" style={{ marginBottom: 8 }}>📍 {selectedDevice.locationName}</div>
            )}
            <div className="grid grid-cols-2" style={{ gap: 10, marginBottom: 14 }}>
              <div style={{ padding: 10, background: 'var(--bg-subtle)', borderRadius: 8 }}>
                <div className="text-xs muted">Battery</div>
                <div className="text-lg font-semibold">{selectedDevice.batteryLevel != null ? `${selectedDevice.batteryLevel}%` : '—'}</div>
              </div>
              <div style={{ padding: 10, background: 'var(--bg-subtle)', borderRadius: 8 }}>
                <div className="text-xs muted">Last seen</div>
                <div className="text-sm font-medium">
                  {selectedDevice.lastSeenAt ? format(new Date(selectedDevice.lastSeenAt), 'HH:mm') : '—'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Btn kind="secondary" full size="sm" iconRight={IcoArrowRight}>Open in Data Explorer</Btn>
              <Btn kind="ghost" full size="sm" icon={IcoSettings}>Configure</Btn>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
