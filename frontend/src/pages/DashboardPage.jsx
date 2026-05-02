import { useEffect, useRef, useMemo } from 'react';
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

function KpiCard({ label, value, sub, trend, trendKind = 'ok', spark, sparkColor }) {
  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div className="text-xs muted">{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4, gap: 8 }}>
        <div>
          <div className="text-2xl font-semibold tabnum tracking-tight">{value ?? '—'}</div>
          <div className="text-xs subtle" style={{ marginTop: 2 }}>{sub}</div>
        </div>
        {spark && (
          <div style={{ flex: 1, maxWidth: 100, marginLeft: 12 }}>
            <Sparkline data={spark} color={sparkColor} height={36} fill />
          </div>
        )}
      </div>
      {trend && (
        <div style={{ marginTop: 8, fontSize: 11.5, color: trendKind === 'ok' ? 'var(--ok-soft-fg)' : 'var(--danger-soft-fg)' }} className="row gap-1">
          {trendKind === 'ok' ? <IcoArrowUp size={11} /> : <IcoArrowDown size={11} />}
          <span>{trend}</span>
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

  // Fallback demo series when no real data yet
  const FALLBACK_SERIES = useMemo(() => [
    { name: 'Savanna · 4 stations',  color: 'var(--c1)', data: genSeries(24, 30, 1.8, 4, 7).map((p, i) => ({ ...p, label: i % 6 === 0 ? `${i}:00` : '' })) },
    { name: 'Highland · 3 stations', color: 'var(--c2)', data: genSeries(24, 16, 1.2, 2, 17).map((p, i) => ({ ...p, label: '' })) },
    { name: 'Forest · 2 stations',   color: 'var(--c3)', data: genSeries(24, 24, 0.9, 1, 19).map((p, i) => ({ ...p, label: '' })) },
    { name: 'Coastal · 2 stations',  color: 'var(--c5)', data: genSeries(24, 29, 0.7, 0, 23).map((p, i) => ({ ...p, label: '' })) },
  ], []);

  const liveSeriesRaw = groupSeries.length > 0 ? groupSeries : FALLBACK_SERIES;
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
    admin:      { title: 'Operations overview',    sub: 'Health, alerts and uptime across the entire fleet.' },
    org_admin:  { title: 'Operations overview',    sub: 'Health, alerts and uptime across the entire fleet.' },
    super_admin:{ title: 'Platform overview',      sub: 'Health, alerts and uptime across all organisations.' },
    manager:    { title: 'Today',                  sub: 'What needs your attention right now.' },
    viewer:     { title: 'Environmental insights', sub: 'A snapshot of what your network is observing.' },
  }[role] || { title: 'Overview', sub: '' };

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">{greeting.title}</h1>
          <div className="page__sub">
            {greeting.sub}
            <span className="mono subtle"> · live · {new Date().toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
        <div className="page__actions">
          <Seg value="24h" onChange={() => {}} options={['1h','24h','7d','30d']} />
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

      <div className="grid grid-cols-4" style={{ marginBottom: 16 }}>
        <KpiCard label="Devices online" value={`${online}`} sub={`of ${total} · ${offline} offline`}
          trend="+2 this week" trendKind="ok"
          spark={genSeries(20, Math.max(online, 1), 0.5, 1, 41)} sparkColor="var(--ok)" />
        <KpiCard label="Open alerts" value={openAlerts}
          sub={`${critical} critical · ${(alertEvents?.events || []).filter(e => e.severity === 'warning').length} warning`}
          trend={openAlerts === 0 ? 'All clear' : `−3 vs yesterday`}
          trendKind={openAlerts === 0 ? 'ok' : 'warn'}
          spark={genSeries(20, Math.max(openAlerts, 2), 1.5, -2, 42)} sparkColor="var(--danger)" />
        <KpiCard label="Data points · 24h" value={totalCount} sub="across all sensors"
          trend="+4.1%" trendKind="ok"
          spark={activityData.map((d, i) => ({ t: i, v: d.v }))} sparkColor="var(--accent)" />
        <KpiCard label="Avg uptime · 30d" value="99.21%" sub="SLA target 99.0%"
          trend="On track" trendKind="ok"
          spark={genSeries(20, 99, 0.3, 0.2, 44)} sparkColor="var(--ok)" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr', alignItems: 'stretch' }}>
        {/* Live observations */}
        <Card title="Live observations" sub="Average temperature across active stations · 24h"
          actions={<>
            <Seg value="temp" onChange={() => {}} options={[
              { value: 'temp',  label: 'Temperature' },
              { value: 'rain',  label: 'Rainfall' },
              { value: 'humid', label: 'Humidity' },
            ]} />
            <Btn kind="ghost" size="sm" icon={IcoExternal} onClick={() => navigate('/data')} title="Open Data Explorer" />
          </>}>
          <LineChart series={liveSeries} yLabel="°C" height={260} area />
        </Card>

        {/* Needs attention */}
        <Card title="Needs attention" sub="Open and unacknowledged"
          actions={<Btn kind="ghost" size="sm" onClick={() => navigate('/alerts')}>View all<IcoArrowRight size={12} /></Btn>}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {events.length === 0 ? (
              <Empty icon={null} title="All clear" hint="No open alerts. We'll let you know when something changes." />
            ) : events.slice(0, 5).map(e => (
              <div key={e._id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' }}>
                <div style={{ marginTop: 4 }}><StatusDot status={e.severity} pulse={e.severity === 'critical'} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{e.message}</div>
                  <div className="text-xs muted" style={{ marginTop: 2 }}>
                    <span className="mono">{e.deviceId?.toString().slice(-6)}</span> · {e.triggerValue != null ? `Value: ${e.triggerValue}` : ''}
                  </div>
                  <div className="text-xs subtle" style={{ marginTop: 2 }}>
                    {e.createdAt ? new Date(e.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}{e.ruleId ? ` · rule "${e.ruleName || e.ruleId}"` : ''}
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
              <div className="text-2xl font-semibold tabnum">{totalCount}</div>
              <div className="text-xs muted">readings · 24h</div>
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
        <Card title="Site health" sub="Devices grouped by station type"
          actions={<Btn kind="ghost" size="sm" icon={IcoLayoutGrid} onClick={() => navigate('/devices')}>By group</Btn>}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {groupHealth.length === 0 ? (
              <div className="muted text-xs" style={{ padding: '16px 0', textAlign: 'center' }}>No devices yet</div>
            ) : groupHealth.slice(0, 5).map(g => (
              <div key={g.name} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg-subtle)', display: 'grid', placeItems: 'center', color: 'var(--fg-muted)', flexShrink: 0 }}>
                  <IcoPin size={13} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{g.name}</div>
                  <div className="text-xs muted">{g.total} {g.total === 1 ? 'device' : 'devices'}</div>
                </div>
                <div className="row gap-2">
                  {g.alert > 0 && <Badge kind="danger" dot="danger">{g.alert}</Badge>}
                  <Badge kind="ok" dot="ok">{g.online}/{g.total}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
