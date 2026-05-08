import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuthStore } from '../store/auth.js';
import { Btn, Badge, StatusDot, Seg, Card, Sparkline, LineChart, BarMini, Empty } from '../components/ui/index.jsx';
import {
  IcoRefresh, IcoPlus, IcoArrowRight, IcoArrowUp, IcoArrowDown,
  IcoAlert, IcoPin, IcoExternal, IcoLayoutGrid,
} from '../components/ui/Icons.jsx';

function rng(seed) {
  let s = seed | 0; if (s === 0) s = 1;
  return () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 0) / 4294967296); };
}
function genSeries(n, base, noise, drift = 0, seed = 1) {
  const r = rng(seed); let v = base;
  return Array.from({ length: n }, (_, i) => { v += (r() - 0.5) * noise + drift / n; return { t: i, v: +v.toFixed(2) }; });
}

// ── Weather banner ─────────────────────────────────────────────────────────────
const WX_CITIES = [
  { name: 'Dar es Salaam', lat: -6.7924, lon: 39.2083 },
  { name: 'Zanzibar',      lat: -6.1659, lon: 39.2026 },
  { name: 'Arusha',        lat: -3.3869, lon: 36.6830 },
  { name: 'Mwanza',        lat: -2.5164, lon: 32.9175 },
  { name: 'Dodoma',        lat: -6.1722, lon: 35.7395 },
  { name: 'Kilimanjaro',   lat: -3.0674, lon: 37.3556 },
  { name: 'Mbeya',         lat: -8.9000, lon: 33.4600 },
];

const WX_GRADIENTS = {
  sunny:  '#0369a1 0%, #0ea5e9 50%, #38bdf8 100%',
  partly: '#1d4ed8 0%, #3b82f6 50%, #60a5fa 100%',
  cloudy: '#374151 0%, #6b7280 55%, #9ca3af 100%',
  rainy:  '#1e293b 0%, #334155 50%, #475569 100%',
  stormy: '#020617 0%, #0f172a 40%, #1f2937 100%',
};

function wmoToState(code) {
  if (code === 0) return 'sunny';
  if (code <= 2) return 'partly';
  if (code <= 3 || (code >= 45 && code <= 48)) return 'cloudy';
  if (code >= 95) return 'stormy';
  return 'rainy';
}

function wmoToLabel(code) {
  if (code === 0) return 'Sunny';
  if (code === 1) return 'Mainly Clear';
  if (code === 2) return 'Partly Cloudy';
  if (code === 3) return 'Overcast';
  if (code >= 45 && code <= 48) return 'Foggy';
  if (code >= 51 && code <= 55) return 'Drizzle';
  if (code >= 61 && code <= 65) return 'Rain';
  if (code >= 80 && code <= 82) return 'Rain Showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Cloudy';
}

function WxCloud({ x, y, w = 120, bh = 42, color = 'rgba(255,255,255,0.85)' }) {
  const r = bh / 2;
  return (
    <g>
      <ellipse cx={x + w / 2} cy={y + r * 1.1} rx={w / 2} ry={r * 0.68} fill={color} />
      <circle cx={x + w * 0.25} cy={y + r * 0.72} r={r * 0.92} fill={color} />
      <circle cx={x + w * 0.52} cy={y + r * 0.38} r={r} fill={color} />
      <circle cx={x + w * 0.78} cy={y + r * 0.65} r={r * 0.78} fill={color} />
    </g>
  );
}

