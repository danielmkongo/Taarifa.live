import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api.js';
import { Btn, Badge, StatusDot, Seg, Card, LineChart, Empty } from '../components/ui/index.jsx';
import { IcoDownload, IcoBookmark, IcoShare, IcoFlame, IcoStar, IcoMore, IcoArrowRight } from '../components/ui/Icons.jsx';

const SENSORS = [
  { key: 'temperature', label: 'Temperature', unit: '°C',  color: 'var(--c1)' },
  { key: 'humidity',    label: 'Humidity',    unit: '%',   color: 'var(--c2)' },
  { key: 'rainfall',    label: 'Rainfall',    unit: 'mm',  color: 'var(--c6)' },
  { key: 'pressure',    label: 'Pressure',    unit: 'hPa', color: 'var(--c5)' },
  { key: 'wind_speed',  label: 'Wind speed',  unit: 'm/s', color: 'var(--c4)' },
  { key: 'co2',         label: 'CO₂',         unit: 'ppm', color: 'var(--c3)' },
];

const SAVED_VIEWS = [
  { id: 'sv1', name: 'Serengeti — temperature compare', count: 4 },
  { id: 'sv2', name: 'Wetland rainfall · 7d',           count: 3 },
  { id: 'sv3', name: 'Highland pressure anomalies',     count: 2 },
];

const ANOMALIES = [
  { time: '14:32', device: 'TRF-003', sensor: 'temperature', value: '39.4°C', deviation: '+3.1σ', kind: 'spike' },
  { time: '11:08', device: 'TRF-007', sensor: 'co2',         value: '1842 ppm', deviation: '+2.9σ', kind: 'spike' },
  { time: '08:14', device: 'TRF-009', sensor: 'temperature', value: 'gap',    deviation: '6m missing', kind: 'gap' },
];

function rng(seed) {
  let s = seed | 0; if (s === 0) s = 1;
  return () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 0) / 4294967296); };
}
function genSeries(n, base, noise, drift = 0, seed = 1) {
  const r = rng(seed);
  let v = base;
  return Array.from({ length: n }, (_, i) => {
    v += (r() - 0.5) * noise + drift / n;
    return { t: i, v: +v.toFixed(2), label: i % 8 === 0 ? `${(i / 2) | 0}:00` : '' };
  });
}

