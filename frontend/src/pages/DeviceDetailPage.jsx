import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { api } from '../services/api.js';
import { format, subHours } from 'date-fns';
import { Btn, Badge, StatusDot, Seg, Card, LineChart, Sparkline, Empty, Spinner } from '../components/ui/index.jsx';
import { IcoArrowRight, IcoDownload, IcoSettings, IcoRefresh, IcoMap, IcoKey, IcoX, IcoCheck, IcoCopy } from '../components/ui/Icons.jsx';

const SENSORS = [
  { key: 'temperature', label: 'Temperature', unit: '°C',  color: 'var(--c1)' },
  { key: 'humidity',    label: 'Humidity',    unit: '%',   color: 'var(--c2)' },
  { key: 'rainfall',    label: 'Rainfall',    unit: 'mm',  color: 'var(--c6)' },
  { key: 'pressure',    label: 'Pressure',    unit: 'hPa', color: 'var(--c5)' },
  { key: 'wind_speed',  label: 'Wind',        unit: 'm/s', color: 'var(--c4)' },
  { key: 'co2',         label: 'CO₂',         unit: 'ppm', color: 'var(--c3)' },
];

const RANGES = [
  { value: '1h',  label: '1h',  hours: 1 },
  { value: '24h', label: '24h', hours: 24 },
  { value: '7d',  label: '7d',  hours: 168 },
  { value: '30d', label: '30d', hours: 720 },
];

function BatteryBar({ pct }) {
  if (pct == null) return <span className="muted text-xs">—</span>;
  const color = pct < 25 ? 'var(--danger)' : pct < 50 ? 'var(--warn)' : 'var(--ok)';
  return (
    <div className="row gap-2">
      <div style={{ width: 40, height: 8, borderRadius: 2, background: 'var(--bg-muted)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color }} />
      </div>
      <span className="text-xs tabnum mono">{pct}%</span>
    </div>
  );
}

function SignalBars({ n }) {
  const bars = n ?? 0;
  return (
    <div className="row gap-1" style={{ alignItems: 'flex-end', height: 16 }}>
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{ width: 4, height: 2 + i * 2.5, background: i <= bars ? 'var(--fg)' : 'var(--border-strong)', borderRadius: 1 }} />
      ))}
    </div>
  );
}

function beaconIcon(status) {
  const c = { online: '#22c55e', offline: '#94a3b8', alert: '#ef4444', maintenance: '#f59e0b' }[status] || '#94a3b8';
  const pulse = status === 'online' || status === 'alert';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="74" viewBox="0 0 60 74">
    <defs>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="shadow" x="-40%" y="-30%" width="180%" height="180%">
        <feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="rgba(0,0,0,0.6)"/>
      </filter>
      <radialGradient id="rg" cx="40%" cy="35%">
        <stop offset="0%" stop-color="white" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="white" stop-opacity="0"/>
      </radialGradient>
    </defs>
    ${pulse ? `<circle cx="30" cy="28" r="26" fill="${c}" fill-opacity="0.18" filter="url(#glow)"/>` : ''}
    <path d="M30 2C18.95 2 10 10.95 10 22c0 17 20 50 20 50S50 39 50 22C50 10.95 41.05 2 30 2z"
      fill="white" filter="url(#shadow)"/>
    <path d="M30 4C19.96 4 12 11.96 12 22c0 16 18 46 18 46S48 38 48 22C48 11.96 40.04 4 30 4z"
      fill="${c}"/>
    <circle cx="30" cy="22" r="14" fill="white" fill-opacity="0.2"/>
    <circle cx="30" cy="22" r="10" fill="white" fill-opacity="0.95"/>
    <circle cx="30" cy="22" r="5" fill="${c}"/>
    <rect x="10" y="2" width="40" height="40" fill="url(#rg)" rx="20"/>
    ${status === 'alert' ? `<text x="30" y="27" font-size="11" font-weight="900" font-family="Arial,sans-serif" text-anchor="middle" fill="white">!</text>` : ''}
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: { width: 60, height: 74 },
    anchor: { x: 30, y: 72 },
  };
}

