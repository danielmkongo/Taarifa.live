import { useState, useEffect, useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { subHours, format } from 'date-fns';
import { api } from '../services/api.js';
import { Btn, Seg, Card, LineChart, Empty, Spinner } from '../components/ui/index.jsx';
import { IcoDownload } from '../components/ui/Icons.jsx';

const SENSORS = [
  { key: 'temperature', label: 'Temperature', unit: '°C',  color: 'var(--c1)' },
  { key: 'humidity',    label: 'Humidity',    unit: '%',   color: 'var(--c2)' },
  { key: 'rainfall',    label: 'Rainfall',    unit: 'mm',  color: 'var(--c6)' },
  { key: 'pressure',    label: 'Pressure',    unit: 'hPa', color: 'var(--c5)' },
  { key: 'wind_speed',  label: 'Wind',        unit: 'm/s', color: 'var(--c4)' },
  { key: 'co2',         label: 'CO₂',         unit: 'ppm', color: 'var(--c3)' },
];

const PRESET_RANGES = [
  { value: '1h',     label: '1h',    hours: 1   },
  { value: '24h',    label: '24h',   hours: 24  },
  { value: '7d',     label: '7d',    hours: 168 },
  { value: '30d',    label: '30d',   hours: 720 },
  { value: 'custom', label: 'Custom', hours: null },
];

function granularityFor(range, fromIso, toIso) {
  if (range === '1h') return 'raw';
  if (range === 'custom') {
    const diffH = (new Date(toIso) - new Date(fromIso)) / 3_600_000;
    if (diffH <= 2)   return 'raw';
    if (diffH <= 168) return 'hourly';
    return 'daily';
  }
  return 'hourly';
}

const LABEL_FMT = { '1h': 'HH:mm:ss', '24h': 'HH:mm', '7d': 'MMM d', '30d': 'MMM d', custom: 'MMM d HH:mm' };

export default function DataPage() {
  const [deviceId, setDeviceId]   = useState('');
  const [selected, setSelected]   = useState(new Set(SENSORS.map(s => s.key)));
  const [range, setRange]         = useState('24h');
  const [chartType, setChartType] = useState('area');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]     = useState('');
  const [exporting, setExporting]   = useState(false);

  const { data: devicesData, isLoading: loadingDevices } = useQuery({
    queryKey: ['devices'],
    queryFn:  () => api.listDevices({ limit: 100 }),
  });
  const devices = devicesData?.devices || [];

  useEffect(() => {
    if (devices.length > 0 && !deviceId) setDeviceId(devices[0]._id);
  }, [devices.length]);

  function toggleSensor(key) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key) && next.size > 1) next.delete(key);
      else if (!next.has(key)) next.add(key);
      return next;
    });
  }

  const customReady = range !== 'custom' || (!!customFrom && !!customTo);
  const fromIso = range === 'custom'
    ? (customFrom ? new Date(customFrom).toISOString() : subHours(new Date(), 24).toISOString())
    : subHours(new Date(), PRESET_RANGES.find(r => r.value === range)?.hours ?? 24).toISOString();
  const toIso = range === 'custom'
    ? (customTo ? new Date(customTo).toISOString() : new Date().toISOString())
    : new Date().toISOString();

  const granularity = granularityFor(range, fromIso, toIso);
  const isAggregate = granularity !== 'raw';
  const sensorKeysList = [...selected];
  const device = devices.find(d => d._id === deviceId);
  const labelFmt = LABEL_FMT[range] || 'HH:mm';

  const sensorQueries = useQueries({
    queries: sensorKeysList.map(sk => ({
      queryKey: ['readings', deviceId, sk, range, customFrom, customTo],
      queryFn:  () => api.getReadings({ deviceId, sensorKey: sk, from: fromIso, to: toIso, granularity, limit: 500 }),
      enabled:  !!deviceId && customReady,
    })),
  });

  const loadingChart = sensorQueries.some(q => q.isLoading);

  // Build chart series — one per selected sensor
  const series = sensorKeysList.map((sk, qi) => {
    const sensor = SENSORS.find(s => s.key === sk);
    const list   = sensorQueries[qi]?.data?.readings || [];
    if (!list.length) return null;
    const step = Math.max(1, Math.ceil(list.length / 6));
    return {
      name:  sensor?.label || sk,
      color: sensor?.color,
      unit:  sensor?.unit,
      data:  list.map((r, i) => ({
        t: i, v: r.value,
        label: i % step === 0 ? format(new Date(r.timestamp), labelFmt) : '',
      })),
    };
  }).filter(Boolean);

  const mergedRows = useMemo(() => {
    const map = new Map();
    sensorKeysList.forEach((sk, qi) => {
      (sensorQueries[qi]?.data?.readings || []).forEach(r => {
        if (!map.has(r.timestamp)) map.set(r.timestamp, { timestamp: r.timestamp });
        map.get(r.timestamp)[sk] = r.value;
      });
    });
    return [...map.values()].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [sensorKeysList.join(','), sensorQueries.map(q => q.dataUpdatedAt).join(',')]);

  async function handleExport(fmt) {
    if (!deviceId) return;
    setExporting(true);
    try {
      const sk   = sensorKeysList[0];
      const blob = await api.exportReadings({ deviceId, sensorKey: sk, from: fromIso, to: toIso, format: fmt });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `${device?.name || 'export'}-${sk}.${fmt}`; a.click();
      URL.revokeObjectURL(url);
    } finally { setExporting(false); }
  }

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Data Explorer</h1>
          <div className="page__sub">Visualise sensor readings from any device.</div>
        </div>
        <div className="page__actions">
          <Btn kind="secondary" size="sm" icon={IcoDownload} onClick={() => handleExport('csv')}
            disabled={!deviceId || exporting || mergedRows.length === 0}>CSV</Btn>
          <Btn kind="secondary" size="sm" icon={IcoDownload} onClick={() => handleExport('xlsx')}
            disabled={!deviceId || exporting || mergedRows.length === 0}>Excel</Btn>
        </div>
      </div>

      {/* ── Controls ──────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>

        {/* Row 1 — Device */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div className="ctrl-label">Device</div>
          <select className="select" style={{ maxWidth: 360, height: 36, fontSize: 13.5, fontWeight: 500 }}
            value={deviceId} onChange={e => setDeviceId(e.target.value)}>
            {loadingDevices
              ? <option>Loading…</option>
              : devices.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
        </div>

        {/* Row 2 — Sensors (distinct background) */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
          <div className="ctrl-label" style={{ marginBottom: 8 }}>
            Sensors
            <span style={{ marginLeft: 6, fontWeight: 400, textTransform: 'none', letterSpacing: 0,
              color: 'var(--fg-subtle)', fontSize: 11 }}>
              — click multiple to overlay on the chart
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SENSORS.map(s => {
              const on = selected.has(s.key);
              return (
                <button key={s.key} onClick={() => toggleSensor(s.key)} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 13px', borderRadius: 9999, fontSize: 12.5, fontWeight: 600,
                  border: `1.5px solid ${on ? 'transparent' : 'var(--border)'}`,
                  background: on ? s.color : 'var(--bg-elev)',
                  color: on ? 'white' : 'var(--fg-muted)',
                  cursor: 'pointer', transition: 'all 0.15s',
                  boxShadow: on ? `0 0 0 3px color-mix(in oklch, ${s.color} 30%, transparent)` : 'none',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: on ? 'rgba(255,255,255,0.8)' : s.color }} />
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 3 — Time / Chart / View (separated by dividers) */}
        <div style={{ padding: '14px 20px', display: 'flex', flexWrap: 'wrap', gap: 0, alignItems: 'flex-end' }}>
          <CtrlGroup label="Time range" divider>
            <Seg value={range}
              onChange={v => { setRange(v); if (v !== 'custom') { setCustomFrom(''); setCustomTo(''); } }}
              options={PRESET_RANGES} />
          </CtrlGroup>

          {range === 'custom' && (
            <CtrlGroup label="Date range" divider>
              <div style={{ display: 'flex', gap: 8 }}>
                <div>
                  <div className="ctrl-label" style={{ marginBottom: 4 }}>From</div>
                  <input type="datetime-local" className="select"
                    style={{ height: 34, fontSize: 13, paddingRight: 6 }}
                    value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
                </div>
                <div>
                  <div className="ctrl-label" style={{ marginBottom: 4 }}>To</div>
                  <input type="datetime-local" className="select"
                    style={{ height: 34, fontSize: 13, paddingRight: 6 }}
                    value={customTo} onChange={e => setCustomTo(e.target.value)} />
                </div>
              </div>
            </CtrlGroup>
          )}

          <CtrlGroup label="Chart type">
            <Seg value={chartType} onChange={setChartType} options={[
              { value: 'line', label: 'Line' },
              { value: 'area', label: 'Area' },
              { value: 'bar',  label: 'Bar'  },
            ]} />
          </CtrlGroup>
        </div>
      </div>


      {/* ── Latest value tiles ────────────────────────────────── */}
      {deviceId && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
          {sensorKeysList.map((sk, qi) => {
            const sensor   = SENSORS.find(s => s.key === sk);
            const readings = sensorQueries[qi]?.data?.readings || [];
            const latest   = readings[readings.length - 1];
            const loading  = sensorQueries[qi]?.isLoading;
            return (
              <div key={sk} className="card" style={{ padding: '10px 14px' }}>
                <div className="text-xs muted">{sensor?.label || sk}</div>
                <div className="text-2xl font-semibold tabnum tracking-tight"
                  style={{ marginTop: 2, color: sensor?.color }}>
                  {loading ? '…' : latest ? (typeof latest.value === 'number' ? latest.value.toFixed(1) : latest.value) : '—'}
                </div>
                <div className="text-xs subtle">{sensor?.unit || ''}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Chart ──────────────────────────────────────────────── */}
      <Card
          title={device
            ? `${device.name} · ${sensorKeysList.map(k => SENSORS.find(s => s.key === k)?.label || k).join(', ')}`
            : 'Select a device'}
          sub={deviceId
            ? `${range === 'custom' && customFrom
                ? `${format(new Date(fromIso), 'MMM d')} – ${format(new Date(toIso), 'MMM d')}`
                : range} · ${series.reduce((n, s) => Math.max(n, s.data.length), 0)} readings`
            : 'Choose a device above'}
          style={{ marginBottom: 16 }}>
          {!deviceId ? (
            <Empty icon={null} title="No device selected" hint="Pick a device from the selector above." />
          ) : !customReady ? (
            <Empty icon={null} title="Set date range" hint="Enter both From and To dates to load data." />
          ) : loadingChart ? (
            <div style={{ height: 320, display: 'grid', placeItems: 'center' }}><Spinner /></div>
          ) : series.length === 0 ? (
            <Empty icon={null} title="No data" hint="No readings for the selected sensors and range." />
          ) : (
            <LineChart series={series} height={320}
              yLabel={selected.size === 1 ? SENSORS.find(s => s.key === [...selected][0])?.unit : undefined}
              area={chartType === 'area'} bar={chartType === 'bar'}
              showLegend={selected.size > 1}
              normalize={selected.size > 1} />
          )}
        </Card>

      {/* ── Table ──────────────────────────────────────────────── */}
      <Card
          title="Readings table"
          sub={mergedRows.length
            ? `${mergedRows.length} rows · ${isAggregate ? granularity + ' averages' : 'raw'}`
            : 'No data'}
          style={{ marginBottom: 16 }}>
          {!deviceId ? (
            <Empty icon={null} title="No device selected" hint="Pick a device from the selector above." />
          ) : !customReady ? (
            <Empty icon={null} title="Set date range" hint="Enter both From and To dates to load data." />
          ) : loadingChart ? (
            <div style={{ padding: 48, display: 'grid', placeItems: 'center' }}><Spinner /></div>
          ) : mergedRows.length === 0 ? (
            <Empty icon={null} title="No data" hint="No readings for the selected range." />
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-elev)', zIndex: 1 }}>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <Th>Time</Th>
                    {sensorKeysList.map(sk => {
                      const s = SENSORS.find(x => x.key === sk);
                      return <Th key={sk} right>{s?.label || sk}{s?.unit ? ` (${s.unit})` : ''}</Th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {mergedRows.map((row, i) => (
                    <tr key={row.timestamp} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 1 ? 'var(--bg-subtle)' : 'transparent' }}>
                      <td style={{ padding: '7px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)', whiteSpace: 'nowrap' }}>
                        {format(new Date(row.timestamp), 'MMM d, yyyy HH:mm')}
                      </td>
                      {sensorKeysList.map(sk => (
                        <td key={sk} style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {row[sk] != null ? (typeof row[sk] === 'number' ? row[sk].toFixed(2) : row[sk]) : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

    </div>
  );
}

function CtrlGroup({ label, children, divider }) {
  return (
    <div style={{
      paddingRight: divider ? 20 : 0,
      marginRight:  divider ? 20 : 0,
      borderRight:  divider ? '1px solid var(--border)' : 'none',
    }}>
      <div className="ctrl-label">{label}</div>
      {children}
    </div>
  );
}

function Th({ children, right }) {
  return (
    <th style={{
      textAlign: right ? 'right' : 'left', padding: '7px 12px',
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.07em', color: 'var(--fg-muted)',
    }}>{children}</th>
  );
}