export default function DataPage() {
  const [range, setRange] = useState('24h');
  const [granularity, setGranularity] = useState('1h');
  const [selectedSensors, setSelectedSensors] = useState(['temperature']);
  const [selectedDevs, setSelectedDevs] = useState([]);
  const [overlay, setOverlay] = useState(true);
  const [chartType, setChartType] = useState('line');

  const { data: devicesData, isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: () => api.listDevices({ limit: 100 }),
  });
  const devices = devicesData?.devices || [];

  useEffect(() => {
    if (devices.length > 0 && selectedDevs.length === 0) {
      setSelectedDevs(devices.slice(0, Math.min(3, devices.length)).map(d => d._id));
    }
  }, [devices.length]);

  const activeDevs = selectedDevs;

  const series = useMemo(() => {
    const colors = ['var(--c1)','var(--c2)','var(--c3)','var(--c4)','var(--c5)','var(--c6)'];
    let i = 0;
    const out = [];
    activeDevs.forEach(devId => {
      const dev = devices.find(d => d._id === devId);
      selectedSensors.forEach(sk => {
        const sensor = SENSORS.find(s => s.key === sk);
        const data = genSeries(48,
          sk === 'temperature' ? 25 : sk === 'humidity' ? 55 : 5,
          sk === 'temperature' ? 1.4 : 2.0,
          0, i * 7 + 1);
        out.push({ name: `${dev?.name || devId.slice(-6)} · ${sensor?.label}`, color: colors[i % 6], data });
        i++;
      });
    });
    return out;
  }, [activeDevs, selectedSensors, devices.length]);

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Data Explorer</h1>
          <div className="page__sub">Query, compare and detect anomalies across devices and sensors.</div>
        </div>
        <div className="page__actions">
          <Btn kind="secondary" size="sm" icon={IcoBookmark}>Save view</Btn>
          <Btn kind="secondary" size="sm" icon={IcoShare}>Share</Btn>
          <Btn kind="primary" size="sm" icon={IcoDownload}>Export</Btn>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '260px 1fr', alignItems: 'flex-start' }}>
        <div className="card" style={{ padding: 14 }}>
          <div className="text-xs uppercase tracking-wide subtle" style={{ marginBottom: 6 }}>Saved views</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 14 }}>
            {SAVED_VIEWS.map(v => (
              <button key={v.id} className="row gap-2"
                style={{ padding: '6px 8px', borderRadius: 4, fontSize: 12.5, textAlign: 'left', color: 'var(--fg-muted)', width: '100%', background: 'transparent', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <IcoStar size={12} />
                <span style={{ flex: 1 }}>{v.name}</span>
                <span className="text-xs subtle mono">{v.count}</span>
              </button>
            ))}
          </div>

          <div className="text-xs uppercase tracking-wide subtle" style={{ marginBottom: 6 }}>Devices</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 12, maxHeight: 200, overflowY: 'auto' }}>
            {isLoading ? <div className="skel" style={{ height: 80 }} /> :
              devices.slice(0, 10).map(d => {
                const checked = activeDevs.includes(d._id);
                return (
                  <label key={d._id} className="row gap-2" style={{ padding: '4px 6px', borderRadius: 4, fontSize: 12.5, cursor: 'pointer' }}>
                    <input type="checkbox" checked={checked}
                      onChange={() => setSelectedDevs(s =>
                        checked ? s.filter(x => x !== d._id) : [...s, d._id]
                      )}
                      style={{ accentColor: 'var(--accent)' }} />
                    <StatusDot status={d.status} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                  </label>
                );
              })}
          </div>

          <div className="text-xs uppercase tracking-wide subtle" style={{ marginBottom: 6 }}>Sensors</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
            {SENSORS.map(s => {
              const on = selectedSensors.includes(s.key);
              return (
                <button key={s.key}
                  onClick={() => setSelectedSensors(x => on ? x.filter(y => y !== s.key) : [...x, s.key])}
                  className="badge"
                  style={{
                    padding: '3px 8px', fontSize: 11.5, cursor: 'pointer',
                    background: on ? 'var(--accent-soft)' : 'transparent',
                    color: on ? 'var(--accent-soft-fg)' : 'var(--fg-muted)',
                    border: `1px solid ${on ? 'transparent' : 'var(--border)'}`,
                    borderRadius: 9999,
                  }}>
                  <span style={{ width: 6, height: 6, borderRadius: 50, background: s.color, display: 'inline-block', marginRight: 4 }} />
                  {s.label}
                </button>
              );
            })}
          </div>

          <div className="text-xs uppercase tracking-wide subtle" style={{ marginBottom: 6 }}>Time range</div>
          <Seg value={range} onChange={setRange} options={['1h','24h','7d','30d','custom']} />

          <div className="text-xs uppercase tracking-wide subtle" style={{ marginBottom: 6, marginTop: 12 }}>Granularity</div>
          <Seg value={granularity} onChange={setGranularity} options={['raw','5m','1h','1d']} />

          <div style={{ marginTop: 14 }}>
            <Btn kind="secondary" full size="sm" icon={IcoFlame}>Find anomalies</Btn>
          </div>
        </div>

        <div className="grid" style={{ gap: 16 }}>
          <Card
            title={`${selectedSensors.map(k => SENSORS.find(s => s.key === k)?.label).join(' · ')} · ${activeDevs.length} devices`}
            sub={`${range} · ${granularity} buckets · ${series.length} series`}
            actions={<>
              <Seg value={chartType} onChange={setChartType} options={[
                { value: 'line', label: 'Line' },
                { value: 'area', label: 'Area' },
                { value: 'bar',  label: 'Bar' },
              ]} />
              <Seg value={overlay ? 'overlay' : 'split'} onChange={v => setOverlay(v === 'overlay')} options={[
                { value: 'overlay', label: 'Overlay' },
                { value: 'split',   label: 'Stack' },
              ]} />
              <Btn kind="ghost" size="sm" icon={IcoMore} />
            </>}>
            {series.length === 0 ? (
              <Empty icon={null} title="Select devices and sensors" hint="Use the panel on the left." />
            ) : !overlay ? (
              <div className="grid" style={{ gap: 14 }}>
                {series.map(s => (
                  <div key={s.name}>
                    <div className="text-xs muted" style={{ marginBottom: 4 }}>{s.name}</div>
                    <LineChart series={[s]} height={120} showLegend={false} area={chartType === 'area'} bar={chartType === 'bar'} />
                  </div>
                ))}
              </div>
            ) : (
              <LineChart series={series} height={300}
                yLabel={SENSORS.find(s => s.key === selectedSensors[0])?.unit}
                area={chartType === 'area'} bar={chartType === 'bar'} />
            )}
          </Card>

          <div className="grid grid-cols-4">
            {[
              { l: 'Average', v: '—' },
              { l: 'Minimum', v: '—' },
              { l: 'Maximum', v: '—' },
              { l: 'Samples', v: '—' },
            ].map(s => (
              <div key={s.l} className="card" style={{ padding: 12 }}>
                <div className="text-xs muted">{s.l}</div>
                <div className="text-xl font-semibold tabnum" style={{ marginTop: 4 }}>{s.v}</div>
              </div>
            ))}
          </div>

          <Card title="Detected anomalies" sub="Statistical outliers vs 30-day baseline · click to inspect"
            actions={<Btn kind="ghost" size="sm">Tune sensitivity</Btn>}>
            <table className="table" style={{ marginLeft: -16, marginRight: -16, width: 'calc(100% + 32px)' }}>
              <thead>
                <tr>
                  <th style={{ paddingLeft: 16 }}>Time</th>
                  <th>Device</th>
                  <th>Sensor</th>
                  <th>Value</th>
                  <th>Deviation</th>
                  <th>Kind</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {ANOMALIES.map((a, i) => (
                  <tr key={i}>
                    <td className="mono text-xs" style={{ paddingLeft: 16 }}>{a.time}</td>
                    <td className="mono text-xs">{a.device}</td>
                    <td>{a.sensor}</td>
                    <td className="tabnum mono">{a.value}</td>
                    <td><Badge kind={a.kind === 'gap' ? 'neutral' : 'warn'}>{a.deviation}</Badge></td>
                    <td><Badge kind="outline">{a.kind}</Badge></td>
                    <td><Btn kind="ghost" size="sm" iconRight={IcoArrowRight}>Inspect</Btn></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </div>
  );
}