// ─── Configure Modal ──────────────────────────────────────────────────────────
function ConfigureModal({ device, onClose, onSaved }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState('info');
  const [form, setForm] = useState({
    name:         device.name || '',
    description:  device.description || '',
    locationName: device.locationName || '',
    lat: device.location?.coordinates?.[1] ?? '',
    lon: device.location?.coordinates?.[0] ?? '',
  });
  const [newApiKey, setNewApiKey] = useState(null);
  const [rotating, setRotating] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [copied, setCopied]     = useState('');

  function copy(text, label) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(''), 1800);
    });
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api.updateDevice(device._id, {
        name:         form.name,
        description:  form.description,
        locationName: form.locationName,
        lat:          form.lat !== '' ? parseFloat(form.lat) : undefined,
        lon:          form.lon !== '' ? parseFloat(form.lon) : undefined,
      });
      qc.invalidateQueries({ queryKey: ['device', device._id] });
      onSaved?.();
      onClose();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function rotateKey() {
    if (!confirm('Regenerate API key? The current key will stop working immediately.')) return;
    setRotating(true);
    try {
      const res = await api.rotateKey(device._id);
      setNewApiKey(res.apiKey);
    } catch (err) { setError(err.message); }
    finally { setRotating(false); }
  }

  const deviceId = device._id?.toString();
  const apiKeyPrefix = device.apiKeyPrefix ? `${device.apiKeyPrefix}${'•'.repeat(56)}` : '—';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">Configure · {device.name}</div>
          <Btn kind="ghost" size="sm" icon={IcoX} onClick={onClose} />
        </div>

        {/* Tabs */}
        <div className="row gap-0" style={{ borderBottom: '1px solid var(--border)', padding: '0 20px' }}>
          {[['info', 'Device info'], ['keys', 'API & Keys'], ['location', 'Location']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '8px 14px', fontSize: 13, fontWeight: tab === k ? 600 : 400,
                color: tab === k ? 'var(--fg)' : 'var(--fg-muted)',
                borderBottom: tab === k ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -1,
              }}>{l}</button>
          ))}
        </div>

        <div className="modal__body" style={{ minHeight: 200 }}>
          {error && <div className="error-banner" style={{ marginBottom: 12 }}>{error}</div>}

          {tab === 'info' && (
            <form id="cfg-form" onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="field">
                <label className="field__label">Device ID</label>
                <div className="row gap-2">
                  <input readOnly className="input mono" value={deviceId} style={{ flex: 1, opacity: 0.7 }} />
                  <Btn kind="ghost" size="sm" icon={IcoCopy} onClick={() => copy(deviceId, 'id')} title="Copy">
                    {copied === 'id' ? '✓' : ''}
                  </Btn>
                </div>
              </div>
              <div className="field">
                <label className="field__label">Name</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="field">
                <label className="field__label">Description</label>
                <input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2" style={{ gap: 10 }}>
                <div className="field">
                  <label className="field__label">Serial number</label>
                  <input readOnly className="input mono" value={device.serialNumber || '—'} style={{ opacity: 0.7 }} />
                </div>
                <div className="field">
                  <label className="field__label">Firmware</label>
                  <input readOnly className="input mono" value={device.firmwareVersion || device.firmware || '—'} style={{ opacity: 0.7 }} />
                </div>
              </div>
            </form>
          )}

          {tab === 'keys' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="field">
                <label className="field__label">Device ID</label>
                <div className="row gap-2">
                  <input readOnly className="input mono" value={deviceId} style={{ flex: 1, fontSize: 11, opacity: 0.8 }} />
                  <Btn kind="ghost" size="sm" icon={IcoCopy} onClick={() => copy(deviceId, 'id')} title="Copy">
                    {copied === 'id' ? '✓' : ''}
                  </Btn>
                </div>
              </div>
              <div className="field">
                <label className="field__label">API Key prefix</label>
                <div className="row gap-2">
                  <input readOnly className="input mono" value={apiKeyPrefix} style={{ flex: 1, fontSize: 11, opacity: 0.8 }} />
                </div>
                <div className="text-xs muted" style={{ marginTop: 4 }}>
                  Full key is hashed and not stored. Use the prefix to identify which key is in use.
                </div>
              </div>

              {newApiKey && (
                <div style={{ background: 'var(--bg-subtle)', borderRadius: 8, padding: 12, border: '1px solid var(--border)' }}>
                  <div className="text-xs font-medium" style={{ marginBottom: 6, color: 'var(--ok-soft-fg)' }}>New API key (copy now — shown once)</div>
                  <div className="row gap-2">
                    <code style={{ flex: 1, fontSize: 11, wordBreak: 'break-all', fontFamily: 'var(--font-mono)' }}>{newApiKey}</code>
                    <Btn kind="ghost" size="sm" icon={IcoCopy} onClick={() => copy(newApiKey, 'newkey')} title="Copy">
                      {copied === 'newkey' ? '✓' : ''}
                    </Btn>
                  </div>
                </div>
              )}

              <Btn kind="secondary" size="sm" icon={IcoKey} disabled={rotating} onClick={rotateKey}
                style={{ alignSelf: 'flex-start' }}>
                {rotating ? 'Rotating…' : 'Rotate API key'}
              </Btn>
              <div className="text-xs muted" style={{ marginTop: -8 }}>
                Rotating the key will immediately invalidate the current one. Update your device firmware before rotating.
              </div>
            </div>
          )}

          {tab === 'location' && (
            <form id="cfg-form" onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="field">
                <label className="field__label">Location name</label>
                <input className="input" value={form.locationName} placeholder="e.g. Kinondoni Station A"
                  onChange={e => setForm(f => ({ ...f, locationName: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2" style={{ gap: 10 }}>
                <div className="field">
                  <label className="field__label">Latitude</label>
                  <input type="number" step="any" className="input mono" value={form.lat}
                    onChange={e => setForm(f => ({ ...f, lat: e.target.value }))} />
                </div>
                <div className="field">
                  <label className="field__label">Longitude</label>
                  <input type="number" step="any" className="input mono" value={form.lon}
                    onChange={e => setForm(f => ({ ...f, lon: e.target.value }))} />
                </div>
              </div>
              {form.lat && form.lon && (
                <div className="text-xs muted">
                  Current: {parseFloat(form.lat).toFixed(5)}, {parseFloat(form.lon).toFixed(5)}
                </div>
              )}
            </form>
          )}
        </div>

        <div className="modal__foot">
          <Btn kind="secondary" onClick={onClose}>Close</Btn>
          {(tab === 'info' || tab === 'location') && (
            <Btn kind="primary" icon={IcoCheck} type="submit" form="cfg-form" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}

function DeviceMap({ device }) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  const coords = device?.location?.coordinates;
  if (!coords) return (
    <div style={{ height: 240, background: 'var(--bg-subtle)', borderRadius: 8, display: 'grid', placeItems: 'center' }}>
      <div className="text-sm muted">No GPS location recorded for this device.</div>
    </div>
  );

  const center = { lat: coords[1], lng: coords[0] };

  return (
    <div style={{ height: 240, borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
      {isLoaded ? (
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={center}
          zoom={14}
          options={{ mapTypeId: 'hybrid', zoomControl: true, mapTypeControl: false, streetViewControl: false, fullscreenControl: true }}
          onLoad={m => {
            new window.google.maps.Marker({
              position: center,
              map: m,
              title: device.name,
              icon: beaconIcon(device.status),
              zIndex: 100,
            });
          }}
        />
      ) : (
        <div style={{ height: '100%', background: 'var(--bg-subtle)', display: 'grid', placeItems: 'center' }}>
          <Spinner />
        </div>
      )}
    </div>
  );
}

export default function DeviceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [sensorKey, setSensorKey]   = useState('temperature');
  const [range, setRange]           = useState('24h');
  const [chartType, setChartType]   = useState('line');
  const [exporting, setExporting]   = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const { data: device, isLoading: loadingDevice } = useQuery({
    queryKey: ['device', id],
    queryFn: () => api.getDevice(id),
    enabled: !!id,
  });

  const { data: latest } = useQuery({
    queryKey: ['device-latest', id],
    queryFn: () => api.getLatest(id),
    enabled: !!id,
    refetchInterval: 30_000,
  });

  const rangeObj = RANGES.find(r => r.value === range) || RANGES[1];
  const from = subHours(new Date(), rangeObj.hours).toISOString();
  const to = new Date().toISOString();

  const { data: readings, isLoading: loadingReadings, refetch } = useQuery({
    queryKey: ['device-readings', id, sensorKey, range],
    queryFn: () => api.getReadings({ deviceId: id, sensorKey, from, to, granularity: range === '1h' ? 'raw' : 'hourly', limit: 500 }),
    enabled: !!id,
    refetchInterval: 60_000,
  });

  const readingsList  = readings?.readings || [];
  const isAggregate   = (range !== '1h');

  const chartSeries = useMemo(() => {
    if (!readingsList.length) return [];
    const sensor = SENSORS.find(s => s.key === sensorKey);
    const step = Math.max(1, Math.ceil(readingsList.length / 6));
    const data = readingsList.map((r, i) => ({
      t: i,
      v: r.value,
      label: i % step === 0
        ? format(new Date(r.timestamp), range === '1h' ? 'HH:mm' : range === '24h' ? 'HH:mm' : 'MMM d')
        : '',
    }));
    return [{ name: `${device?.name || ''} · ${sensor?.label || sensorKey}`, color: sensor?.color || 'var(--c1)', data }];
  }, [readingsList, sensorKey, device, range]);

  const stats = useMemo(() => {
    if (!readingsList.length) return null;
    const vals = readingsList.map(r => r.value);
    return {
      avg: (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2),
      min: Math.min(...vals).toFixed(2),
      max: Math.max(...vals).toFixed(2),
      count: vals.length,
    };
  }, [readingsList]);

  const sensor     = SENSORS.find(s => s.key === sensorKey);
  const sensorUnit = sensor?.unit || '';
  const latestMap = {};
  (Array.isArray(latest) ? latest : []).forEach(r => { latestMap[r._id] = r.value; });

  const { data: firmwareList = [] } = useQuery({
    queryKey: ['firmware'],
    queryFn: api.listFirmware,
    enabled: !!id,
  });
  const activeFw   = firmwareList.find(f => f.isActive);
  const hasUpdate  = activeFw && device?.firmwareVersion && activeFw.version !== device?.firmwareVersion;

  async function handleExport(fmt) {
    setExporting(true);
    try {
      const blob = await api.exportReadings({ deviceId: id, sensorKey, from, to, format: fmt });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${device?.name || id}-${sensorKey}-${format(new Date(), 'yyyyMMdd')}.${fmt}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  if (loadingDevice) return <div className="page"><Spinner /></div>;
  if (!device) return <div className="page"><div className="error-banner">Device not found.</div></div>;

  const groupName = device.groupId?.name || device.locationName || '—';

  return (
    <div className="page">
      {/* Header */}
      <div className="page__head">
        <div>
          <div className="row gap-2" style={{ marginBottom: 4 }}>
            <button className="text-xs muted" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              onClick={() => navigate('/devices')}>
              ← Devices
            </button>
          </div>
          <h1 className="page__title">{device.name}</h1>
          <div className="page__sub row gap-2">
            <StatusDot status={device.status} pulse={device.status === 'alert'} />
            <span>{device.status}</span>
            <span className="subtle">·</span>
            <span className="mono text-xs">{device.serialNumber || device._id?.toString().slice(-8)}</span>
            {device.locationName && <><span className="subtle">·</span><span>{device.locationName}</span></>}
          </div>
        </div>
        <div className="page__actions">
          <Btn kind="ghost" size="sm" icon={IcoRefresh} onClick={() => refetch()}>Refresh</Btn>
          <Btn kind="secondary" size="sm" icon={IcoDownload} onClick={() => handleExport('csv')} disabled={exporting}>
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Btn>
          <Btn kind="secondary" size="sm" icon={IcoDownload} onClick={() => handleExport('xlsx')} disabled={exporting}>Excel</Btn>
          <Btn kind="ghost" size="sm" icon={IcoSettings} onClick={() => setShowConfig(true)}>Configure</Btn>
        </div>
      </div>

      {/* Info strip */}
      <div className="grid grid-cols-4" style={{ marginBottom: 16 }}>
        <div className="card" style={{ padding: 12 }}>
          <div className="text-xs muted">Battery</div>
          <div style={{ marginTop: 6 }}><BatteryBar pct={device.batteryLevel} /></div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div className="text-xs muted">Signal</div>
          <div style={{ marginTop: 8 }}><SignalBars n={device.signalStrength} /></div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div className="text-xs muted">Firmware</div>
          <div className="text-lg font-semibold mono" style={{ marginTop: 4 }}>{device.firmwareVersion || '—'}</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div className="text-xs muted">Last seen</div>
          <div className="text-lg font-semibold" style={{ marginTop: 4 }}>
            {device.lastSeenAt ? format(new Date(device.lastSeenAt), 'HH:mm') : '—'}
          </div>
          {device.lastSeenAt && <div className="text-xs subtle">{format(new Date(device.lastSeenAt), 'MMM d')}</div>}
        </div>
      </div>

      {/* Latest readings */}
      {Object.keys(latestMap).length > 0 && (
        <div className="grid grid-cols-4" style={{ marginBottom: 16 }}>
          {Object.entries(latestMap).slice(0, 8).map(([key, value]) => {
            const s = SENSORS.find(x => x.key === key);
            return (
              <div key={key} className="card" style={{ padding: '10px 14px', cursor: 'pointer', border: sensorKey === key ? `1.5px solid var(--accent)` : undefined }}
                onClick={() => setSensorKey(key)}>
                <div className="text-xs muted">{s?.label || key}</div>
                <div className="text-2xl font-semibold tabnum tracking-tight" style={{ marginTop: 2, color: s?.color }}>
                  {typeof value === 'number' ? value.toFixed(1) : value}
                </div>
                <div className="text-xs subtle">{s?.unit || ''}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="layout-main-side">
        {/* Left column: chart + table stacked */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Chart */}
          <Card
            title={`${sensor?.label || sensorKey} · ${device.name}`}
            sub={`${range} · ${readingsList.length} readings`}
            actions={<>
              <Seg value={sensorKey} onChange={setSensorKey}
                options={SENSORS.slice(0, 4).map(s => ({ value: s.key, label: s.label }))} />
              <Seg value={range} onChange={setRange} options={RANGES} />
              <Seg value={chartType} onChange={setChartType} options={[
                { value: 'line', label: 'Line' },
                { value: 'area', label: 'Area' },
                { value: 'bar',  label: 'Bar' },
              ]} />
            </>}>
            {loadingReadings ? (
              <div style={{ height: 260, display: 'grid', placeItems: 'center' }}><Spinner /></div>
            ) : readingsList.length === 0 ? (
              <Empty icon={null} title="No data" hint="No readings for this sensor in the selected range." />
            ) : (
              <LineChart series={chartSeries} height={260} yLabel={sensorUnit}
                area={chartType === 'area'} bar={chartType === 'bar'} showLegend={false} />
            )}
          </Card>

          {/* Table */}
          <Card
            title="Readings"
            sub={readingsList.length ? `${readingsList.length} rows · ${isAggregate ? 'hourly averages' : 'raw'}` : 'No data'}>
            {readingsList.length === 0 ? (
              <Empty icon={null} title="No data" hint="No readings for this sensor and range." />
            ) : (
              <div style={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-elev)', zIndex: 1 }}>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <DTh>Time</DTh>
                      <DTh right>Value ({sensorUnit})</DTh>
                    </tr>
                  </thead>
                  <tbody>
                    {[...readingsList].reverse().map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 1 ? 'var(--bg-subtle)' : 'transparent' }}>
                        <td style={{ padding: '7px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)' }}>
                          {format(new Date(r.timestamp), 'MMM d, HH:mm:ss')}
                        </td>
                        <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {typeof r.value === 'number' ? r.value.toFixed(2) : r.value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Right column: stats + map */}
        <div className="grid" style={{ gap: 12 }}>
          {/* Stats */}
          <Card title="Statistics" sub={`${range} · ${sensor?.label || sensorKey}`}>
            {stats ? (
              <div className="grid grid-cols-2" style={{ gap: 8 }}>
                {[
                  { l: 'Average', v: stats.avg },
                  { l: 'Minimum', v: stats.min },
                  { l: 'Maximum', v: stats.max },
                  { l: 'Samples', v: stats.count },
                ].map(s => (
                  <div key={s.l} style={{ padding: '8px 10px', background: 'var(--bg-subtle)', borderRadius: 8 }}>
                    <div className="text-xs muted">{s.l}</div>
                    <div className="text-lg font-semibold tabnum">{s.v}<span className="text-xs muted" style={{ marginLeft: 3 }}>{s.l !== 'Samples' ? sensorUnit : ''}</span></div>
                  </div>
                ))}
              </div>
            ) : <div className="text-xs muted">No data</div>}
          </Card>

          {/* Location */}
          <Card title="Location" sub={device.locationName || 'GPS coordinates'}>
            <DeviceMap device={device} />
          </Card>

          {/* Device info */}
          <Card title="Device info">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { l: 'Protocol', v: device.protocol || 'http' },
                { l: 'Hardware', v: device.hardwareVersion || '—' },
                { l: 'Firmware', v: device.firmwareVersion || '—' },
                { l: 'Sampling', v: device.config?.sampling_interval_s ? `${device.config.sampling_interval_s}s` : '—' },
                { l: 'Group', v: device.locationName || '—' },
              ].map(row => (
                <div key={row.l} className="row gap-2" style={{ justifyContent: 'space-between' }}>
                  <span className="text-xs muted">{row.l}</span>
                  <span className="text-xs mono">{row.v}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* OTA / Firmware */}
          <Card title="Firmware OTA">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="row gap-2" style={{ justifyContent: 'space-between' }}>
                <span className="text-xs muted">Current</span>
                <span className="text-xs mono">{device.firmwareVersion || '—'}</span>
              </div>
              <div className="row gap-2" style={{ justifyContent: 'space-between' }}>
                <span className="text-xs muted">Active release</span>
                <span className="text-xs mono">{activeFw?.version || '—'}</span>
              </div>
              {hasUpdate && (
                <div style={{ padding: '8px 10px', borderRadius: 6, background: 'color-mix(in oklch, var(--warn) 12%, transparent)', border: '1px solid color-mix(in oklch, var(--warn) 30%, transparent)' }}>
                  <div className="text-xs" style={{ color: 'var(--warn-fg, #92400e)', fontWeight: 500 }}>
                    Update available: {activeFw.version}
                  </div>
                  <div className="text-xs muted" style={{ marginTop: 2 }}>
                    Device will pull update on next check-in via <code>/firmware/check</code>
                  </div>
                </div>
              )}
              {!activeFw && (
                <div className="text-xs muted">No active firmware release. Add one in Settings → Firmware.</div>
              )}
              {activeFw && !hasUpdate && (
                <div className="text-xs" style={{ color: 'var(--ok-soft-fg, #14532d)' }}>Device is up to date</div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {showConfig && (
        <ConfigureModal
          device={device}
          onClose={() => setShowConfig(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['device', id] })}
        />
      )}
    </div>
  );
}

function DTh({ children, right }) {
  return (
    <th style={{
      textAlign: right ? 'right' : 'left', padding: '6px 12px',
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.07em', color: 'var(--fg-muted)',
    }}>{children}</th>
  );
}