function WxScene({ state }) {
  return (
    <svg viewBox="0 0 560 155" width="100%" height="100%"
      preserveAspectRatio="xMidYMid slice"
      style={{ display: 'block', animation: 'wx-scene-in 0.7s ease' }}>

      {state === 'sunny' && <>
        <circle cx={460} cy={48} r={78} fill="#fde68a" opacity="0.12" />
        <circle cx={460} cy={48} r={56} fill="#fbbf24" opacity="0.16" />
        <g style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'wx-sun-spin 28s linear infinite' }}>
          <g transform="translate(460,48)">
            {Array.from({ length: 12 }, (_, i) => {
              const a = (i / 12) * Math.PI * 2;
              return <line key={i} x1={Math.cos(a) * 40} y1={Math.sin(a) * 40} x2={Math.cos(a) * 60} y2={Math.sin(a) * 60}
                stroke="#fde68a" strokeWidth="4" strokeLinecap="round" opacity="0.85" />;
            })}
          </g>
        </g>
        <circle cx={460} cy={48} r={37} fill="#fbbf24" />
        <circle cx={460} cy={48} r={24} fill="#fef3c7" opacity="0.55" />
        <g style={{ animation: 'wx-cloud-drift 22s linear infinite' }}>
          <WxCloud x={-90} y={90} w={140} bh={38} color="rgba(255,255,255,0.22)" />
        </g>
        <g style={{ animation: 'wx-cloud-drift-slow 34s 4s linear infinite' }}>
          <WxCloud x={200} y={105} w={110} bh={30} color="rgba(255,255,255,0.16)" />
        </g>
      </>}

      {state === 'partly' && <>
        <circle cx={430} cy={38} r={55} fill="#fbbf24" opacity="0.18" />
        <g style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'wx-sun-spin 32s linear infinite' }}>
          <g transform="translate(430,38)">
            {Array.from({ length: 10 }, (_, i) => {
              const a = (i / 10) * Math.PI * 2;
              return <line key={i} x1={Math.cos(a) * 32} y1={Math.sin(a) * 32} x2={Math.cos(a) * 50} y2={Math.sin(a) * 50}
                stroke="#fde68a" strokeWidth="3.5" strokeLinecap="round" opacity="0.75" />;
            })}
          </g>
        </g>
        <circle cx={430} cy={38} r={30} fill="#fbbf24" />
        <g style={{ animation: 'wx-cloud-drift 15s linear infinite' }}>
          <WxCloud x={330} y={8} w={195} bh={62} />
        </g>
        <g style={{ animation: 'wx-cloud-drift-slow 26s linear infinite' }}>
          <WxCloud x={70} y={82} w={150} bh={48} color="rgba(255,255,255,0.78)" />
        </g>
        <g style={{ animation: 'wx-cloud-drift 34s 7s linear infinite' }}>
          <WxCloud x={-70} y={45} w={115} bh={38} color="rgba(255,255,255,0.55)" />
        </g>
      </>}

      {state === 'cloudy' && <>
        <WxCloud x={-35} y={2} w={230} bh={72} color="rgba(255,255,255,0.18)" />
        <g style={{ animation: 'wx-cloud-drift 30s linear infinite' }}>
          <WxCloud x={175} y={-5} w={215} bh={78} color="rgba(255,255,255,0.15)" />
        </g>
        <g style={{ animation: 'wx-cloud-drift-slow 20s linear infinite' }}>
          <WxCloud x={365} y={5} w={195} bh={68} color="rgba(255,255,255,0.20)" />
        </g>
        <g style={{ animation: 'wx-cloud-drift 24s 6s linear infinite' }}>
          <WxCloud x={55} y={78} w={260} bh={68} color="rgba(255,255,255,0.12)" />
        </g>
        <g style={{ animation: 'wx-cloud-drift-slow 36s 12s linear infinite' }}>
          <WxCloud x={305} y={72} w={230} bh={62} color="rgba(255,255,255,0.10)" />
        </g>
      </>}

      {state === 'rainy' && <>
        <WxCloud x={-45} y={-18} w={250} bh={82} color="rgba(100,116,139,0.72)" />
        <g style={{ animation: 'wx-cloud-drift-slow 22s linear infinite' }}>
          <WxCloud x={205} y={-22} w={290} bh={92} color="rgba(71,85,105,0.80)" />
        </g>
        <g style={{ animation: 'wx-cloud-drift 30s linear infinite' }}>
          <WxCloud x={460} y={-12} w={185} bh={72} color="rgba(100,116,139,0.62)" />
        </g>
      </>}

      {state === 'stormy' && <>
        <WxCloud x={-55} y={-28} w={300} bh={105} color="rgba(55,65,81,0.88)" />
        <g style={{ animation: 'wx-cloud-drift-slow 15s linear infinite' }}>
          <WxCloud x={250} y={-32} w={350} bh={112} color="rgba(31,41,55,0.92)" />
        </g>
        <g style={{ animation: 'wx-cloud-drift 24s linear infinite' }}>
          <WxCloud x={545} y={-18} w={185} bh={82} color="rgba(55,65,81,0.78)" />
        </g>
        <g style={{ animation: 'wx-lightning 5s 0.8s ease-in-out infinite' }}>
          <path d="M215 32 L196 68 L209 68 L188 112 L226 65 L211 65 Z" fill="#fef9c3" />
        </g>
        <g style={{ animation: 'wx-lightning 5s 2.8s ease-in-out infinite' }}>
          <path d="M375 22 L354 62 L368 62 L345 108 L388 58 L372 58 Z" fill="#fef9c3" />
        </g>
      </>}

    </svg>
  );
}

