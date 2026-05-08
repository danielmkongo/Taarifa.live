import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { api } from '../services/api.js';
import { Btn, Card, Empty, Spinner, Seg } from '../components/ui/index.jsx';
import {
  IcoSearch, IcoX, IcoShield, IcoBroadcast, IcoBuilding,
  IcoCpu, IcoSend, IcoGlobe, IcoMonitor, IcoAlert, IcoBell,
  IcoCheck, IcoActivity, IcoRefresh,
} from '../components/ui/Icons.jsx';

// ── Micro helpers ──────────────────────────────────────────────────────────────

function ApiError({ error, onRetry }) {
  const msg = error?.message || String(error);
  const is404 = msg.includes('404');
  const is403 = msg.includes('403') || msg.includes('Forbidden') || msg.includes('permission');
  return (
    <div style={{ padding: '20px 24px', borderRadius: 10, background: 'var(--danger-soft)', border: '1px solid color-mix(in oklch, var(--danger) 25%, var(--border))', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontWeight: 700, color: 'var(--danger)', fontSize: 14 }}>
        {is404 ? 'API routes not found (404)' : is403 ? 'Access denied (403)' : `Request failed — ${msg}`}
      </div>
      <div style={{ fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.6 }}>
        {is404 && 'The backend admin routes are not registered. The backend server needs to be restarted to load the new /admin routes.'}
        {is403 && 'Your account does not have the super_admin role, or the role check is failing.'}
        {!is404 && !is403 && 'Check the browser Network tab and backend logs for details.'}
      </div>
      {onRetry && (
        <button onClick={onRetry} style={{ alignSelf: 'flex-start', marginTop: 4, padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>
          Retry
        </button>
      )}
    </div>
  );
}

function SearchBox({ value, onChange, placeholder, style }) {
  return (
    <div className="search" style={{ flex: 1, minWidth: 200, ...style }}>
      <IcoSearch size={13} />
      <input placeholder={placeholder || 'Search…'} value={value} onChange={e => onChange(e.target.value)} />
      {value && (
        <button onMouseDown={e => { e.preventDefault(); onChange(''); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)', display: 'flex', padding: 0 }}>
          <IcoX size={12} />
        </button>
      )}
    </div>
  );
}

function StatusDot({ status, size = 7 }) {
  const color = status === 'online' ? 'var(--ok)' : status === 'alert' ? 'var(--danger)' : 'var(--fg-subtle)';
  return <span style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />;
}

function SeverityBadge({ severity }) {
  const cfg = {
    critical: { bg: 'var(--danger-soft)', fg: 'var(--danger-soft-fg)' },
    warning:  { bg: 'var(--warn-soft)',   fg: 'var(--warn-soft-fg)'   },
    info:     { bg: 'var(--accent-soft)', fg: 'var(--accent)'         },
  }[severity] || { bg: 'var(--bg-subtle)', fg: 'var(--fg-muted)' };
  return (
    <span style={{ padding: '2px 7px', borderRadius: 5, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', background: cfg.bg, color: cfg.fg }}>
      {severity}
    </span>
  );
}

// ── Platform health strip ──────────────────────────────────────────────────────

function HealthStrip({ stats, alertCount }) {
  if (!stats) return null;
  const onlinePct = stats.totalDevices > 0 ? Math.round((stats.onlineDevices / stats.totalDevices) * 100) : 0;
  const healthColor = stats.alertDevices > 0 ? 'var(--danger)' : onlinePct >= 90 ? 'var(--ok)' : onlinePct >= 70 ? 'var(--warn)' : 'var(--fg-subtle)';

  const tiles = [
    { label: 'Organizations',  value: stats.totalOrgs,       icon: IcoBuilding,  color: 'var(--accent)' },
    { label: 'Total devices',  value: stats.totalDevices,    icon: IcoCpu,       color: 'var(--fg-muted)' },
    { label: 'Online',         value: `${stats.onlineDevices} · ${onlinePct}%`, icon: IcoActivity, color: healthColor },
    { label: 'Open alerts',    value: alertCount,            icon: IcoBell,      color: alertCount > 0 ? 'var(--danger)' : 'var(--ok)' },
    { label: 'Screens',        value: stats.totalScreens,    icon: IcoMonitor,   color: 'var(--fg-muted)' },
    { label: 'Live broadcasts',value: stats.activeBroadcasts,icon: IcoBroadcast, color: stats.activeBroadcasts > 0 ? 'var(--warn)' : 'var(--fg-muted)' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: 24 }}>
      {tiles.map(t => (
        <div key={t.label} style={{
          padding: '14px 16px', background: 'var(--bg-elev)',
          border: '1px solid var(--border)', borderRadius: 10,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
            background: `color-mix(in oklch, ${t.color} 12%, transparent)`,
            display: 'grid', placeItems: 'center',
          }}>
            <t.icon size={15} style={{ color: t.color }} />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--fg)', lineHeight: 1 }}>{t.value ?? '—'}</div>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 3 }}>{t.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Organizations tab ──────────────────────────────────────────────────────────

function OrgCard({ org }) {
  const total   = org.stats?.devices       ?? 0;
  const online  = org.stats?.devicesOnline  ?? 0;
  const alerts  = org.stats?.devicesAlert   ?? 0;
  const pct     = total > 0 ? Math.round((online / total) * 100) : 0;
  const health  = alerts > 0 ? 'danger' : pct >= 90 ? 'ok' : pct >= 60 ? 'warn' : 'subtle';
  const borderColor = { ok: 'var(--ok)', warn: 'var(--warn)', danger: 'var(--danger)', subtle: 'var(--border)' }[health];

  const planColors = {
    enterprise: { bg: 'color-mix(in oklch, var(--accent) 14%, transparent)', fg: 'var(--accent)' },
    pro:        { bg: 'color-mix(in oklch, var(--ok)     14%, transparent)', fg: 'var(--ok)' },
    free:       { bg: 'var(--bg-subtle)', fg: 'var(--fg-muted)' },
  };
  const plan = planColors[org.plan] || planColors.free;

  return (
    <div style={{
      background: 'var(--bg-elev)', borderRadius: 12,
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${borderColor}`,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{org.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--fg-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{org.slug}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
            {alerts > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 5, background: 'var(--danger-soft)', color: 'var(--danger-soft-fg)', fontSize: 11, fontWeight: 700 }}>
                <IcoAlert size={10} /> {alerts}
              </span>
            )}
            {org.plan && (
              <span style={{ padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: plan.bg, color: plan.fg }}>
                {org.plan}
              </span>
            )}
          </div>
        </div>

        {/* Online ratio bar */}
        {total > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--fg-muted)', marginBottom: 5 }}>
              <span>{online} of {total} online</span>
              <span style={{ fontWeight: 600, color: borderColor }}>{pct}%</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: borderColor, transition: 'width 0.4s' }} />
            </div>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', borderBottom: '1px solid var(--border)' }}>
        {[
          { label: 'Devices', value: total },
          { label: 'Online',  value: online,              color: online > 0  ? 'var(--ok)' : undefined },
          { label: 'Alert',   value: alerts,              color: alerts > 0  ? 'var(--danger)' : undefined },
          { label: 'Users',   value: org.stats?.users    ?? 0 },
          { label: 'Screens', value: org.stats?.screens  ?? 0 },
        ].map((s, i) => (
          <div key={s.label} style={{ padding: '10px 0', textAlign: 'center', borderRight: i < 4 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: s.color || 'var(--fg)', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: 'var(--fg-muted)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: '9px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11.5, color: 'var(--fg-muted)' }}>
          Joined {org.createdAt ? format(new Date(org.createdAt), 'MMM d, yyyy') : '—'}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5 }}>
          <StatusDot status={org.stats?.devicesOnline > 0 ? 'online' : 'offline'} size={6} />
          <span style={{ color: 'var(--fg-muted)' }}>{org.stats?.screensOnline ?? 0} screens live</span>
        </span>
      </div>
    </div>
  );
}

function OrgsTab() {
  const [search, setSearch] = useState('');
  const [sort, setSort]     = useState('alerts');
  const { data: orgs = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-orgs'],
    queryFn: api.adminListOrgs,
    staleTime: 30_000,
    retry: 1,
  });

  const filtered = orgs
    .filter(o => !search || [o.name, o.slug].some(v => v?.toLowerCase().includes(search.toLowerCase())))
    .slice()
    .sort((a, b) => {
      if (sort === 'alerts')  return (b.stats?.devicesAlert ?? 0) - (a.stats?.devicesAlert ?? 0);
      if (sort === 'devices') return (b.stats?.devices ?? 0) - (a.stats?.devices ?? 0);
      if (sort === 'name')    return a.name.localeCompare(b.name);
      return 0;
    });

  return (
    <>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchBox value={search} onChange={setSearch} placeholder="Search organizations…" />
        <Seg value={sort} onChange={setSort} options={[
          { value: 'alerts',  label: 'By alerts'  },
          { value: 'devices', label: 'By devices' },
          { value: 'name',    label: 'A–Z'        },
        ]} />
        <button onClick={() => refetch()} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', color: 'var(--fg-muted)', display: 'flex' }}>
          <IcoRefresh size={13} style={{ ...(isFetching ? { animation: 'spin 1s linear infinite' } : {}) }} />
        </button>
      </div>

      {isLoading ? (
        <div style={{ height: 300, display: 'grid', placeItems: 'center' }}><Spinner /></div>
      ) : isError ? (
        <ApiError error={error} onRetry={refetch} />
      ) : filtered.length === 0 ? (
        <Empty icon={null} title="No organizations" hint="None match your search." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
          {filtered.map(org => <OrgCard key={org._id} org={org} />)}
        </div>
      )}
    </>
  );
}

// ── Fleet tab ──────────────────────────────────────────────────────────────────

function FleetTab() {
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState('all');
  const [view, setView]             = useState('iot');

  const { data: iotDevices = [], isLoading: loadingIot, isError: iotError, error: iotErr, refetch: refetchIot } = useQuery({
    queryKey: ['admin-fleet'], queryFn: () => api.adminFleet({ limit: 500 }), staleTime: 30_000, retry: 1,
  });
  const { data: screens = [], isLoading: loadingScreens, isError: scrError, error: scrErr, refetch: refetchScr } = useQuery({
    queryKey: ['admin-screens'], queryFn: api.adminScreens, staleTime: 30_000, retry: 1,
  });

  const devices   = view === 'iot' ? iotDevices : screens;
  const isLoading = view === 'iot' ? loadingIot : loadingScreens;

  const filtered = devices.filter(d => {
    const q = search.toLowerCase();
    const ms = !q || [d.name, d.serialNumber, d.locationName, d.address, d.orgName, d.location].some(v => v?.toLowerCase().includes(q));
    const mv = statusFilter === 'all' || d.status === statusFilter;
    return ms && mv;
  });

  const counts = {
    online:  devices.filter(d => d.status === 'online').length,
    offline: devices.filter(d => d.status === 'offline').length,
    alert:   devices.filter(d => d.status === 'alert').length,
  };
  const pct = devices.length > 0 ? Math.round((counts.online / devices.length) * 100) : 0;

  return (
    <>
      {/* Status summary bar */}
      {devices.length > 0 && (
        <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
            <span style={{ color: 'var(--fg-muted)' }}>Fleet health · {devices.length} {view === 'iot' ? 'sensors' : 'screens'}</span>
            <span style={{ fontWeight: 700, color: pct >= 90 ? 'var(--ok)' : pct >= 70 ? 'var(--warn)' : 'var(--danger)' }}>{pct}% online</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, overflow: 'hidden', display: 'flex', gap: 1 }}>
            <div style={{ flex: counts.online,  background: 'var(--ok)',      borderRadius: 3, minWidth: counts.online  > 0 ? 2 : 0 }} />
            <div style={{ flex: counts.alert,   background: 'var(--danger)',  borderRadius: 3, minWidth: counts.alert   > 0 ? 2 : 0 }} />
            <div style={{ flex: counts.offline, background: 'var(--border)',  borderRadius: 3, minWidth: counts.offline > 0 ? 2 : 0 }} />
          </div>
          <div style={{ display: 'flex', gap: 18, marginTop: 8, fontSize: 11.5, color: 'var(--fg-muted)' }}>
            <span><span style={{ color: 'var(--ok)',     fontWeight: 700 }}>{counts.online}</span>  online</span>
            {view === 'iot' && <span><span style={{ color: 'var(--danger)', fontWeight: 700 }}>{counts.alert}</span>  alert</span>}
            <span><span style={{ fontWeight: 700 }}>{counts.offline}</span>  offline</span>
          </div>
        </div>
      )}

      <Card title={view === 'iot' ? 'IoT sensor fleet' : 'Screen fleet'}
        sub={`${filtered.length} shown · all organizations`}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <SearchBox value={search} onChange={setSearch} placeholder="Search name, org, location, serial…" />
          <Seg value={view} onChange={v => { setView(v); setSearch(''); setStatus('all'); }} options={[
            { value: 'iot',     label: 'IoT Sensors' },
            { value: 'screens', label: 'Screens'     },
          ]} />
          <Seg value={statusFilter} onChange={setStatus} options={[
            { value: 'all',    label: 'All'     },
            { value: 'online', label: 'Online'  },
            { value: 'offline',label: 'Offline' },
            ...(view === 'iot' ? [{ value: 'alert', label: 'Alert' }] : []),
          ]} />
        </div>

        {isLoading ? (
          <div style={{ height: 200, display: 'grid', placeItems: 'center' }}><Spinner /></div>
        ) : (iotError || scrError) ? (
          <ApiError error={iotErr || scrErr} onRetry={view === 'iot' ? refetchIot : refetchScr} />
        ) : filtered.length === 0 ? (
          <Empty icon={null} title="No results" hint="No devices match the current filters." />
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: 520, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-elev)', zIndex: 1 }}>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['', 'Device', 'Organization', view === 'iot' ? 'Serial / Location' : 'Location', 'Last seen'].map((h, i) => (
                    <th key={i} style={{ textAlign: i > 2 ? 'right' : 'left', padding: '8px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((d, i) => {
                  const isAlert = d.status === 'alert';
                  return (
                    <tr key={d._id} style={{ borderBottom: '1px solid var(--border)', background: isAlert ? 'color-mix(in oklch, var(--danger) 4%, transparent)' : i % 2 === 1 ? 'var(--bg-subtle)' : 'transparent' }}>
                      <td style={{ padding: '9px 12px', width: 28 }}>
                        <StatusDot status={d.status} size={8} />
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{d.name}</div>
                        {isAlert && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 1 }}>● Alert</div>}
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ fontSize: 12, background: 'var(--bg-subtle)', padding: '2px 7px', borderRadius: 5, color: 'var(--fg-muted)', border: '1px solid var(--border)' }}>
                          {d.orgName || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)' }}>
                        {view === 'iot' ? (d.serialNumber || d.locationName || '—') : (d.locationName || d.location || '—')}
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: 12, color: 'var(--fg-muted)', whiteSpace: 'nowrap' }}>
                        {(d.lastSeen || d.lastSeenAt)
                          ? formatDistanceToNow(new Date(d.lastSeen || d.lastSeenAt), { addSuffix: true })
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

// ── Alerts tab ────────────────────────────────────────────────────────────────

function AlertsTab() {
  const [stateFilter, setStateFilter] = useState('open');
  const { data: events = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-alerts', stateFilter],
    queryFn:  () => api.adminAlerts({ state: stateFilter, limit: 100 }),
    staleTime: 20_000,
    refetchInterval: 30_000,
  });

  const critical = events.filter(e => e.severity === 'critical').length;
  const byOrg    = events.reduce((acc, e) => { acc[e.orgName] = (acc[e.orgName] || 0) + 1; return acc; }, {});
  const topOrgs  = Object.entries(byOrg).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <>
      {stateFilter === 'open' && events.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 16 }}>
          <div style={{ padding: '14px 18px', background: critical > 0 ? 'var(--danger-soft)' : 'var(--bg-elev)', border: `1px solid ${critical > 0 ? 'color-mix(in oklch, var(--danger) 25%, var(--border))' : 'var(--border)'}`, borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: critical > 0 ? 'var(--danger-soft-fg)' : 'var(--fg-muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Critical</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: critical > 0 ? 'var(--danger)' : 'var(--fg)', lineHeight: 1 }}>{critical}</div>
          </div>
          <div style={{ padding: '14px 18px', background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total open</div>
            <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{events.length}</div>
          </div>
          {topOrgs.length > 0 && (
            <div style={{ padding: '14px 18px', background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 10, gridColumn: topOrgs.length > 0 ? 'span 2' : undefined }}>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Most affected</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {topOrgs.map(([name, count]) => (
                  <span key={name} style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, background: 'var(--bg-subtle)', border: '1px solid var(--border)', fontWeight: 500 }}>
                    {name} <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Card title="Cross-org alerts" sub={`${events.length} ${stateFilter} alerts · platform-wide`}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
          <Seg value={stateFilter} onChange={setStateFilter} options={[
            { value: 'open',         label: 'Open'         },
            { value: 'acknowledged', label: 'Acknowledged' },
            { value: 'resolved',     label: 'Resolved'     },
          ]} />
          <button onClick={() => refetch()} style={{ marginLeft: 'auto', background: 'none', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', color: 'var(--fg-muted)', display: 'flex' }}>
            <IcoRefresh size={13} style={isFetching ? { animation: 'spin 1s linear infinite' } : {}} />
          </button>
        </div>

        {isLoading ? (
          <div style={{ height: 200, display: 'grid', placeItems: 'center' }}><Spinner /></div>
        ) : events.length === 0 ? (
          <Empty icon={null} title={stateFilter === 'open' ? 'No open alerts' : `No ${stateFilter} alerts`}
            hint={stateFilter === 'open' ? 'All organizations are running clean.' : undefined} />
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: 520, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-elev)', zIndex: 1 }}>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Severity', 'Rule', 'Device', 'Organization', 'Triggered'].map((h, i) => (
                    <th key={h} style={{ textAlign: i > 2 ? 'right' : 'left', padding: '8px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map((e, i) => (
                  <tr key={e._id} style={{ borderBottom: '1px solid var(--border)', background: e.severity === 'critical' ? 'color-mix(in oklch, var(--danger) 4%, transparent)' : i % 2 === 1 ? 'var(--bg-subtle)' : 'transparent' }}>
                    <td style={{ padding: '9px 12px' }}><SeverityBadge severity={e.severity} /></td>
                    <td style={{ padding: '9px 12px', fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.ruleName || '—'}</td>
                    <td style={{ padding: '9px 12px', color: 'var(--fg-muted)' }}>{e.deviceName || '—'}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                      <span style={{ fontSize: 12, background: 'var(--bg-subtle)', padding: '2px 7px', borderRadius: 5, color: 'var(--fg-muted)', border: '1px solid var(--border)' }}>{e.orgName || '—'}</span>
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: 12, color: 'var(--fg-muted)', whiteSpace: 'nowrap' }}>
                      {e.triggeredAt ? formatDistanceToNow(new Date(e.triggeredAt), { addSuffix: true }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

// ── Broadcast tab ─────────────────────────────────────────────────────────────

function BroadcastTab() {
  const qc = useQueryClient();
  const [title, setTitle]   = useState('');
  const [type, setType]     = useState('image');
  const [mediaUrl, setUrl]  = useState('');
  const [body, setBody]     = useState('');
  const [priority, setPri]  = useState('normal');
  const [durationS, setDur] = useState('30');
  const [schedEnd, setEnd]  = useState('');
  const [error, setError]   = useState('');

  const { data: broadcasts = [], isLoading } = useQuery({
    queryKey: ['admin-broadcasts'], queryFn: api.adminListBroadcasts, staleTime: 30_000,
  });

  const active   = broadcasts.filter(b => b.isActive);
  const inactive = broadcasts.filter(b => !b.isActive);

  const { mutate: send, isPending } = useMutation({
    mutationFn: () => api.adminBroadcast({
      title, type, mediaUrl: mediaUrl || undefined, body: body || undefined,
      priority, durationS: Number(durationS) || 30,
      schedule: { endAt: schedEnd || undefined },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-broadcasts'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      setTitle(''); setUrl(''); setBody(''); setPri('normal'); setDur('30'); setEnd(''); setError('');
    },
    onError: e => setError(e.message || 'Failed'),
  });

  const { mutate: stop } = useMutation({
    mutationFn: api.adminDeleteBroadcast,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-broadcasts'] }); qc.invalidateQueries({ queryKey: ['admin-stats'] }); },
  });

  const priColor = { critical: 'var(--danger)', high: 'var(--warn)', normal: 'var(--accent)', low: 'var(--fg-subtle)' };

  return (
    <>
      {/* Active broadcasts — prominent */}
      {active.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--fg-subtle)', marginBottom: 8 }}>
            ● Live now — {active.length} active broadcast{active.length > 1 ? 's' : ''}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {active.map(c => (
              <div key={c._id} style={{
                padding: '14px 18px', borderRadius: 10,
                background: `color-mix(in oklch, ${priColor[c.priority] || 'var(--accent)'} 6%, var(--bg-elev))`,
                border: `1px solid color-mix(in oklch, ${priColor[c.priority] || 'var(--accent)'} 30%, var(--border))`,
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: priColor[c.priority] || 'var(--accent)', flexShrink: 0, boxShadow: `0 0 8px ${priColor[c.priority] || 'var(--accent)'}` }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{c.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 3 }}>
                    {c.type} · {c.durationS}s per cycle
                    {c.schedule?.endAt && ` · expires ${format(new Date(c.schedule.endAt), 'MMM d, HH:mm')}`}
                  </div>
                </div>
                <span style={{ padding: '2px 8px', borderRadius: 5, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', background: `color-mix(in oklch, ${priColor[c.priority] || 'var(--accent)'} 15%, transparent)`, color: priColor[c.priority] || 'var(--accent)', flexShrink: 0 }}>
                  {c.priority}
                </span>
                <span style={{ fontSize: 12, color: 'var(--fg-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {c.createdAt ? format(new Date(c.createdAt), 'MMM d, HH:mm') : '—'}
                </span>
                <button onClick={() => stop(c._id)}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--fg-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                  Stop broadcast
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compose */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16, alignItems: 'start' }}>
        <Card title="New platform broadcast" sub="Pushed to every screen across all organizations">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="ctrl-label" style={{ marginBottom: 6 }}>Title</div>
              <input className="select" style={{ width: '100%', boxSizing: 'border-box' }}
                placeholder="e.g. Scheduled Maintenance Notice"
                value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div>
              <div className="ctrl-label" style={{ marginBottom: 6 }}>Type</div>
              <Seg value={type} onChange={setType} options={[{ value: 'image', label: 'Image' }, { value: 'video', label: 'Video' }, { value: 'text', label: 'Text' }]} />
            </div>
            <div>
              <div className="ctrl-label" style={{ marginBottom: 6 }}>Priority</div>
              <Seg value={priority} onChange={setPri} options={[{ value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical' }]} />
            </div>
            {type !== 'text' ? (
              <div style={{ gridColumn: '1 / -1' }}>
                <div className="ctrl-label" style={{ marginBottom: 6 }}>{type === 'image' ? 'Image' : 'Video'} URL</div>
                <input className="select" style={{ width: '100%', boxSizing: 'border-box' }} placeholder="https://…" value={mediaUrl} onChange={e => setUrl(e.target.value)} />
              </div>
            ) : (
              <div style={{ gridColumn: '1 / -1' }}>
                <div className="ctrl-label" style={{ marginBottom: 6 }}>Message body</div>
                <textarea className="select" rows={3} style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }} placeholder="…" value={body} onChange={e => setBody(e.target.value)} />
              </div>
            )}
            <div>
              <div className="ctrl-label" style={{ marginBottom: 6 }}>Duration (sec)</div>
              <input className="select" type="number" min="5" max="600" value={durationS} onChange={e => setDur(e.target.value)} style={{ width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div className="ctrl-label" style={{ marginBottom: 6 }}>Expires (optional)</div>
              <input className="select" type="datetime-local" value={schedEnd} onChange={e => setEnd(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', fontSize: 13 }} />
            </div>
          </div>
          {error && <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: 'var(--danger-soft)', color: 'var(--danger-soft-fg)', fontSize: 13 }}>{error}</div>}
          <Btn icon={IcoSend} onClick={() => { if (!title.trim()) return setError('Title required'); if (type !== 'text' && !mediaUrl.trim()) return setError('URL required'); setError(''); send(); }} disabled={isPending}>
            {isPending ? 'Broadcasting…' : 'Send to all screens'}
          </Btn>
        </Card>

        {/* Preview pane */}
        <div style={{ background: '#0f0f14', borderRadius: 12, padding: '20px', minHeight: 280, display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)' }}>Screen preview</div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', padding: 20 }}>
            {title ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1.3, marginBottom: 8 }}>{title}</div>
                {body && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{body}</div>}
                {mediaUrl && type === 'image' && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>[ Image: {mediaUrl.split('/').pop()} ]</div>}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)' }}>Enter a title to preview</div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
            <span style={{ textTransform: 'capitalize', color: priColor[priority] || 'rgba(255,255,255,0.3)' }}>● {priority}</span>
            <span>{durationS}s display</span>
          </div>
        </div>
      </div>

      {/* History */}
      {inactive.length > 0 && (
        <Card title="Broadcast history" sub={`${inactive.length} past broadcasts`}>
          {isLoading ? (
            <div style={{ height: 80, display: 'grid', placeItems: 'center' }}><Spinner /></div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-elev)', zIndex: 1 }}>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Title', 'Type', 'Priority', 'Sent'].map((h, i) => (
                      <th key={h} style={{ textAlign: i > 1 ? 'right' : 'left', padding: '7px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inactive.map((c, i) => (
                    <tr key={c._id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 1 ? 'var(--bg-subtle)' : 'transparent' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--fg-muted)' }}>{c.title}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--fg-muted)', textTransform: 'capitalize' }}>{c.type} · {c.durationS}s</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}><SeverityBadge severity={c.priority} /></td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 12, color: 'var(--fg-muted)', whiteSpace: 'nowrap' }}>
                        {c.createdAt ? format(new Date(c.createdAt), 'MMM d, yyyy HH:mm') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

const TABS = [
  { value: 'orgs',      label: 'Organizations', Icon: IcoBuilding  },
  { value: 'fleet',     label: 'Fleet',         Icon: IcoCpu       },
  { value: 'alerts',    label: 'Alerts',        Icon: IcoBell      },
  { value: 'broadcast', label: 'Broadcasts',    Icon: IcoBroadcast },
];

export default function SuperAdminPage() {
  const [tab, setTab] = useState('orgs');

  const { data: stats } = useQuery({ queryKey: ['admin-stats'], queryFn: api.adminStats, staleTime: 30_000, refetchInterval: 60_000 });
  const { data: openAlerts = [] } = useQuery({ queryKey: ['admin-alerts', 'open'], queryFn: () => api.adminAlerts({ state: 'open', limit: 1 }), staleTime: 20_000, refetchInterval: 30_000 });

  const alertCount = openAlerts.length >= 1 && openAlerts[0]?.total != null ? openAlerts[0].total : openAlerts.length;

  return (
    <div className="page">
      <div className="page__head" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IcoShield size={20} style={{ color: 'var(--accent)' }} />
            Platform Control
          </h1>
          <div className="page__sub">Taarifa.live · Full visibility and control across all organizations</div>
        </div>
      </div>

      <HealthStrip stats={stats} alertCount={openAlerts.length} />

      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {TABS.map(t => {
          const hasAlert = t.value === 'alerts' && openAlerts.length > 0;
          return (
            <button key={t.value} onClick={() => setTab(t.value)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: 'none',
                color: tab === t.value ? 'var(--fg)' : 'var(--fg-muted)',
                borderBottom: tab === t.value ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'color 0.12s',
                position: 'relative',
              }}>
              <t.Icon size={14} />
              {t.label}
              {hasAlert && (
                <span style={{ padding: '1px 6px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: 'var(--danger)', color: '#fff', marginLeft: 2 }}>
                  {openAlerts.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === 'orgs'      && <OrgsTab />}
      {tab === 'fleet'     && <FleetTab />}
      {tab === 'alerts'    && <AlertsTab />}
      {tab === 'broadcast' && <BroadcastTab />}
    </div>
  );
}
