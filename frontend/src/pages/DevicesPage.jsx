import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api.js';
import { useAuthStore } from '../store/auth.js';
import { Btn, Badge, StatusDot, Seg, Card, Sparkline, Empty, Spinner } from '../components/ui/index.jsx';
import { IcoPlus, IcoFilter, IcoDownload, IcoLayoutGrid, IcoList, IcoGroup, IcoMore, IcoX, IcoCheck } from '../components/ui/Icons.jsx';

function rng(seed) {
  let s = seed | 0; if (s === 0) s = 1;
  return () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 0) / 4294967296); };
}
function genSeries(n, base, noise, seed = 1) {
  const r = rng(seed);
  let v = base;
  return Array.from({ length: n }, (_, i) => { v += (r() - 0.5) * noise; return { t: i, v: +v.toFixed(2) }; });
}

function BatteryBar({ pct }) {
  if (pct == null) return <span className="muted text-xs">—</span>;
  const color = pct < 25 ? 'var(--danger)' : pct < 50 ? 'var(--warn)' : 'var(--ok)';
  return (
    <div className="row gap-2">
      <div style={{ width: 32, height: 6, borderRadius: 2, background: 'var(--bg-muted)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color }} />
      </div>
      <span className="text-xs tabnum mono">{pct}%</span>
    </div>
  );
}

function AddDeviceModal({ groups, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', description: '', groupId: '', lat: '', lon: '', locationName: '' });
  const [error, setError] = useState('');
  const [newKey, setNewKey] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      const body = { ...form, lat: form.lat ? parseFloat(form.lat) : undefined, lon: form.lon ? parseFloat(form.lon) : undefined };
      const res = await api.createDevice(body);
      setNewKey(res.apiKey);
    } catch (err) {
      setError(err.message);
    }
  }

  if (newKey) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal__head">
            <div className="modal__title">Device created</div>
            <Btn kind="ghost" size="sm" icon={IcoX} onClick={onClose} />
          </div>
          <div className="modal__body">
            <div className="muted text-sm" style={{ marginBottom: 10 }}>Save this API key — it won't be shown again:</div>
            <div style={{ background: 'var(--bg-muted)', borderRadius: 6, padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, wordBreak: 'break-all' }}>{newKey}</div>
          </div>
          <div className="modal__foot">
            <Btn kind="primary" icon={IcoCheck} onClick={() => { onSaved(); onClose(); }}>Done</Btn>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">Add device</div>
          <Btn kind="ghost" size="sm" icon={IcoX} onClick={onClose} />
        </div>
        <div className="modal__body">
          {error && <div className="error-banner">{error}</div>}
          <form id="add-device-form" onSubmit={submit}>
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="field__label">Name *</label>
              <input required className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="field__label">Description</label>
              <input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="field__label">Group</label>
              <select className="select" value={form.groupId} onChange={e => setForm(f => ({ ...f, groupId: e.target.value }))}>
                <option value="">— No group —</option>
                {groups?.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="field__label">Location name</label>
              <input className="input" value={form.locationName} onChange={e => setForm(f => ({ ...f, locationName: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2" style={{ gap: 10 }}>
              <div className="field">
                <label className="field__label">Latitude</label>
                <input type="number" step="any" className="input" value={form.lat} onChange={e => setForm(f => ({ ...f, lat: e.target.value }))} />
              </div>
              <div className="field">
                <label className="field__label">Longitude</label>
                <input type="number" step="any" className="input" value={form.lon} onChange={e => setForm(f => ({ ...f, lon: e.target.value }))} />
              </div>
            </div>
          </form>
        </div>
        <div className="modal__foot">
          <Btn kind="secondary" onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" icon={IcoCheck} type="submit" form="add-device-form">Create device</Btn>
        </div>
      </div>
    </div>
  );
}

export default function DevicesPage() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  const role = user?.role || 'viewer';
  const [view, setView] = useState('list');
  const [filter, setFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: () => api.listDevices({ limit: 100 }),
    refetchInterval: 30_000,
  });
  const { data: groups } = useQuery({ queryKey: ['device-groups'], queryFn: api.listGroups });

  const devices = data?.devices || [];
  const filtered = filter === 'all' ? devices : devices.filter(d => d.status === filter);

  const counts = {
    total: devices.length,
    online: devices.filter(d => d.status === 'online').length,
    alert: devices.filter(d => d.status === 'alert').length,
    offline: devices.filter(d => d.status === 'offline').length,
    maintenance: devices.filter(d => d.status === 'maintenance').length,
  };

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Devices</h1>
          <div className="page__sub">{counts.total} registered · {counts.online} online · {counts.alert} alerting</div>
        </div>
        <div className="page__actions">
          <Seg value={view} onChange={setView} options={[
            { value: 'list', label: 'List', icon: IcoList },
            { value: 'grid', label: 'Grid', icon: IcoLayoutGrid },
          ]} />
          {(role === 'admin' || role === 'org_admin') && (
            <Btn kind="primary" size="sm" icon={IcoPlus} onClick={() => setShowAdd(true)}>Add device</Btn>
          )}
        </div>
      </div>

      <div className="row gap-2" style={{ marginBottom: 12 }}>
        <Seg value={filter} onChange={setFilter} options={[
          { value: 'all',         label: `All ${counts.total}` },
          { value: 'online',      label: 'Online' },
          { value: 'alert',       label: 'Alerting' },
          { value: 'offline',     label: 'Offline' },
          { value: 'maintenance', label: 'Maintenance' },
        ]} />
        <div style={{ flex: 1 }} />
        <Btn kind="ghost" size="sm" icon={IcoDownload}>Export CSV</Btn>
      </div>

      {isLoading ? <Spinner /> : filtered.length === 0 ? (
        <Card><Empty icon={IcoList} title="No devices" hint="Add a device to get started." /></Card>
      ) : view === 'list' ? (
        <Card padding={false}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th>Device</th>
                <th>Location</th>
                <th>24h activity</th>
                <th>Last seen</th>
                <th>Battery</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d, i) => (
                <tr key={d._id}>
                  <td><StatusDot status={d.status} pulse={d.status === 'alert'} /></td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{d.name}</div>
                    <div className="text-xs mono muted">{d._id.slice(-8)}</div>
                  </td>
                  <td className="muted">{d.locationName || '—'}</td>
                  <td style={{ width: 110 }}>
                    <Sparkline data={genSeries(24, 22, 1.4, i + 1)} color={d.status === 'alert' ? 'var(--danger)' : 'var(--accent)'} height={26} animate={false} />
                  </td>
                  <td className="muted text-xs">{d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleTimeString() : '—'}</td>
                  <td><BatteryBar pct={d.batteryLevel} /></td>
                  <td style={{ width: 32 }}>
                    <Btn kind="ghost" size="sm" icon={IcoMore} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <div className="grid grid-cols-3">
          {filtered.map((d, i) => (
            <div key={d._id} className="card" style={{ padding: 14 }}>
              <div className="row gap-2" style={{ justifyContent: 'space-between' }}>
                <div className="row gap-2">
                  <StatusDot status={d.status} pulse={d.status === 'alert'} />
                  <span style={{ fontWeight: 500 }}>{d.name}</span>
                </div>
                <Badge kind={d.status === 'online' ? 'ok' : d.status === 'alert' ? 'danger' : d.status === 'maintenance' ? 'warn' : 'neutral'}>
                  {d.status}
                </Badge>
              </div>
              <div className="text-xs muted" style={{ marginTop: 2 }}>{d.locationName || '—'}</div>
              <div style={{ marginTop: 10 }}>
                <Sparkline data={genSeries(36, 25, 1.6, i + 10)} color={d.status === 'alert' ? 'var(--danger)' : 'var(--accent)'} height={40} fill animate={false} />
              </div>
              <div className="row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
                <BatteryBar pct={d.batteryLevel} />
                <span className="text-xs muted">{d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleTimeString() : '—'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <AddDeviceModal
          groups={groups}
          onClose={() => setShowAdd(false)}
          onSaved={() => qc.invalidateQueries(['devices'])}
        />
      )}
    </div>
  );
}