function WxRainLayer({ heavy = false }) {
  const count = heavy ? 55 : 32;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${((i * 37 + 11) % 110) - 5}%`,
          top: '-20px',
          width: '1.5px',
          height: `${10 + (i % 4) * 5}px`,
          background: heavy ? 'rgba(147,197,253,0.55)' : 'rgba(186,230,253,0.50)',
          borderRadius: 1,
          transform: 'rotate(8deg)',
          animation: `wx-rain-fall ${0.55 + (i % 5) * 0.12}s ${(i * 0.13) % 1.6}s linear infinite`,
        }} />
      ))}
    </div>
  );
}

function WeatherBanner() {
  const [cityIdx, setCityIdx] = useState(0);

  const { data: cityWeather } = useQuery({
    queryKey: ['wx-tanzania'],
    queryFn: async () => {
      const results = await Promise.all(WX_CITIES.map(async (city) => {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,weather_code&timezone=Africa%2FDar_es_Salaam&forecast_days=1`;
        const res = await fetch(url);
        const d = await res.json();
        return {
          name: city.name,
          temp: Math.round(d.current?.temperature_2m ?? 28),
          code: d.current?.weather_code ?? 0,
        };
      }));
      return results;
    },
    staleTime: 10 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
  });

  useEffect(() => {
    const id = setInterval(() => setCityIdx(i => (i + 1) % WX_CITIES.length), 9000);
    return () => clearInterval(id);
  }, []);

  const live = cityWeather?.[cityIdx];
  const state = live ? wmoToState(live.code) : 'sunny';
  const temp  = live ? `${live.temp}°C` : '—';
  const label = live ? wmoToLabel(live.code) : '…';
  const city  = live?.name ?? WX_CITIES[cityIdx].name;

  return (
    <div style={{
      position: 'relative', height: 155, borderRadius: 16, overflow: 'hidden', marginBottom: 20,
      background: `linear-gradient(160deg, ${WX_GRADIENTS[state]})`,
      transition: 'background 2.5s ease',
    }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <WxScene state={state} key={`${cityIdx}-${state}`} />
      </div>
      {(state === 'rainy' || state === 'stormy') && <WxRainLayer heavy={state === 'stormy'} />}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(to right, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.08) 55%, transparent 85%)',
      }} />
      <div style={{ position: 'absolute', bottom: 18, left: 22, zIndex: 2 }}>
        <div style={{ fontSize: 30, fontWeight: 900, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1, textShadow: '0 2px 14px rgba(0,0,0,0.35)' }}>
          {temp} · {label}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.58)', marginTop: 5, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {city} · Live conditions
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 20, right: 20, display: 'flex', gap: 5, zIndex: 2 }}>
        {WX_CITIES.map((_, i) => (
          <div key={i} style={{
            width: i === cityIdx ? 22 : 5, height: 5, borderRadius: 3,
            background: i === cityIdx ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.22)',
            transition: 'all 0.5s ease',
          }} />
        ))}
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, trend, trendKind = 'neutral', spark, sparkColor, dotColor }) {
  return (
    <div className="card" style={{ padding: '18px 20px', overflow: 'hidden', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        {dotColor && <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />}
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--fg-subtle)' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {value ?? '—'}
        </div>
        {spark && (
          <div style={{ flex: 1, maxWidth: 72 }}>
            <Sparkline data={spark} color={sparkColor} height={36} fill />
          </div>
        )}
      </div>
      {sub && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--fg-muted)' }}>{sub}</div>}
      {trend && (
        <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 500,
          color: trendKind === 'ok' ? 'var(--ok-soft-fg)' : trendKind === 'warn' ? 'var(--warn-soft-fg)' : trendKind === 'danger' ? 'var(--danger-soft-fg)' : 'var(--fg-muted)' }}
          className="row gap-1">
          {trendKind === 'ok' ? <IcoArrowUp size={11} /> : trendKind === 'danger' ? <IcoArrowDown size={11} /> : null}
          {trend}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const wsRef = useRef(null);
  const role = user?.role || 'viewer';
  const [liveMetric, setLiveMetric] = useState('temp');

  const { data: devices, refetch } = useQuery({
    queryKey: ['map-data'],
    queryFn: api.getMapData,
    refetchInterval: 30_000,
  });
  const { data: alertEvents } = useQuery({
    queryKey: ['alert-events', 'open'],
    queryFn: () => api.listAlertEvents({ state: 'open', limit: 10 }),
    refetchInterval: 30_000,
  });
  const { data: fleet } = useQuery({
    queryKey: ['fleet'],
    queryFn: api.getFleet,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?token=${token}`);
    wsRef.current = ws;
    ws.onmessage = () => refetch();
    ws.onerror = () => {};
    return () => ws.close();
  }, [refetch]);

  const devList = devices || [];
  const total   = devList.length;
  const online  = devList.filter(d => d.status === 'online').length;
  const offline = devList.filter(d => d.status === 'offline').length;
  const alerting= devList.filter(d => d.status === 'alert').length;
  const openAlerts = alertEvents?.total ?? 0;
  const critical   = alertEvents?.events?.filter(e => e.severity === 'critical').length ?? 0;
  const events     = alertEvents?.events || [];

  const totalReadings = fleet?.totalReadings ?? 0;
  const hourlyActivity = fleet?.hourlyActivity || [];
  const groupSeries = fleet?.groupSeries || [];

  const METRIC_META = {
    temp:  { sub: 'Temperature · 24h', yLabel: '°C' },
    rain:  { sub: 'Rainfall · 24h',    yLabel: 'mm' },
    humid: { sub: 'Humidity · 24h',    yLabel: '%'  },
  };

  // Fallback demo series when no real data yet — metric-specific ranges
  const FALLBACK_BY_METRIC = useMemo(() => ({
    temp: [
      { name: 'Savanna · 4 stations',  color: 'var(--c1)', data: genSeries(24, 30, 1.8, 4, 7).map((p, i)  => ({ ...p, label: i % 6 === 0 ? `${i}:00` : '' })) },
      { name: 'Highland · 3 stations', color: 'var(--c2)', data: genSeries(24, 16, 1.2, 2, 17).map((p, i) => ({ ...p, label: '' })) },
      { name: 'Forest · 2 stations',   color: 'var(--c3)', data: genSeries(24, 24, 0.9, 1, 19).map((p, i) => ({ ...p, label: '' })) },
      { name: 'Coastal · 2 stations',  color: 'var(--c5)', data: genSeries(24, 29, 0.7, 0, 23).map((p, i) => ({ ...p, label: '' })) },
    ],
    rain: [
      { name: 'Savanna · 4 stations',  color: 'var(--c1)', data: genSeries(24, 2, 3.5, 0, 11).map((p, i)  => ({ t: p.t, v: Math.max(0, +p.v.toFixed(1)), label: i % 6 === 0 ? `${i}:00` : '' })) },
      { name: 'Highland · 3 stations', color: 'var(--c2)', data: genSeries(24, 5, 4.0, 0, 13).map((p, i)  => ({ t: p.t, v: Math.max(0, +p.v.toFixed(1)), label: '' })) },
      { name: 'Forest · 2 stations',   color: 'var(--c3)', data: genSeries(24, 8, 3.2, 0, 29).map((p, i)  => ({ t: p.t, v: Math.max(0, +p.v.toFixed(1)), label: '' })) },
      { name: 'Coastal · 2 stations',  color: 'var(--c5)', data: genSeries(24, 3, 2.8, 0, 31).map((p, i)  => ({ t: p.t, v: Math.max(0, +p.v.toFixed(1)), label: '' })) },
    ],
    humid: [
      { name: 'Savanna · 4 stations',  color: 'var(--c1)', data: genSeries(24, 62, 4,   0, 7).map((p, i)  => ({ t: p.t, v: Math.min(100, Math.max(0, +p.v.toFixed(0))), label: i % 6 === 0 ? `${i}:00` : '' })) },
      { name: 'Highland · 3 stations', color: 'var(--c2)', data: genSeries(24, 78, 3,   0, 17).map((p, i) => ({ t: p.t, v: Math.min(100, Math.max(0, +p.v.toFixed(0))), label: '' })) },
      { name: 'Forest · 2 stations',   color: 'var(--c3)', data: genSeries(24, 85, 2,   0, 19).map((p, i) => ({ t: p.t, v: Math.min(100, Math.max(0, +p.v.toFixed(0))), label: '' })) },
      { name: 'Coastal · 2 stations',  color: 'var(--c5)', data: genSeries(24, 72, 3.5, 0, 23).map((p, i) => ({ t: p.t, v: Math.min(100, Math.max(0, +p.v.toFixed(0))), label: '' })) },
    ],
  }), []);

  const liveSeriesRaw = groupSeries.length > 0 && liveMetric === 'temp' ? groupSeries : FALLBACK_BY_METRIC[liveMetric];
  // Ensure all series have labels on their first series for x-axis
  const liveSeries = liveSeriesRaw.map((s, si) => ({
    ...s,
    data: s.data.map((p, i) => ({
      ...p,
      label: si === 0 && i % 6 === 0 ? (p.label || `${i}:00`) : '',
    })),
  }));

  const fallbackActivity = Array.from({ length: 24 }, (_, i) => ({
    t: i,
    v: 3200 + Math.round(Math.sin(i / 3) * 800 + (i % 7) * 150),
    muted: i < 4,
  }));
  const activityData = hourlyActivity.length > 0 ? hourlyActivity : fallbackActivity;
  const totalCount = totalReadings > 0 ? (totalReadings >= 1000 ? `${(totalReadings / 1000).toFixed(1)}k` : totalReadings) : '—';

  // Site/group health from devices
  const groupHealth = useMemo(() => {
    const map = {};
    devList.forEach(d => {
      const key = d.groupName || d.locationName || 'Other';
      if (!map[key]) map[key] = { name: key, total: 0, online: 0, alert: 0 };
      map[key].total++;
      if (d.status === 'online') map[key].online++;
      if (d.status === 'alert') map[key].alert++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [devList]);

  const greeting = {
    admin:      { title: 'Operations overview' },
    org_admin:  { title: 'Operations overview' },
    super_admin:{ title: 'Platform overview'   },
    manager:    { title: 'Today'               },
    viewer:     { title: 'Environmental insights' },
  }[role] || { title: 'Overview' };

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">{greeting.title}</h1>
          <div className="page__sub">
            <span className="mono subtle">{new Date().toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · live</span>
          </div>
        </div>
        <div className="page__actions">
          <Btn kind="secondary" size="sm" icon={IcoRefresh} onClick={() => refetch()}>Refresh</Btn>
          {(role === 'admin' || role === 'org_admin') && (
            <Btn kind="primary" size="sm" icon={IcoPlus} onClick={() => navigate('/devices')}>Add device</Btn>
          )}
        </div>
      </div>

      {critical > 0 && role !== 'viewer' && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'color-mix(in oklch, var(--danger) 35%, var(--border))', background: 'var(--danger-soft)' }}>
          <div style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-elev)', display: 'grid', placeItems: 'center', color: 'var(--danger)' }}>
              <IcoAlert size={16} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{critical} critical {critical === 1 ? 'alert needs' : 'alerts need'} attention</div>
              <div className="muted text-xs">
                {events.find(e => e.severity === 'critical')?.message || 'Check the alerts page for details'}
              </div>
            </div>
            <Btn kind="primary" size="sm" iconRight={IcoArrowRight} onClick={() => navigate('/alerts')}>Triage</Btn>
          </div>
        </div>
      )}

      <WeatherBanner />

      <div className="grid grid-cols-4" style={{ marginBottom: 16 }}>
        <KpiCard label="Devices online" value={total > 0 ? `${online}` : '—'}
          sub={total > 0 ? `of ${total} total · ${offline} offline` : 'No devices registered'}
          trend={total > 0 ? `${alerting > 0 ? `${alerting} alerting` : 'All healthy'}` : null}
          trendKind={alerting > 0 ? 'warn' : 'ok'}
          spark={activityData.length > 0 ? activityData.map((d, i) => ({ t: i, v: d.v })) : null}
          sparkColor="var(--ok)" dotColor="var(--ok)" />
        <KpiCard label="Open alerts" value={openAlerts}
          sub={`${critical} critical · ${(alertEvents?.events || []).filter(e => e.severity === 'warning').length} warning`}
          trend={openAlerts === 0 ? 'All clear' : `${openAlerts} need attention`}
          trendKind={openAlerts === 0 ? 'ok' : critical > 0 ? 'danger' : 'warn'}
          spark={activityData.map((d, i) => ({ t: i, v: d.v }))} sparkColor="var(--danger)"
          dotColor={openAlerts > 0 ? 'var(--danger)' : 'var(--ok)'} />
        <KpiCard label="Data points · 24h" value={totalCount}
          sub={fleet?.deviceCount ? `from ${fleet.deviceCount} devices` : 'across all sensors'}
          trend={totalReadings > 0 ? `${fleet?.deviceCount ?? 0} active devices` : 'No data yet'}
          trendKind={totalReadings > 0 ? 'ok' : 'neutral'}
          spark={activityData.map((d, i) => ({ t: i, v: d.v }))} sparkColor="var(--accent)"
          dotColor="var(--accent)" />
        <KpiCard label="Online rate"
          value={total > 0 ? `${Math.round((online / total) * 100)}%` : '—'}
          sub={total > 0 ? `${online} of ${total} devices` : 'No devices yet'}
          trend={total > 0 ? (online === total ? 'All online' : `${total - online} offline`) : null}
          trendKind={online === total && total > 0 ? 'ok' : online / total >= 0.8 ? 'warn' : 'danger'}
          spark={activityData.length > 0 ? activityData.map((d, i) => ({ t: i, v: d.v })) : null}
          sparkColor="var(--ok)" dotColor={online === total && total > 0 ? 'var(--ok)' : 'var(--warn)'} />
      </div>

      <div className="grid grid-2-1" style={{ alignItems: 'stretch' }}>
        {/* Live observations */}
        <Card title="Live observations" sub={METRIC_META[liveMetric].sub}
          actions={<>
            <Seg value={liveMetric} onChange={setLiveMetric} options={[
              { value: 'temp',  label: 'Temp' },
              { value: 'rain',  label: 'Rain' },
              { value: 'humid', label: 'Humid' },
            ]} />
            <Btn kind="ghost" size="sm" icon={IcoExternal} onClick={() => navigate('/data')} title="Open Data Explorer" />
          </>}>
          <LineChart series={liveSeries} yLabel={METRIC_META[liveMetric].yLabel} height={260} area />
        </Card>

        {/* Needs attention */}
        <Card title="Needs attention" sub="Open and unacknowledged"
          actions={<Btn kind="ghost" size="sm" onClick={() => navigate('/alerts')}>View all<IcoArrowRight size={12} /></Btn>}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {events.length === 0 ? (
              <Empty icon={null} title="All clear" hint="No open alerts. We'll let you know when something changes." />
            ) : events.slice(0, 5).map(e => (
              <div key={e._id} style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                <StatusDot status={e.severity} pulse={e.severity === 'critical'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.message}</div>
                  <div className="text-xs muted row gap-1" style={{ marginTop: 1 }}>
                    <span className="mono">{e.deviceId?.toString().slice(-6)}</span>
                    <span>·</span>
                    <span>{e.createdAt ? new Date(e.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  </div>
                </div>
                {role !== 'viewer' && <Btn kind="ghost" size="sm" onClick={() => navigate('/alerts')}>Triage</Btn>}
              </div>
            ))}
          </div>
        </Card>

        {/* Network activity */}
        <Card title="Network activity" sub="Hourly readings ingested · last 24h">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, padding: '4px 0 8px' }}>
            <div>
              <div style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{totalCount}</div>
              <div className="text-xs muted" style={{ marginTop: 4 }}>readings · 24h</div>
            </div>
            <div style={{ flex: 1, paddingTop: 8 }}>
              <BarMini data={activityData} color="var(--accent)" height={56} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--fg-subtle)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>now</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Site health */}
        <Card title="Site health" sub="Devices grouped by station"
          actions={<Btn kind="ghost" size="sm" icon={IcoLayoutGrid} onClick={() => navigate('/devices')}>By group</Btn>}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {groupHealth.length === 0 ? (
              <div className="muted text-xs" style={{ padding: '16px 0', textAlign: 'center' }}>No devices yet</div>
            ) : groupHealth.slice(0, 5).map(g => {
              const allOnline = g.online === g.total && g.alert === 0;
              const hasAlert  = g.alert > 0;
              const dotColor  = hasAlert ? 'var(--danger)' : allOnline ? 'var(--ok)' : 'var(--warn)';
              return (
                <div key={g.name} style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500 }}>{g.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--fg-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {g.online}/{g.total}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
