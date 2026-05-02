import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { api } from '../services/api.js';
import { format, subHours } from 'date-fns';
import { Btn, Badge, StatusDot, Seg, Card, LineChart, Sparkline, Empty, Spinner } from '../components/ui/index.jsx';
import { IcoArrowRight, IcoDownload, IcoSettings, IcoRefresh, IcoMap } from '../components/ui/Icons.jsx';

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

function DeviceMap({ device }) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });
  const [map, setMap] = useState(null);

  const coords = device?.location?.coordinates;
  if (!coords) return <div className="muted text-sm" style={{ padding: 16 }}>No location recorded.</div>;

  const center = { lat: coords[1], lng: coords[0] };

  return (
    <div style={{ height: 220, borderRadius: 8, overflow: 'hidden' }}>
      {isLoaded ? (
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={center}
          zoom={13}
          options={{ mapTypeId: 'hybrid', zoomControl: true, mapTypeControl: false, streetViewControl: false, fullscreenControl: false }}
          onLoad={m => {
            setMap(m);
            // Place a marker
            new window.google.maps.Marker({
              position: center,
              map: m,
              title: device.name,
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
  const [sensorKey, setSensorKey] = useState('temperature');
  const [range, setRange] = useState('24h');
  const [chartType, setChartType] = useState('line');
  const [exporting, setExporting] = useState(false);

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

  const chartSeries = useMemo(() => {
    if (!readings?.readings?.length) return [];
    const sensor = SENSORS.find(s => s.key === sensorKey);
    const data = readings.readings.map((r, i) => ({
      t: i,
      v: r.value,
      label: i % Math.ceil(readings.readings.length / 6) === 0
        ? format(new Date(r.timestamp), range === '1h' ? 'HH:mm' : range === '24h' ? 'HH:mm' : 'MMM d')
        : '',
    }));
    return [{ name: `${device?.name || ''} · ${sensor?.label || sensorKey}`, color: sensor?.color || 'var(--c1)', data }];
  }, [readings, sensorKey, device, range]);

  const stats = useMemo(() => {
    if (!readings?.readings?.length) return null;
    const vals = readings.readings.map(r => r.value);
    return {
      avg: (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2),
      min: Math.min(...vals).toFixed(2),
      max: Math.max(...vals).toFixed(2),
      count: vals.length,
    };
  }, [readings]);

  const sensorUnit = SENSORS.find(s => s.key === sensorKey)?.unit || '';
  const latestMap = {};
  (Array.isArray(latest) ? latest : []).forEach(r => { latestMap[r._id] = r.value; });

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
          <Btn kind="ghost" size="sm" icon={IcoSettings}>Configure</Btn>
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

      <div className="grid" style={{ gridTemplateColumns: '1fr 280px', gap: 16, alignItems: 'flex-start' }}>
        {/* Chart */}
        <Card
          title={`${SENSORS.find(s => s.key === sensorKey)?.label || sensorKey} · ${device.name}`}
          sub={`${range} · ${readings?.readings?.length || 0} data points`}
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
          {loadingReadings ? <Spinner /> : chartSeries.length === 0 ? (
            <Empty icon={null} title="No data" hint="No readings for this sensor in the selected range." />
          ) : (
            <LineChart
              series={chartSeries}
              height={280}
              yLabel={sensorUnit}
              area={chartType === 'area'}
              bar={chartType === 'bar'}
            />
          )}
        </Card>

        {/* Right column: stats + map */}
        <div className="grid" style={{ gap: 12 }}>
          {/* Stats */}
          <Card title="Statistics" sub={`${range} · ${sensorKey}`}>
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
        </div>
      </div>
    </div>
  );
}
