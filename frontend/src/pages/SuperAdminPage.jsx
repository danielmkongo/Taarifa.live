import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { api } from '../services/api.js';
import { Btn, Card, Empty, Spinner, Seg } from '../components/ui/index.jsx';
import {
  IcoSearch, IcoX, IcoShield, IcoBroadcast, IcoBuilding,
  IcoCpu, IcoSend, IcoGlobe, IcoMonitor, IcoCheck, IcoAlert,
} from '../components/ui/Icons.jsx';

// ── Shared helpers ─────────────────────────────────────────────────────────────

function StatTile({ label, value, color, sub }) {
  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div className="text-xs muted" style={{ marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.04em', color: color || 'var(--fg)', lineHeight: 1 }}>{value ?? '—'}</div>
      {sub && <div className="text-xs muted" style={{ marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function StatusDot({ status }) {
  const color = status === 'online' ? 'var(--ok)' : status === 'alert' ? 'var(--danger)' : 'var(--fg-subtle)';
  return <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />;
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="search" style={{ flex: 1, minWidth: 200 }}>
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

// ── Organizations tab ──────────────────────────────────────────────────────────

function OrgsTab() {
  const [search, setSearch] = useState('');
  const { data: orgs = [], isLoading } = useQuery({ queryKey: ['admin-orgs'], queryFn: api.adminListOrgs, staleTime: 30_000 });

  const filtered = search
    ? orgs.filter(o => [o.name, o.slug].some(v => v?.toLowerCase().includes(search.toLowerCase())))
    : orgs;

  const totalDevices = orgs.reduce((s, o) => s + (o.stats?.devices || 0), 0);
  const totalOnline  = orgs.reduce((s, o) => s + (o.stats?.devicesOnline || 0), 0);
  const totalScreens = orgs.reduce((s, o) => s + (o.stats?.screens || 0), 0);

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
        <StatTile label="Organizations" value={orgs.length} />
        <StatTile label="Total devices"  value={totalDevices} />
        <StatTile label="Online"          value={totalOnline}  color="var(--ok)" />
        <StatTile label="Screens"         value={totalScreens} />
      </div>

      <Card title="All organizations" sub={`${filtered.length} organizations on the platform`}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <SearchBox value={search} onChange={setSearch} placeholder="Search organizations…" />
        </div>

        {isLoading ? (
          <div style={{ height: 200, display: 'grid', placeItems: 'center' }}><Spinner /></div>
        ) : filtered.length === 0 ? (
          <Empty icon={null} title="No organizations" hint="No organizations found." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(org => (
              <div key={org._id} style={{ padding: '14px 16px', background: 'var(--bg-subtle)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{org.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{org.slug}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--fg-muted)', marginTop: 3 }}>
                      Joined {org.createdAt ? format(new Date(org.createdAt), 'MMM d, yyyy') : '—'}
                      {org.plan && <span style={{ marginLeft: 8, padding: '1px 6px', background: 'var(--accent-soft)', color: 'var(--accent)', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{org.plan}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
                    {[
                      { label: 'Devices',  value: org.stats?.devices       ?? 0 },
                      { label: 'Online',   value: org.stats?.devicesOnline  ?? 0, color: 'var(--ok)' },
                      { label: 'Alert',    value: org.stats?.devicesAlert   ?? 0, color: org.stats?.devicesAlert > 0 ? 'var(--danger)' : 'var(--fg-muted)' },
                      { label: 'Users',    value: org.stats?.users          ?? 0 },
                      { label: 'Screens',  value: org.stats?.screens        ?? 0 },
                    ].map(s => (
                      <div key={s.label} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 17, fontWeight: 800, color: s.color || 'var(--fg)', lineHeight: 1 }}>{s.value}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--fg-muted)', marginTop: 2 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

// ── Fleet tab ──────────────────────────────────────────────────────────────────

function FleetTab() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [view, setView] = useState('iot');

  const { data: iotDevices = [], isLoading: loadingIot } = useQuery({
    queryKey: ['admin-fleet'],
    queryFn:  () => api.adminFleet({ limit: 500 }),
    staleTime: 30_000,
  });
  const { data: screens = [], isLoading: loadingScreens } = useQuery({
    queryKey: ['admin-screens'],
    queryFn:  api.adminScreens,
    staleTime: 30_000,
  });

  const devices = view === 'iot' ? iotDevices : screens;
  const isLoading = view === 'iot' ? loadingIot : loadingScreens;

  const filtered = devices.filter(d => {
    const q = search.toLowerCase();
    const matchSearch = !q || [d.name, d.serialNumber, d.locationName, d.address, d.orgName, d.location].some(v => v?.toLowerCase().includes(q));
    const matchStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const online  = filtered.filter(d => d.status === 'online').length;
  const offline = filtered.filter(d => d.status === 'offline').length;
  const alert   = filtered.filter(d => d.status === 'alert').length;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
        <StatTile label="Shown"   value={filtered.length} />
        <StatTile label="Online"  value={online}  color="var(--ok)" />
        <StatTile label="Offline" value={offline} color="var(--fg-subtle)" />
        {view === 'iot' && <StatTile label="Alert" value={alert} color={alert > 0 ? 'var(--danger)' : undefined} />}
      </div>

      <Card title="Platform fleet"
        sub={`${view === 'iot' ? 'Weather/IoT sensors' : 'e-Calendar screens'} · all organizations`}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <SearchBox value={search} onChange={setSearch} placeholder="Search name, org, location, serial…" />
          <Seg value={view} onChange={v => { setView(v); setSearch(''); setStatusFilter('all'); }} options={[
            { value: 'iot',     label: 'IoT Sensors' },
            { value: 'screens', label: 'Screens'     },
          ]} />
          <Seg value={statusFilter} onChange={setStatusFilter} options={[
            { value: 'all',     label: 'All'     },
            { value: 'online',  label: 'Online'  },
            { value: 'offline', label: 'Offline' },
            ...(view === 'iot' ? [{ value: 'alert', label: 'Alert' }] : []),
          ]} />
        </div>

        {isLoading ? (
          <div style={{ height: 200, display: 'grid', placeItems: 'center' }}><Spinner /></div>
        ) : filtered.length === 0 ? (
          <Empty icon={null} title="No devices" hint="No devices match the current filters." />
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: 500, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-elev)', zIndex: 1 }}>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Status', 'Name', 'Organization', view === 'iot' ? 'Serial' : 'Location', 'Last seen'].map((h, i) => (
                    <th key={h} style={{ textAlign: i > 2 ? 'right' : 'left', padding: '7px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((d, i) => (
                  <tr key={d._id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 1 ? 'var(--bg-subtle)' : 'transparent' }}>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <StatusDot status={d.status} />
                        <span style={{ fontSize: 12, color: 'var(--fg-muted)', textTransform: 'capitalize' }}>{d.status || 'unknown'}</span>
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{d.name}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--fg-muted)' }}>{d.orgName || '—'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)' }}>
                      {view === 'iot' ? (d.serialNumber || '—') : (d.locationName || d.location || '—')}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)', whiteSpace: 'nowrap' }}>
                      {(d.lastSeen || d.lastSeenAt) ? format(new Date(d.lastSeen || d.lastSeenAt), 'MMM d, HH:mm') : '—'}
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

// ── Global Broadcast tab ───────────────────────────────────────────────────────

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
    queryKey: ['admin-broadcasts'],
    queryFn:  api.adminListBroadcasts,
    staleTime: 30_000,
  });

  const { mutate: send, isPending } = useMutation({
    mutationFn: () => api.adminBroadcast({
      title, type, mediaUrl: mediaUrl || undefined,
      body: body || undefined,
      priority, durationS: Number(durationS) || 30,
      schedule: { endAt: schedEnd || undefined },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-broadcasts'] });
      setTitle(''); setUrl(''); setBody(''); setPri('normal'); setDur('30'); setEnd(''); setError('');
    },
    onError: e => setError(e.message || 'Failed to send broadcast'),
  });

  const { mutate: deactivate } = useMutation({
    mutationFn: api.adminDeleteBroadcast,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-broadcasts'] }),
  });

  function handleSend() {
    if (!title.trim())    return setError('Title is required');
    if (type !== 'text' && !mediaUrl.trim()) return setError('Media URL is required');
    setError('');
    send();
  }

  const priorityColors = { critical: 'var(--danger)', high: 'var(--warn)', normal: 'var(--accent)', low: 'var(--fg-subtle)' };

  return (
    <>
      <div style={{ background: 'var(--warn-soft)', border: '1px solid color-mix(in oklch, var(--warn) 30%, var(--border))', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <IcoAlert size={15} style={{ color: 'var(--warn)', flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 13, color: 'var(--fg-muted)' }}>
          Platform broadcasts are pushed to <strong style={{ color: 'var(--fg)' }}>every screen across all organizations</strong> immediately. Use for emergencies, system notices, or approved platform-wide advertisements.
        </div>
      </div>

      <Card title="New platform broadcast" sub="Sent to all e-Calendar screens on the platform">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <div className="ctrl-label" style={{ marginBottom: 6 }}>Title / Headline</div>
            <input className="select" style={{ width: '100%', boxSizing: 'border-box' }}
              placeholder="e.g. Scheduled Maintenance Notice"
              value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <div className="ctrl-label" style={{ marginBottom: 6 }}>Content type</div>
            <Seg value={type} onChange={setType} options={[
              { value: 'image', label: 'Image' },
              { value: 'video', label: 'Video' },
              { value: 'text',  label: 'Text'  },
            ]} />
          </div>
          <div>
            <div className="ctrl-label" style={{ marginBottom: 6 }}>Priority</div>
            <Seg value={priority} onChange={setPri} options={[
              { value: 'low',      label: 'Low'      },
              { value: 'normal',   label: 'Normal'   },
              { value: 'high',     label: 'High'     },
              { value: 'critical', label: 'Critical' },
            ]} />
          </div>
          {type !== 'text' && (
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="ctrl-label" style={{ marginBottom: 6 }}>{type === 'image' ? 'Image URL' : 'Video URL'}</div>
              <input className="select" style={{ width: '100%', boxSizing: 'border-box' }}
                placeholder="https://…"
                value={mediaUrl} onChange={e => setUrl(e.target.value)} />
            </div>
          )}
          {type === 'text' && (
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="ctrl-label" style={{ marginBottom: 6 }}>Body text</div>
              <textarea className="select" rows={3} style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
                placeholder="Message body…"
                value={body} onChange={e => setBody(e.target.value)} />
            </div>
          )}
          <div>
            <div className="ctrl-label" style={{ marginBottom: 6 }}>Display duration (seconds)</div>
            <input className="select" type="number" min="5" max="600"
              value={durationS} onChange={e => setDur(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box' }} />
          </div>
          <div>
            <div className="ctrl-label" style={{ marginBottom: 6 }}>Expires at (optional)</div>
            <input className="select" type="datetime-local"
              value={schedEnd} onChange={e => setEnd(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', fontSize: 13 }} />
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: 'var(--danger-soft)', color: 'var(--danger-soft-fg)', fontSize: 13 }}>{error}</div>
        )}
        <Btn icon={IcoSend} onClick={handleSend} disabled={isPending}>
          {isPending ? 'Broadcasting…' : 'Send to all screens'}
        </Btn>
      </Card>

      <Card title="Active & recent broadcasts" sub="Platform-wide content sent by Taarifa admin" style={{ marginTop: 16 }}>
        {isLoading ? (
          <div style={{ height: 120, display: 'grid', placeItems: 'center' }}><Spinner /></div>
        ) : broadcasts.length === 0 ? (
          <Empty icon={null} title="No broadcasts yet" hint="Use the form above to send your first platform broadcast." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {broadcasts.map(c => (
              <div key={c._id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', background: 'var(--bg-subtle)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <IcoGlobe size={14} style={{ color: priorityColors[c.priority] || 'var(--accent)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.title}
                    {!c.isActive && <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--fg-subtle)', fontWeight: 400 }}>deactivated</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--fg-muted)', marginTop: 2 }}>
                    {c.type} · {c.durationS}s
                    {c.schedule?.endAt && ` · expires ${format(new Date(c.schedule.endAt), 'MMM d, HH:mm')}`}
                    <span style={{ marginLeft: 8, padding: '1px 5px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', background: 'color-mix(in oklch, ' + (priorityColors[c.priority] || 'var(--accent)') + ' 15%, transparent)', color: priorityColors[c.priority] || 'var(--accent)' }}>{c.priority}</span>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--fg-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {c.createdAt ? format(new Date(c.createdAt), 'MMM d, HH:mm') : '—'}
                </div>
                {c.isActive && (
                  <button onClick={() => deactivate(c._id)}
                    style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: 'var(--fg-muted)', flexShrink: 0 }}>
                    Stop
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

const TABS = [
  { value: 'orgs',      label: 'Organizations', Icon: IcoBuilding  },
  { value: 'fleet',     label: 'Fleet',         Icon: IcoCpu       },
  { value: 'broadcast', label: 'Broadcasts',    Icon: IcoBroadcast },
];

export default function SuperAdminPage() {
  const [tab, setTab] = useState('orgs');

  const { data: stats } = useQuery({ queryKey: ['admin-stats'], queryFn: api.adminStats, staleTime: 30_000 });

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IcoShield size={20} style={{ color: 'var(--accent)' }} />
            Super Admin
          </h1>
          <div className="page__sub">
            Platform-wide control · {stats ? `${stats.totalOrgs} orgs · ${stats.totalDevices} devices · ${stats.totalScreens} screens` : 'Loading…'}
            {stats?.activeBroadcasts > 0 && (
              <span style={{ marginLeft: 10, padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 700, background: 'var(--warn-soft)', color: 'var(--warn-soft-fg)' }}>
                {stats.activeBroadcasts} active broadcast{stats.activeBroadcasts > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t.value} onClick={() => setTab(t.value)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: 'none',
              color: tab === t.value ? 'var(--fg)' : 'var(--fg-muted)',
              borderBottom: tab === t.value ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'all 0.12s',
            }}>
            <t.Icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'orgs'      && <OrgsTab />}
      {tab === 'fleet'     && <FleetTab />}
      {tab === 'broadcast' && <BroadcastTab />}
    </div>
  );
}
