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

const RANGES = [
  { value: '1h',  label: '1h',  hours: 1 },
  { value: '24h', label: '24h', hours: 24 },
  { value: '7d',  label: '7d',  hours: 168 },
  { value: '30d', label: '30d', hours: 720 },
];

export default function DataPage() {
  const [deviceId, setDeviceId] = useState('');
  const [sensorKey, setSensorKey] = useState('temperature');
  const [range, setRange]         = useState('24h');
  const [chartType, setChartType] = useState('area');
  const [exporting, setExporting] = useState(false);

  const { data: devicesData, isLoading: loadingDevices } = useQuery({
    queryKey: ['devices'],
    queryFn:  () => api.listDevices({ limit: 100 }),
  });
  const devices = devicesData?.devices || [];

  useEffect(() => {
    if (devices.length > 0 && !deviceId) setDeviceId(devices[0]._id);
  }, [devices.length]);

  const rangeObj = RANGES.find(r => r.value === range) || RANGES[1];
  const from = subHours(new Date(), rangeObj.hours).toISOString();
  const to   = new Date().toISOString();

  const { data: readings, isLoading: loadingChart } = useQuery({
    queryKey: ['readings', deviceId, sensorKey, range],
    queryFn:  () => api.getReadings({ deviceId, sensorKey, from, to,
      granularity: range === '1h' ? 'raw' : 'hourly', limit: 500 }),
    enabled: !!deviceId,
  });

  const sensor = SENSORS.find(s => s.key === sensorKey) || SENSORS[0];
  const device = devices.find(d => d._id === deviceId);

  const series = useMemo(() => {
    if (!readings?.readings?.length) return [];
    const step = Math.ceil(readings.readings.length / 6);
    const data = readings.readings.map((r, i) => ({
      t: i,
      v: r.value,
      label: i % step === 0 ? format(new Date(r.timestamp), range === '30d' ? 'MMM d' : 'HH:mm') : '',
    }));
    return [{ name: `${device?.name || 'Device'} · ${sensor.label}`, color: sensor.color, data }];
  }, [readings, sensorKey, deviceId, devices, range]);

  const stats = useMemo(() => {
    if (!readings?.readings?.length) return null;
    const vals = readings.readings.map(r => r.value);
    const avg  = vals.reduce((a, b) => a + b, 0) / vals.length;
    return { avg: avg.toFixed(2), min: Math.min(...vals).toFixed(2), max: Math.max(...vals).toFixed(2), count: vals.length };
  }, [readings]);

  async function handleExport(fmt) {
    if (!deviceId) return;
    setExporting(true);
    try {
      const blob = await api.exportReadings({ deviceId, sensorKey, from, to, format: fmt });
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
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
            color: 'var(--fg-muted)', marginBottom: 6 }}>Device</div>
          <select className="select" style={{ maxWidth: 360, height: 36, fontSize: 13.5, fontWeight: 500 }}
            value={deviceId} onChange={e => setDeviceId(e.target.value)}>
            {loadingDevices
              ? <option>Loading…</option>
              : devices.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
            color: 'var(--fg-muted)', marginBottom: 6 }}>Sensor</div>
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

        <div className="row gap-6">
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
              color: 'var(--fg-muted)', marginBottom: 6 }}>Time range</div>
            <Seg value={range} onChange={setRange} options={RANGES} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
              color: 'var(--fg-muted)', marginBottom: 6 }}>Chart type</div>
            <Seg value={chartType} onChange={setChartType} options={[
              { value: 'line', label: 'Line' },
              { value: 'area', label: 'Area' },
              { value: 'bar',  label: 'Bar' },
            ]} />
          </div>
        </div>
      </div>

      {/* Chart */}
      <Card
        title={device ? `${device.name} · ${sensor.label}` : 'Select a device'}
        sub={deviceId ? `${range} · ${readings?.readings?.length || 0} readings · ${sensor.unit}` : 'Choose a device above'}
        style={{ marginBottom: 16 }}>
        {!deviceId ? (
          <Empty icon={null} title="No device selected" hint="Pick a device from the selector above." />
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
