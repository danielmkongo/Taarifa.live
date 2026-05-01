import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuthStore } from '../store/auth.js';
import { Btn, Badge, StatusDot, Seg, Card, Sparkline, LineChart, BarMini, Empty } from '../components/ui/index.jsx';
import {
  IcoRefresh, IcoPlus, IcoArrowRight, IcoArrowUp, IcoArrowDown,
  IcoAlert, IcoPin, IcoExternal,
} from '../components/ui/Icons.jsx';

function rng(seed) {
  let s = seed | 0; if (s === 0) s = 1;
  return () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 0) / 4294967296); };
}
function genSeries(n, base, noise, drift = 0, seed = 1) {
  const r = rng(seed);
  const out = [];
  let v = base;
  for (let i = 0; i < n; i++) {
    v += (r() - 0.5) * noise + drift / n;
    out.push({ t: i, v: +v.toFixed(2) });
  }
  return out;
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
        <div style={{ marginTop: 8, fontSize: 11.5, color: trendKind === 'ok' ? 'var(--ok-soft-fg)' : 'var(--danger-soft-fg)' }}
          className="row gap-1">
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
  const total = devList.length;
  const online = devList.filter(d => d.status === 'online').length;
  const alerting = devList.filter(d => d.status === 'alert').length;
  const offline = devList.filter(d => d.status === 'offline').length;
  const openAlerts = alertEvents?.total ?? 0;
  const critical = alertEvents?.events?.filter(e => e.severity === 'critical').length ?? 0;
  const events = alertEvents?.events || [];

  const ingestSeries = Array.from({ length: 24 }, (_, i) => ({ t: i, v: 8400 + Math.round(Math.sin(i / 3) * 1200 + (i % 7) * 220) }));
  const tempSeries = genSeries(48, 28, 1.4, 4, 7).map((p, i) => ({ ...p, label: i % 8 === 0 ? `${(i / 2) | 0}:00` : '' }));

  const greeting = {
    admin:     { title: 'Operations overview',    sub: 'Health, alerts and uptime across your fleet.' },
    org_admin: { title: 'Operations overview',    sub: 'Health, alerts and uptime across your fleet.' },
    super_admin:{ title: 'Platform overview',     sub: 'Health, alerts and uptime across all organisations.' },
    manager:   { title: 'Today',                  sub: 'What needs your attention right now.' },
    viewer:    { title: 'Environmental insights', sub: 'A snapshot of what your network is observing.' },
  }[role] || { title: 'Overview', sub: 'Environmental monitoring platform.' };

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">{greeting.title}</h1>
          <div className="page__sub">{greeting.sub}
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

      {critical > 0 && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'color-mix(in oklch, var(--danger) 35%, var(--border))', background: 'var(--danger-soft)' }}>
          <div style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-elev)', display: 'grid', placeItems: 'center', color: 'var(--danger)' }}>
              <IcoAlert size={16} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{critical} critical {critical === 1 ? 'alert needs' : 'alerts need'} attention</div>
              <div className="muted text-xs">{events[0]?.message || 'Check the alerts page for details'}</div>
            </div>
            <Btn kind="primary" size="sm" iconRight={IcoArrowRight} onClick={() => navigate('/alerts')}>Triage</Btn>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4" style={{ marginBottom: 16 }}>
        <KpiCard label="Devices online" value={`${online}`} sub={`of ${total} · ${offline} offline`}
          trend={total > 0 ? `${Math.round((online/total)*100)}% online` : null} trendKind="ok"
          spark={genSeries(20, online || 5, 0.5, 1, 41)} sparkColor="var(--ok)" />
        <KpiCard label="Open alerts" value={openAlerts} sub={`${critical} critical`}
          trend={openAlerts === 0 ? 'All clear' : `${openAlerts} need attention`}
          trendKind={openAlerts > 0 ? 'warn' : 'ok'}
          spark={genSeries(20, Math.max(openAlerts, 1), 1.5, 0, 42)} sparkColor="var(--danger)" />
        <KpiCard label="Alerting devices" value={alerting} sub={`${total - alerting - offline} healthy`}
          spark={genSeries(20, alerting || 0, 0.3, 0, 43)} sparkColor="var(--warn)" />
        <KpiCard label="Data points · 24h" value="—" sub="across all sensors"
          spark={ingestSeries.map((d,i)=>({t:i,v:d.v}))} sparkColor="var(--accent)" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr', alignItems: 'stretch' }}>
        <Card title="Live observations" sub="Temperature trend · 24h"
          actions={
            <Btn kind="ghost" size="sm" icon={IcoExternal} onClick={() => navigate('/data')} title="Open Data Explorer" />
          }>
          <LineChart series={[
            { name: 'Average temperature · all devices', data: tempSeries, color: 'var(--c1)' },
          ]} yLabel="°C" height={240} area />
        </Card>

        <Card title="Needs attention" sub="Open alerts"
          actions={<Btn kind="ghost" size="sm" iconRight={IcoArrowRight} onClick={() => navigate('/alerts')}>View all</Btn>}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {events.length === 0 ? (
              <Empty icon={null} title="All clear" hint="No open alerts." />
            ) : events.slice(0, 5).map(e => (
              <div key={e._id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' }}>
                <div style={{ marginTop: 4 }}>
                  <StatusDot status={e.severity} pulse={e.severity === 'critical'} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{e.message}</div>
                  <div className="text-xs muted" style={{ marginTop: 2 }}>
                    Value: <span className="mono">{e.triggerValue}</span>
                  </div>
                </div>
                <Badge kind={e.severity === 'critical' ? 'danger' : e.severity === 'warning' ? 'warn' : 'info'}>
                  {e.severity}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Network activity" sub="Hourly readings · last 24h">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, padding: '4px 0 8px' }}>
            <div>
              <div className="text-2xl font-semibold tabnum">—</div>
              <div className="text-xs muted">readings · 24h</div>
            </div>
            <div style={{ flex: 1, paddingTop: 8 }}>
              <BarMini data={ingestSeries.map((d, i) => ({ ...d, muted: i < 6 }))} color="var(--accent)" height={56} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--fg-subtle)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>now</span>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Device status" sub="Fleet overview"
          actions={<Btn kind="ghost" size="sm" iconRight={IcoArrowRight} onClick={() => navigate('/devices')}>All devices</Btn>}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {devList.slice(0, 6).map(d => (
              <div key={d._id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                <StatusDot status={d.status} pulse={d.status === 'alert'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                  <div className="text-xs muted">{d.locationName || 'No location'}</div>
                </div>
                <Badge kind={d.status === 'online' ? 'ok' : d.status === 'alert' ? 'danger' : d.status === 'maintenance' ? 'warn' : 'neutral'}>
                  {d.status}
                </Badge>
              </div>
            ))}
            {devList.length === 0 && (
              <div className="muted text-xs" style={{ padding: '16px 0', textAlign: 'center' }}>No devices yet</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
