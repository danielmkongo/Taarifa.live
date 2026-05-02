import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  { value: '1h',  label: '1h',  hours: 1   },
  { value: '24h', label: '24h', hours: 24  },
  { value: '7d',  label: '7d',  hours: 168 },
  { value: '30d', label: '30d', hours: 720 },
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
  const [deviceId, setDeviceId]     = useState('');
  const [sensorKey, setSensorKey]   = useState('temperature');
  const [range, setRange]           = useState('24h');
  const [chartType, setChartType]   = useState('area');
  const [view, setView]             = useState('chart');
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

  const customReady = range !== 'custom' || (!!customFrom && !!customTo);

  const fromIso = range === 'custom'
    ? (customFrom ? new Date(customFrom).toISOString() : subHours(new Date(), 24).toISOString())
    : subHours(new Date(), PRESET_RANGES.find(r => r.value === range)?.hours ?? 24).toISOString();
  const toIso = range === 'custom'
    ? (customTo ? new Date(customTo).toISOString() : new Date().toISOString())
    : new Date().toISOString();

  const granularity = granularityFor(range, fromIso, toIso);
  const isAggregate = granularity !== 'raw';

  const { data: readingsData, isLoading: loadingChart } = useQuery({
    queryKey: ['readings', deviceId, sensorKey, range, customFrom, customTo],
    queryFn:  () => api.getReadings({ deviceId, sensorKey, from: fromIso, to: toIso, granularity, limit: 500 }),
    enabled:  !!deviceId && customReady,
  });

  const readingsList = readingsData?.readings || [];
  const sensor = SENSORS.find(s => s.key === sensorKey) || SENSORS[0];
  const device = devices.find(d => d._id === deviceId);
  const labelFmt = LABEL_FMT[range] || 'HH:mm';

  const series = useMemo(() => {
    if (!readingsList.length) return [];
    const step = Math.max(1, Math.ceil(readingsList.length / 6));
    const data = readingsList.map((r, i) => ({
      t: i,
      v: r.value,
      label: i % step === 0 ? format(new Date(r.timestamp), labelFmt) : '',
    }));
    return [{ name: `${device?.name || 'Device'} · ${sensor.label}`, color: sensor.color, data }];
  }, [readingsList, sensorKey, deviceId, range]);

  const stats = useMemo(() => {
    if (!readingsList.length) return null;
    const vals = readingsList.map(r => r.value);
    const avg  = vals.reduce((a, b) => a + b, 0) / vals.length;
    return { avg: avg.toFixed(2), min: Math.min(...vals).toFixed(2), max: Math.max(...vals).toFixed(2), count: vals.length };
  }, [readingsList]);

  async function handleExport(fmt) {
    if (!deviceId) return;
    setExporting(true);
    try {
      const blob = await api.exportReadings({ deviceId, sensorKey, from: fromIso, to: toIso, format: fmt });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${device?.name || 'export'}-${sensorKey}.${fmt}`; a.click();
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
            disabled={!deviceId || exporting || !stats}>CSV</Btn>
          <Btn kind="secondary" size="sm" icon={IcoDownload} onClick={() => handleExport('xlsx')}
            disabled={!deviceId || exporting || !stats}>Excel</Btn>
        </div>
      </div>

      {/* Controls */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ marginBottom: 18 }}>
          <div className="ctrl-label">Device</div>
          <select className="select" style={{ maxWidth: 360, height: 36, fontSize: 13.5, fontWeight: 500 }}
            value={deviceId} onChange={e => setDeviceId(e.target.value)}>
            {loadingDevices
              ? <option>Loading…</option>
              : devices.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 18 }}>
          <div className="ctrl-label">Sensor</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SENSORS.map(s => {
              const on = sensorKey === s.key;
              return (
                <button key={s.key} onClick={() => setSensorKey(s.key)} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 13px', borderRadius: 9999, fontSize: 12.5, fontWeight: 600,
                  border: `1.5px solid ${on ? 'transparent' : 'var(--border)'}`,
                  background: on ? s.color : 'transparent',
                  color: on ? 'white' : 'var(--fg-muted)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%',
                    background: on ? 'rgba(255,255,255,0.75)' : s.color, flexShrink: 0 }} />
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
          <div>
            <div className="ctrl-label">Time range</div>
            <Seg value={range} onChange={v => { setRange(v); if (v !== 'custom') { setCustomFrom(''); setCustomTo(''); } }}
              options={PRESET_RANGES} />
          </div>

          {range === 'custom' && (
            <>
              <div>
                <div className="ctrl-label">From</div>
                <input type="datetime-local" className="select"
                  style={{ height: 36, fontSize: 13, paddingRight: 8 }}
                  value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
              </div>
              <div>
                <div className="ctrl-label">To</div>
                <input type="datetime-local" className="select"
                  style={{ height: 36, fontSize: 13, paddingRight: 8 }}
                  value={customTo} onChange={e => setCustomTo(e.target.value)} />
              </div>
            </>
          )}

          <div>
            <div className="ctrl-label">Chart type</div>
            <Seg value={chartType} onChange={setChartType} options={[
              { value: 'line', label: 'Line' },
              { value: 'area', label: 'Area' },
              { value: 'bar',  label: 'Bar' },
            ]} />
          </div>

          <div>
            <div className="ctrl-label">View</div>
            <Seg value={view} onChange={setView} options={[
              { value: 'chart', label: 'Chart' },
              { value: 'table', label: 'Table' },
              { value: 'both',  label: 'Both'  },
            ]} />
          </div>
        </div>
      </div>

      {/* Chart */}
      {(view === 'chart' || view === 'both') && (
        <Card
          title={device ? `${device.name} · ${sensor.label}` : 'Select a device'}
          sub={deviceId ? `${range === 'custom' && customFrom ? `${format(new Date(fromIso), 'MMM d')} – ${format(new Date(toIso), 'MMM d')}` : range} · ${readingsList.length} readings · ${sensor.unit}` : 'Choose a device above'}
          style={{ marginBottom: 16 }}>
          {!deviceId ? (
            <Empty icon={null} title="No device selected" hint="Pick a device from the selector above." />
          ) : !customReady ? (
            <Empty icon={null} title="Set date range" hint="Enter both From and To dates to load data." />
          ) : loadingChart ? (
            <div style={{ height: 320, display: 'grid', placeItems: 'center' }}><Spinner /></div>
          ) : series.length === 0 ? (
            <Empty icon={null} title="No data"
              hint={`No ${sensor.label.toLowerCase()} readings for the selected range.`} />
          ) : (
            <LineChart series={series} height={320} yLabel={sensor.unit}
              area={chartType === 'area'} bar={chartType === 'bar'} showLegend={false} />
          )}
        </Card>
      )}

      {/* Table */}
      {(view === 'table' || view === 'both') && (
        <Card title="Readings table"
          sub={readingsList.length ? `${readingsList.length} rows · ${isAggregate ? granularity + ' averages' : 'raw'}` : 'No data'}
          style={{ marginBottom: 16 }}>
          {!deviceId ? (
            <Empty icon={null} title="No device selected" hint="Pick a device from the selector above." />
          ) : !customReady ? (
            <Empty icon={null} title="Set date range" hint="Enter both From and To dates to load data." />
          ) : loadingChart ? (
            <div style={{ padding: 48, display: 'grid', placeItems: 'center' }}><Spinner /></div>
          ) : readingsList.length === 0 ? (
            <Empty icon={null} title="No data"
              hint={`No ${sensor.label.toLowerCase()} readings for the selected range.`} />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <Th>Time</Th>
                    <Th right>Value ({sensor.unit})</Th>
                    {isAggregate && <><Th right>Min</Th><Th right>Max</Th><Th right>Count</Th></>}
                  </tr>
                </thead>
                <tbody>
                  {[...readingsList].reverse().map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 1 ? 'var(--bg-subtle)' : 'transparent' }}>
                      <td style={{ padding: '7px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)' }}>
                        {format(new Date(r.timestamp), 'MMM d, yyyy HH:mm:ss')}
                      </td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {typeof r.value === 'number' ? r.value.toFixed(2) : r.value}
                      </td>
                      {isAggregate && (
                        <>
                          <td style={{ padding: '7px 12px', textAlign: 'right', color: 'var(--fg-muted)', fontVariantNumeric: 'tabular-nums' }}>
                            {r.min != null ? r.min.toFixed(2) : '—'}
                          </td>
                          <td style={{ padding: '7px 12px', textAlign: 'right', color: 'var(--fg-muted)', fontVariantNumeric: 'tabular-nums' }}>
                            {r.max != null ? r.max.toFixed(2) : '—'}
                          </td>
                          <td style={{ padding: '7px 12px', textAlign: 'right', color: 'var(--fg-muted)', fontVariantNumeric: 'tabular-nums' }}>
                            {r.count}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4" style={{ gap: 12 }}>
          {[
            { label: 'Average', value: stats.avg, unit: sensor.unit },
            { label: 'Minimum', value: stats.min, unit: sensor.unit },
            { label: 'Maximum', value: stats.max, unit: sensor.unit },
            { label: 'Readings', value: stats.count, unit: '' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '18px 20px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
                color: 'var(--fg-muted)', marginBottom: 10 }}>{s.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums' }}>{s.value}</span>
                {s.unit && <span style={{ fontSize: 13, color: 'var(--fg-muted)', fontWeight: 500 }}>{s.unit}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Th({ children, right }) {
  return (
    <th style={{
      textAlign: right ? 'right' : 'left',
      padding: '7px 12px',
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
      color: 'var(--fg-muted)',
    }}>{children}</th>
  );
}
