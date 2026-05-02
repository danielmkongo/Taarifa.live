import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GoogleMap, useJsApiLoader, InfoWindowF } from '@react-google-maps/api';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { api } from '../services/api.js';
import { formatDistanceToNow } from 'date-fns';
import { Btn, Badge, StatusDot } from '../components/ui/index.jsx';
import { IcoArrowRight, IcoSearch, IcoX, IcoMenu, IcoSettings } from '../components/ui/Icons.jsx';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const MAP_OPTIONS = {
  mapTypeId: 'hybrid',
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: true,
  mapTypeControlOptions: { position: 3 },
  streetViewControl: false,
  fullscreenControl: true,
};

const DEFAULT_CENTER = { lat: -6.4, lng: 35.7 };
const DEFAULT_ZOOM = 6;

const STATUS_COLORS = {
  online:      '#22c55e',
  offline:     '#94a3b8',
  alert:       '#ef4444',
  maintenance: '#f59e0b',
};

function buildMarkerSvg(status, selected = false) {
  const c = STATUS_COLORS[status] || '#94a3b8';
  const size = selected ? 46 : 36;
  const pinH = Math.round(size * 1.3);
  const cx = size / 2;
  const cy = Math.round(size * 0.46);
  const outerR = Math.round(size * 0.45);
  const innerR = Math.round(size * 0.26);
  const dotR   = Math.round(size * 0.13);

  const excl = status === 'alert'
    ? `<text x="${cx}" y="${cy + 5}" font-size="${Math.round(size * 0.32)}" font-weight="900" font-family="Arial,sans-serif" text-anchor="middle" fill="white">!</text>`
    : '';

  const pulse = (status === 'online' || status === 'alert') && selected
    ? `<circle cx="${cx}" cy="${cy}" r="${outerR + 6}" fill="none" stroke="${c}" stroke-width="2" opacity="0.4"/>`
    : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${pinH}" viewBox="0 0 ${size} ${pinH}">
    <defs>
      <filter id="ds" x="-60%" y="-60%" width="220%" height="220%">
        <feDropShadow dx="0" dy="2" stdDeviation="${selected ? 5 : 3}" flood-color="rgba(0,0,0,0.65)"/>
      </filter>
    </defs>
    ${pulse}
    <path d="M${cx} 2C${cx - outerR} 2 ${cx - outerR - 2} ${cy - outerR + 2} ${cx - outerR - 2} ${cy}c0 ${Math.round(outerR * 1.6)} ${outerR + 2} ${Math.round(outerR * 2.4)} ${outerR + 2} ${Math.round(outerR * 2.4)}S${cx + outerR + 2} ${cy + Math.round(outerR * 1.6)} ${cx + outerR + 2} ${cy}C${cx + outerR + 2} ${cy - outerR + 2} ${cx + outerR} 2 ${cx} 2z"
      fill="white" filter="url(#ds)"/>
    <path d="M${cx} 4C${cx - outerR + 1} 4 ${cx - outerR + 1 - 1} ${cy - outerR + 2} ${cx - outerR + 1 - 1} ${cy}c0 ${Math.round(outerR * 1.5)} ${outerR} ${Math.round(outerR * 2.3)} ${outerR} ${Math.round(outerR * 2.3)}S${cx + outerR - 1} ${cy + Math.round(outerR * 1.5)} ${cx + outerR - 1} ${cy}C${cx + outerR - 1} ${cy - outerR + 2} ${cx + outerR - 1} 4 ${cx} 4z"
      fill="${c}"/>
    <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="white" fill-opacity="0.93"/>
    <circle cx="${cx}" cy="${cy}" r="${dotR}" fill="${c}"/>
    ${excl}
  </svg>`;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: { width: size, height: pinH },
    anchor: { x: cx, y: pinH - 2 },
  };
}

// ─── Device list item ──────────────────────────────────────────────────────────
function DeviceItem({ device, selected, onClick }) {
  const temp = device.latestReadings?.find(r => r._id === 'temperature');
  const hum  = device.latestReadings?.find(r => r._id === 'humidity');
  const hasCoords = !!device.location?.coordinates;

  return (
    <div onClick={onClick}
      style={{
        padding: '10px 12px',
        cursor: 'pointer',
        borderBottom: '1px solid var(--border)',
        background: selected ? 'color-mix(in oklch, var(--accent) 8%, transparent)' : 'transparent',
        borderLeft: selected ? '3px solid var(--accent)' : '3px solid transparent',
        transition: 'background 0.15s',
      }}>
      <div className="row gap-2" style={{ alignItems: 'flex-start' }}>
        <StatusDot status={device.status} pulse={device.status === 'alert'} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {device.name}
          </div>
          <div className="text-xs muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {device.address || device.locationName || '—'}
          </div>
          {device.lastSeenAt && (
            <div className="text-xs subtle" style={{ marginTop: 1 }}>
              {formatDistanceToNow(new Date(device.lastSeenAt), { addSuffix: true })}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {temp && <div className="mono text-xs font-medium" style={{ color: STATUS_COLORS[device.status] }}>{temp.value.toFixed(1)}°</div>}
          {hum  && <div className="mono text-xs muted">{hum.value.toFixed(0)}%</div>}
          {!hasCoords && <div style={{ fontSize: 10, color: 'var(--fg-muted)', marginTop: 2 }}>no GPS</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Device detail panel ───────────────────────────────────────────────────────
function DeviceDetailPanel({ device, onClose, onNavigate }) {
  const temp = device.latestReadings?.find(r => r._id === 'temperature');
  const hum  = device.latestReadings?.find(r => r._id === 'humidity');
  const pres = device.latestReadings?.find(r => r._id === 'pressure');
  const rain = device.latestReadings?.find(r => r._id === 'rainfall');

  const readings = [
    { label: 'Temperature', value: temp?.value?.toFixed(1), unit: '°C'   },
    { label: 'Humidity',    value: hum?.value?.toFixed(0),  unit: '%'    },
    { label: 'Pressure',    value: pres?.value?.toFixed(0), unit: 'hPa'  },
    { label: 'Rainfall',    value: rain?.value?.toFixed(1), unit: 'mm/h' },
  ].filter(r => r.value != null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Head */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div className="row gap-2" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
          <div className="row gap-2">
            <StatusDot status={device.status} pulse={device.status === 'alert'} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>{device.name}</span>
          </div>
          <button className="btn btn--ghost btn--icon btn--sm" onClick={onClose}>
            <IcoX size={14} />
          </button>
        </div>
        <div className="text-xs mono muted">{device.serialNumber || device._id?.toString().slice(-8)}</div>
        {(device.address || device.locationName) && (
          <div className="text-xs muted" style={{ marginTop: 2 }}>{device.address || device.locationName}</div>
        )}
        {device.location?.coordinates && (
          <div className="text-xs subtle mono" style={{ marginTop: 2 }}>
            {device.location.coordinates[1].toFixed(5)}, {device.location.coordinates[0].toFixed(5)}
          </div>
        )}
      </div>

      {/* Readings grid */}
      {readings.length > 0 && (
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div className="text-xs uppercase tracking-wide subtle" style={{ marginBottom: 8 }}>Latest readings</div>
          <div className="grid grid-cols-2" style={{ gap: 6 }}>
            {readings.map(r => (
              <div key={r.label} style={{ padding: '8px 10px', background: 'var(--bg-subtle)', borderRadius: 8 }}>
                <div className="text-xs muted">{r.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>
                  {r.value}<span className="text-xs muted" style={{ marginLeft: 2 }}>{r.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Device info */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {[
            { l: 'Status',    v: device.status },
            { l: 'Firmware',  v: device.firmwareVersion || device.firmware || '—' },
            { l: 'Last seen', v: device.lastSeenAt ? formatDistanceToNow(new Date(device.lastSeenAt), { addSuffix: true }) : '—' },
            { l: 'Protocol',  v: device.protocol || 'http' },
          ].map(row => (
            <div key={row.l} className="row gap-2" style={{ justifyContent: 'space-between' }}>
              <span className="text-xs muted">{row.l}</span>
              <span className="text-xs mono">{row.v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Btn kind="primary" full size="sm" iconRight={IcoArrowRight} onClick={() => onNavigate(device._id)}>
          Open device
        </Btn>
        <Btn kind="ghost" full size="sm" icon={IcoSettings}>Configure</Btn>
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function MapPage() {
  const navigate   = useNavigate();
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [map, setMap]   = useState(null);
  const [search, setSearch] = useState('');
  const [panelOpen, setPanelOpen] = useState(true);
  const markersRef  = useRef([]);
  const clustererRef = useRef(null);
  const hasFitRef   = useRef(false);
  const markerMap   = useRef({});

  const { isLoaded, loadError } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_API_KEY });

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['map-data'],
    queryFn: api.getMapData,
    refetchInterval: 30_000,
  });

  const onMapLoad = useCallback((m) => setMap(m), []);

  // Build/update markers whenever map or devices change
  useEffect(() => {
    if (!map || !devices.length || !window.google) return;

    // Teardown previous
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    markerMap.current  = {};
    if (clustererRef.current) { clustererRef.current.clearMarkers(); clustererRef.current = null; }

    const positioned = devices.filter(d => d.location?.coordinates);
    const newMarkers = positioned.map(device => {
      const [lng, lat] = device.location.coordinates;
      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        icon: buildMarkerSvg(device.status, false),
        title: device.name,
        optimized: true,
        zIndex: device.status === 'alert' ? 100 : device.status === 'online' ? 50 : 10,
      });
      marker.addListener('click', () => selectDevice(device));
      markerMap.current[device._id?.toString()] = marker;
      return marker;
    });

    markersRef.current = newMarkers;
    if (newMarkers.length) {
      clustererRef.current = new MarkerClusterer({ map, markers: newMarkers });
    }

    if (!hasFitRef.current && positioned.length > 0) {
      hasFitRef.current = true;
      const bounds = new window.google.maps.LatLngBounds();
      positioned.forEach(d => bounds.extend({
        lat: d.location.coordinates[1],
        lng: d.location.coordinates[0],
      }));
      map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
      setTimeout(() => { if (map.getZoom() > 12) map.setZoom(12); }, 400);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, devices]);

  // Update marker icons when selection changes
  useEffect(() => {
    devices.filter(d => d.location?.coordinates).forEach(device => {
      const marker = markerMap.current[device._id?.toString()];
      if (!marker) return;
      const isSelected = selectedDevice?._id?.toString() === device._id?.toString();
      marker.setIcon(buildMarkerSvg(device.status, isSelected));
      if (isSelected) marker.setZIndex(200);
    });
  }, [selectedDevice, devices]);

  function selectDevice(device) {
    setSelectedDevice(prev =>
      prev?._id?.toString() === device._id?.toString() ? null : device
    );
    if (!device.location?.coordinates || !map) return;
    const [lng, lat] = device.location.coordinates;
    map.panTo({ lat, lng });
    setTimeout(() => {
      const z = map.getZoom();
      if (z < 12) map.setZoom(13);
    }, 300);
  }

  const searchLower = search.toLowerCase();
  const filtered = devices.filter(d =>
    !search ||
    d.name?.toLowerCase().includes(searchLower) ||
    d.serialNumber?.toLowerCase().includes(searchLower) ||
    d.locationName?.toLowerCase().includes(searchLower) ||
    d.address?.toLowerCase().includes(searchLower)
  );

  const counts = {
    total:   devices.length,
    online:  devices.filter(d => d.status === 'online').length,
    offline: devices.filter(d => d.status === 'offline').length,
    alert:   devices.filter(d => d.status === 'alert').length,
  };

  if (loadError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="error-banner">Failed to load Google Maps: {loadError.message}</div>
      </div>
    );
  }

  return (
    <div style={{ height: 'calc(100vh - var(--topbar-h))', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="row gap-3" style={{
        padding: '8px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-elev)', flexShrink: 0, flexWrap: 'wrap',
      }}>
        <button
          className="btn btn--ghost btn--icon btn--sm"
          onClick={() => setPanelOpen(o => !o)}
          title={panelOpen ? 'Hide device list' : 'Show device list'}
          style={{ display: 'flex' }}>
          {panelOpen ? <IcoX size={15} /> : <IcoMenu size={15} />}
        </button>

        <div style={{ fontWeight: 600, fontSize: 15 }}>Map</div>

        <div className="row gap-3 text-xs" style={{ flex: 1, flexWrap: 'wrap' }}>
          <span className="row gap-1 muted">{counts.total} devices</span>
          <span className="row gap-1" style={{ color: STATUS_COLORS.online }}>
            <span className="dot dot--ok" /> {counts.online} online
          </span>
          {counts.alert > 0 && (
            <span className="row gap-1" style={{ color: STATUS_COLORS.alert }}>
              <span className="dot dot--danger" /> {counts.alert} alert
            </span>
          )}
          <span className="row gap-1 muted">
            <span className="dot dot--off" /> {counts.offline} offline
          </span>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* Left panel */}
        <aside style={{
          width: panelOpen ? 290 : 0,
          minWidth: panelOpen ? 290 : 0,
          borderRight: panelOpen ? '1px solid var(--border)' : 'none',
          background: 'var(--bg-elev)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          transition: 'min-width 0.22s ease, width 0.22s ease',
          flexShrink: 0,
        }}>
          {/* Search */}
          <div style={{ padding: '10px 10px 6px', flexShrink: 0 }}>
            <div className="search" style={{ width: '100%' }}>
              <IcoSearch size={13} />
              <input
                placeholder="Search devices…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%' }}
              />
              {search && (
                <button onClick={() => setSearch('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)', padding: 0, display: 'flex' }}>
                  <IcoX size={12} />
                </button>
              )}
            </div>
            <div className="text-xs muted" style={{ marginTop: 6, paddingLeft: 2 }}>
              {filtered.length} device{filtered.length !== 1 ? 's' : ''}
              {search ? ` matching "${search}"` : ''}
            </div>
          </div>

          {/* Device list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>
                No devices found
              </div>
            ) : filtered.map(device => (
              <DeviceItem
                key={device._id}
                device={device}
                selected={selectedDevice?._id?.toString() === device._id?.toString()}
                onClick={() => selectDevice(device)}
              />
            ))}
          </div>
        </aside>

        {/* Map container */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {(!isLoaded || isLoading) && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-subtle)', zIndex: 10 }}>
              <svg className="spin" width={26} height={26} viewBox="0 0 24 24" fill="none">
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
              onLoad={onMapLoad}
              onClick={() => setSelectedDevice(null)}>
              {selectedDevice?.location?.coordinates && (
                <InfoWindowF
                  position={{
                    lat: selectedDevice.location.coordinates[1],
                    lng: selectedDevice.location.coordinates[0],
                  }}
                  onCloseClick={() => setSelectedDevice(null)}
                  options={{ pixelOffset: window.google ? new window.google.maps.Size(0, -46) : undefined }}>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, maxWidth: 180 }}>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{selectedDevice.name}</div>
                    {(selectedDevice.address || selectedDevice.locationName) && (
                      <div style={{ color: '#6b7280', fontSize: 11 }}>{selectedDevice.address || selectedDevice.locationName}</div>
                    )}
                  </div>
                </InfoWindowF>
              )}
            </GoogleMap>
          )}
        </div>

        {/* Right detail panel */}
        {selectedDevice && (
          <aside style={{
            width: 280,
            minWidth: 280,
            borderLeft: '1px solid var(--border)',
            background: 'var(--bg-elev)',
            overflowY: 'auto',
            flexShrink: 0,
          }}>
            <DeviceDetailPanel
              device={selectedDevice}
              onClose={() => setSelectedDevice(null)}
              onNavigate={id => navigate(`/devices/${id}`)}
            />
          </aside>
        )}
      </div>
    </div>
  );
}
