import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { api } from '../services/api.js';
import { Btn, Card, Empty, Spinner, Seg } from '../components/ui/index.jsx';
import { IcoSearch, IcoX, IcoShield, IcoBroadcast, IcoGlobe, IcoCpu, IcoSend } from '../components/ui/Icons.jsx';

function StatTile({ label, value, color }) {
  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div className="text-xs muted" style={{ marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em', color: color || 'var(--fg)', lineHeight: 1 }}>
        {value ?? '—'}
      </div>
    </div>
  );
}

function FleetTab() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['sa-devices'],
    queryFn:  () => api.listDevices({ limit: 500 }),
    staleTime: 30_000,
  });

  const devices = data?.devices || [];
  const total   = data?.total   ?? devices.length;
  const online  = devices.filter(d => d.status === 'online').length;
  const offline = devices.filter(d => d.status === 'offline').length;
  const alert   = devices.filter(d => d.status === 'alert').length;

  const filtered = devices.filter(d => {
    const q = search.toLowerCase();
    const matchSearch = !q || [d.name, d.serialNumber, d.locationName, d.address].some(v => v?.toLowerCase().includes(q));
    const matchStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusColor = { online: 'var(--ok)', offline: 'var(--fg-subtle)', alert: 'var(--danger)' };

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
        <StatTile label="Total devices"  value={total}   />
        <StatTile label="Online"         value={online}  color="var(--ok)" />
        <StatTile label="Offline"        value={offline} color="var(--fg-subtle)" />
        <StatTile label="Alert"          value={alert}   color="var(--danger)" />
      </div>

      <Card title="All devices" sub={`${filtered.length} of ${total} · platform-wide fleet`}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <div className="search" style={{ flex: 1, minWidth: 200 }}>
            <IcoSearch size={13} />
            <input placeholder="Search by name, serial, location…"
              value={search} onChange={e => setSearch(e.target.value)} />
            {search && (
              <button onMouseDown={e => { e.preventDefault(); setSearch(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)', display: 'flex', padding: 0 }}>
                <IcoX size={12} />
              </button>
            )}
          </div>
          <Seg value={statusFilter} onChange={setStatusFilter} options={[
            { value: 'all',     label: 'All'     },
            { value: 'online',  label: 'Online'  },
            { value: 'offline', label: 'Offline' },
            { value: 'alert',   label: 'Alert'   },
          ]} />
        </div>

        {isLoading ? (
          <div style={{ height: 200, display: 'grid', placeItems: 'center' }}><Spinner /></div>
        ) : filtered.length === 0 ? (
          <Empty icon={null} title="No devices" hint="No devices match your filters." />
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: 480, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-elev)', zIndex: 1 }}>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Status', 'Name', 'Serial', 'Location', 'Last seen'].map((h, i) => (
                    <th key={h} style={{ textAlign: i > 2 ? 'right' : 'left', padding: '7px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((d, i) => (
                  <tr key={d._id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 1 ? 'var(--bg-subtle)' : 'transparent' }}>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor[d.status] || 'var(--fg-subtle)', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: 'var(--fg-muted)', textTransform: 'capitalize' }}>{d.status || 'unknown'}</span>
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{d.name}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)' }}>{d.serialNumber || '—'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--fg-muted)' }}>{d.locationName || d.address || '—'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)', whiteSpace: 'nowrap' }}>
                      {d.lastSeen ? format(new Date(d.lastSeen), 'MMM d, HH:mm') : '—'}
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

function BroadcastTab() {
  const qc = useQueryClient();
  const [title, setTitle]   = useState('');
  const [type, setType]     = useState('image');
  const [url, setUrl]       = useState('');
  const [duration, setDur]  = useState('30');
  const [zone, setZone]     = useState('');
  const [error, setError]   = useState('');

  const { data: contentData, isLoading } = useQuery({
    queryKey: ['sa-broadcasts'],
    queryFn:  () => api.listEcalContent({ limit: 20 }),
    staleTime: 30_000,
  });

  const broadcasts = (contentData?.content || []).filter(c => c.isGlobal);

  const { mutate: send, isPending } = useMutation({
    mutationFn: () => api.createEcalContent({
      title,
      type,
      [type === 'image' ? 'imageUrl' : 'videoUrl']: url,
      duration: Number(duration) || 30,
      zone: zone || undefined,
      isGlobal: true,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-broadcasts'] });
      setTitle(''); setUrl(''); setDur('30'); setZone(''); setError('');
    },
    onError: (e) => setError(e.message || 'Failed to send broadcast'),
  });

  function handleSend() {
    if (!title.trim()) return setError('Title is required');
    if (!url.trim())   return setError('URL is required');
    setError('');
    send();
  }

  return (
    <>
      <Card title="New global broadcast" sub="Pushes content to all screens across all organizations">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <div className="ctrl-label" style={{ marginBottom: 6 }}>Title</div>
            <input className="select" style={{ width: '100%', boxSizing: 'border-box' }}
              placeholder="e.g. Safety Notice"
              value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <div className="ctrl-label" style={{ marginBottom: 6 }}>Content type</div>
            <Seg value={type} onChange={setType} options={[
              { value: 'image', label: 'Image' },
              { value: 'video', label: 'Video' },
            ]} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div className="ctrl-label" style={{ marginBottom: 6 }}>{type === 'image' ? 'Image URL' : 'Video URL'}</div>
            <input className="select" style={{ width: '100%', boxSizing: 'border-box' }}
              placeholder="https://…"
              value={url} onChange={e => setUrl(e.target.value)} />
          </div>
          <div>
            <div className="ctrl-label" style={{ marginBottom: 6 }}>Duration (seconds)</div>
            <input className="select" type="number" min="5" max="600"
              value={duration} onChange={e => setDur(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box' }} />
          </div>
          <div>
            <div className="ctrl-label" style={{ marginBottom: 6 }}>Zone (optional)</div>
            <input className="select" placeholder="Leave blank for all zones"
              value={zone} onChange={e => setZone(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box' }} />
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: 'var(--danger-soft)', color: 'var(--danger-soft-fg)', fontSize: 13 }}>
            {error}
          </div>
        )}

        <Btn icon={IcoSend} onClick={handleSend} disabled={isPending}>
          {isPending ? 'Sending…' : 'Broadcast to all screens'}
        </Btn>
      </Card>

      <Card title="Recent global broadcasts" sub="Latest 20 platform-wide broadcasts" style={{ marginTop: 16 }}>
        {isLoading ? (
          <div style={{ height: 120, display: 'grid', placeItems: 'center' }}><Spinner /></div>
        ) : broadcasts.length === 0 ? (
          <Empty icon={null} title="No broadcasts yet" hint="Send a global broadcast above to see it here." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {broadcasts.map(c => (
              <div key={c._id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-subtle)', borderRadius: 8, fontSize: 13 }}>
                <IcoGlobe size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--fg-muted)', marginTop: 2 }}>
                    {c.type} · {c.duration}s{c.zone ? ` · Zone: ${c.zone}` : ' · All zones'}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--fg-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {c.createdAt ? format(new Date(c.createdAt), 'MMM d, HH:mm') : '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

const TABS = [
  { value: 'fleet',     label: 'Fleet',            Icon: IcoCpu       },
  { value: 'broadcast', label: 'Global Broadcast',  Icon: IcoBroadcast },
];

export default function SuperAdminPage() {
  const [tab, setTab] = useState('fleet');

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IcoShield size={20} style={{ color: 'var(--accent)' }} />
            Super Admin
          </h1>
          <div className="page__sub">Platform-wide fleet management and global content broadcasting.</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t.value} onClick={() => setTab(t.value)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: tab === t.value ? 'var(--bg-elev)' : 'none',
              color: tab === t.value ? 'var(--fg)' : 'var(--fg-muted)',
              borderBottom: tab === t.value ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'all 0.12s',
            }}>
            <t.Icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'fleet'     && <FleetTab />}
      {tab === 'broadcast' && <BroadcastTab />}
    </div>
  );
}
