import { useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api.js';
import { Btn, Badge, StatusDot, Card, Seg, LineChart, Empty, Spinner } from '../components/ui/index.jsx';
import {
  IcoPlus, IcoX, IcoKey, IcoPower, IcoCpu, IcoCheck, IcoRefresh,
  IcoCopy, IcoLayers, IcoSettings, IcoGauge, IcoActivity, IcoSearch,
} from '../components/ui/Icons.jsx';
import { format, subHours, subDays } from 'date-fns';

// ── Constants ──────────────────────────────────────────────────────────────────

const MC = {
  power:       'oklch(0.68 0.18 55)',
  voltage:     'oklch(0.55 0.18 258)',
  current:     'oklch(0.58 0.20 22)',
  powerFactor: 'oklch(0.55 0.16 155)',
  energy:      'oklch(0.55 0.18 305)',
};
const MU = { power: 'W', voltage: 'V', current: 'A', powerFactor: '', energy: 'kWh' };
const METRICS = [
  { key: 'power',       label: 'Power',        unit: 'W'   },
  { key: 'voltage',     label: 'Voltage',      unit: 'V'   },
  { key: 'current',     label: 'Current',      unit: 'A'   },
  { key: 'powerFactor', label: 'Power Factor', unit: ''    },
  { key: 'energy',      label: 'Energy',       unit: 'kWh' },
];

function clip(text) { navigator.clipboard?.writeText(text).catch(() => {}); }

function fmtPower(w) {
  if (w == null) return '—';
  if (w >= 1000) return `${(w / 1000).toFixed(2)} kW`;
  return `${w.toFixed(1)} W`;
}

function pfColor(pf) {
  if (pf == null) return 'var(--fg-subtle)';
  if (pf >= 0.95) return 'var(--ok)';
  if (pf >= 0.85) return 'var(--warn)';
  return 'var(--danger)';
}

function pfLabel(pf) {
  if (pf == null) return 'No data';
  if (pf >= 0.95) return 'Excellent';
  if (pf >= 0.85) return 'Good';
  if (pf >= 0.75) return 'Fair';
  return 'Poor';
}

// ── Modals ─────────────────────────────────────────────────────────────────────

function SystemModal({ initial, onClose, onSaved }) {
  const [form, setForm] = useState({ name: initial?.name || '', description: initial?.description || '', location: initial?.location || '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isEdit = !!initial?._id;

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) return setError('Name is required');
    setError(''); setLoading(true);
    try {
      if (isEdit) await api.updateEnergySystem(initial._id, form);
      else await api.createEnergySystem(form);
      onSaved(); onClose();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">{isEdit ? 'Edit system' : 'New system'}</div>
          <Btn kind="ghost" size="sm" icon={IcoX} onClick={onClose} />
        </div>
        <form onSubmit={submit}>
          <div className="modal__body">
            {error && <div className="error-banner" style={{ marginBottom: 12 }}>{error}</div>}
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="field__label">Name</label>
              <input required className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="field__label">Description</label>
              <input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="field">
              <label className="field__label">Location</label>
              <input className="input" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Building A, Floor 2…" />
            </div>
          </div>
          <div className="modal__foot">
            <Btn kind="secondary" type="button" onClick={onClose}>Cancel</Btn>
            <Btn kind="primary" icon={IcoCheck} disabled={loading}>{loading ? 'Saving…' : isEdit ? 'Save' : 'Create'}</Btn>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeviceModal({ systems, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', description: '', systemId: '', location: '', protocol: 'mqtt' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) return setError('Name is required');
    setError(''); setLoading(true);
    try {
      const result = await api.createEnergyDevice({ ...form, systemId: form.systemId || undefined });
      onCreated(result); onClose();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">Register energy device</div>
          <Btn kind="ghost" size="sm" icon={IcoX} onClick={onClose} />
        </div>
        <form onSubmit={submit}>
          <div className="modal__body">
            {error && <div className="error-banner" style={{ marginBottom: 12 }}>{error}</div>}
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="field__label">Name</label>
              <input required className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="field__label">Description</label>
              <input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="field__label">System (optional)</label>
              <select className="select" value={form.systemId} onChange={e => setForm(f => ({ ...f, systemId: e.target.value }))}>
                <option value="">— Unassigned —</option>
                {(systems || []).map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="field__label">Location</label>
              <input className="input" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Panel A, Meter 1…" />
            </div>
            <div className="field">
              <label className="field__label">Protocol</label>
              <select className="select" value={form.protocol} onChange={e => setForm(f => ({ ...f, protocol: e.target.value }))}>
                <option value="mqtt">MQTT</option>
                <option value="http">HTTP</option>
              </select>
            </div>
            <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: 8, fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.6 }}>
              An API key is generated on registration. Send readings to <code style={{ fontFamily: 'var(--font-mono)' }}>POST /api/v1/energy/ingest/:id</code> with the <code style={{ fontFamily: 'var(--font-mono)' }}>x-api-key</code> header.
            </div>
          </div>
          <div className="modal__foot">
            <Btn kind="secondary" type="button" onClick={onClose}>Cancel</Btn>
            <Btn kind="primary" icon={IcoCheck} disabled={loading}>{loading ? 'Registering…' : 'Register'}</Btn>
          </div>
        </form>
      </div>
    </div>
  );
}

function ApiKeyModal({ apiKey, deviceId, onClose }) {
  const [copied, setCopied] = useState(false);
  function copy() { clip(apiKey); setCopied(true); setTimeout(() => setCopied(false), 2000); }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">Device registered</div>
          <Btn kind="ghost" size="sm" icon={IcoX} onClick={onClose} />
        </div>
        <div className="modal__body">
          <div style={{ padding: '12px 14px', background: 'var(--ok-soft)', borderRadius: 8, marginBottom: 16, fontSize: 13, color: 'var(--ok-soft-fg)' }}>
            Device created. Copy the API key now — it will not be shown again.
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field__label">Device ID</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input readOnly className="input" value={deviceId} style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} />
              <Btn kind="ghost" size="sm" icon={IcoCopy} onClick={() => clip(deviceId)} />
            </div>
          </div>
          <div className="field">
            <label className="field__label">API Key (shown once)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input readOnly className="input" value={apiKey} style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} />
              <Btn kind={copied ? 'ok' : 'primary'} size="sm" icon={copied ? IcoCheck : IcoCopy} onClick={copy}>
                {copied ? 'Copied' : 'Copy'}
              </Btn>
            </div>
          </div>
        </div>
        <div className="modal__foot"><Btn kind="primary" onClick={onClose}>Done</Btn></div>
      </div>
    </div>
  );
}

// ── Overview Tab ───────────────────────────────────────────────────────────────

function OverviewTab({ fleet, isLoading }) {
  if (isLoading) return <Spinner />;

  const { devices = [], systems = [], summary = {} } = fleet || {};
  const { total = 0, online = 0, offline = 0, alert = 0, totalPower = 0, avgPF, totalEnergy = 0 } = summary;
  const maxPower = Math.max(...devices.map(d => d.latestReading?.power ?? 0), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* KPI banner */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 1,
        background: 'var(--border)', borderRadius: 14, overflow: 'hidden',
        boxShadow: 'var(--shadow-md)',
      }}>
        {[
          {
            label: 'Total Load',
            value: fmtPower(totalPower),
            sub: `across ${online} active device${online !== 1 ? 's' : ''}`,
            accent: true,
          },
          {
            label: 'Power Factor',
            value: avgPF != null ? avgPF.toFixed(3) : '—',
            sub: pfLabel(avgPF),
            valueColor: pfColor(avgPF),
          },
          {
            label: 'Energy (latest)',
            value: `${totalEnergy.toFixed(1)}`,
            unit: 'kWh',
            sub: 'sum of last readings',
          },
          {
            label: 'Fleet',
            value: total,
            sub: `${online} online · ${alert} alert · ${offline} offline`,
            valueColor: online > 0 ? 'var(--ok)' : 'var(--fg-muted)',
          },
        ].map((k, i) => (
          <div key={i} style={{
            padding: '22px 24px',
            background: k.accent
              ? 'linear-gradient(135deg, var(--energy) 0%, oklch(0.58 0.22 40) 100%)'
              : 'var(--bg-elev)',
            position: 'relative', overflow: 'hidden',
          }}>
            {k.accent && (
              <div style={{
                position: 'absolute', right: -24, top: -24,
                width: 100, height: 100, borderRadius: '50%',
                background: 'rgba(255,255,255,0.06)',
              }} />
            )}
            <div style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
              color: k.accent ? 'rgba(255,255,255,0.65)' : 'var(--fg-muted)', marginBottom: 10,
            }}>{k.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <div style={{
                fontSize: 38, fontWeight: 800, letterSpacing: '-0.05em', lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
                color: k.accent ? '#fff' : (k.valueColor || 'var(--fg)'),
              }}>{k.value}</div>
              {k.unit && <div style={{ fontSize: 14, fontWeight: 600, color: k.accent ? 'rgba(255,255,255,0.7)' : 'var(--fg-muted)' }}>{k.unit}</div>}
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: k.accent ? 'rgba(255,255,255,0.6)' : 'var(--fg-muted)' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Device cards grid */}
      {devices.length === 0 ? (
        <Card padding>
          <Empty icon={IcoCpu} title="No devices registered" hint="Add your first energy monitoring device from the Devices tab." />
        </Card>
      ) : (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-muted)' }}>
            Live readings — {devices.length} device{devices.length !== 1 ? 's' : ''}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {devices.map(d => {
              const r = d.latestReading;
              const sys = systems.find(s => s._id?.toString() === d.systemId?.toString());
              const pwr = r?.power ?? 0;
              const pct = maxPower > 0 ? (pwr / maxPower) * 100 : 0;
              const isOnline = d.status === 'online';
              const isAlert  = d.status === 'alert';

              return (
                <div key={d._id} style={{
                  background: 'var(--bg-elev)',
                  border: `1px solid ${isAlert ? 'var(--danger)' : isOnline ? 'var(--border)' : 'var(--border)'}`,
                  borderRadius: 12,
                  overflow: 'hidden',
                  boxShadow: isAlert ? '0 0 0 1px var(--danger-soft)' : 'var(--shadow-sm)',
                }}>
                  {/* Card header */}
                  <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <StatusDot status={d.status} pulse={isOnline} />
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--fg-muted)' }}>
                        {sys ? sys.name : (d.location || '—')}
                      </div>
                    </div>
                    <div style={{
                      padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      background: isOnline ? 'var(--ok-soft)' : isAlert ? 'var(--danger-soft)' : 'var(--neutral-soft)',
                      color: isOnline ? 'var(--ok-soft-fg)' : isAlert ? 'var(--danger-soft-fg)' : 'var(--neutral-soft-fg)',
                    }}>{d.status}</div>
                  </div>

                  {/* Metrics grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--border)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                    {[
                      { label: 'Power',   value: r?.power != null ? fmtPower(r.power) : '—',          color: MC.power },
                      { label: 'Voltage', value: r?.voltage != null ? `${r.voltage.toFixed(1)} V` : '—', color: MC.voltage },
                      { label: 'Current', value: r?.current != null ? `${r.current.toFixed(2)} A` : '—', color: MC.current },
                      { label: 'PF',      value: r?.powerFactor != null ? r.powerFactor.toFixed(3) : '—', color: pfColor(r?.powerFactor) },
                    ].map((m, mi) => (
                      <div key={mi} style={{ padding: '10px 14px', background: 'var(--bg-elev)' }}>
                        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-subtle)', marginBottom: 4 }}>{m.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em', color: m.color, fontVariantNumeric: 'tabular-nums' }}>{m.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Power bar */}
                  <div style={{ padding: '10px 16px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <div style={{ fontSize: 10.5, color: 'var(--fg-muted)' }}>Load share</div>
                      <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>{pct.toFixed(0)}%</div>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-subtle)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 2,
                        width: `${pct}%`,
                        background: isAlert ? 'var(--danger)' : 'var(--energy)',
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                    {d.lastSeenAt && (
                      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--fg-subtle)' }}>
                        Last seen {format(new Date(d.lastSeenAt), 'MMM d, HH:mm')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Devices Tab ────────────────────────────────────────────────────────────────

function DevicesTab({ systems }) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newKey, setNewKey] = useState(null);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['energy-devices'],
    queryFn: () => api.listEnergyDevices(),
  });

  const deleteMut = useMutation({
    mutationFn: api.deleteEnergyDevice,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['energy-devices'] }); qc.invalidateQueries({ queryKey: ['energy-fleet'] }); },
  });

  const rotateMut = useMutation({
    mutationFn: api.rotateEnergyKey,
    onSuccess: d => setNewKey({ apiKey: d.apiKey, deviceId: '(rotated)' }),
  });

  function handleCreated(result) {
    setNewKey({ apiKey: result.apiKey, deviceId: result.id });
    qc.invalidateQueries({ queryKey: ['energy-devices'] });
    qc.invalidateQueries({ queryKey: ['energy-fleet'] });
  }

  const devices = data?.devices || [];
  const sysMap = Object.fromEntries((systems || []).map(s => [s._id?.toString(), s.name]));
  const filtered = search
    ? devices.filter(d =>
        [d.name, d.location, sysMap[d.systemId?.toString()]].some(v =>
          v?.toLowerCase().includes(search.toLowerCase())
        )
      )
    : devices;

  return (
    <div>
      {isLoading ? <Spinner /> : devices.length === 0 ? (
        <Card>
          <Empty icon={IcoCpu} title="No devices" hint="Register an energy monitoring device to start collecting data."
            action={<Btn kind="primary" size="sm" icon={IcoPlus} onClick={() => setShowAdd(true)}>Register device</Btn>} />
        </Card>
      ) : (
        <Card
          title="Energy devices"
          sub={`${filtered.length} of ${devices.length}`}
          actions={<Btn kind="primary" size="sm" icon={IcoPlus} onClick={() => setShowAdd(true)}>Add device</Btn>}
          padding={false}
        >
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
            <div className="search" style={{ width: 220 }}>
              <IcoSearch size={13} />
              <input
                placeholder="Search devices…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Device</th>
                <th>System</th>
                <th>Status</th>
                <th>Power</th>
                <th>Voltage</th>
                <th>Current</th>
                <th>PF</th>
                <th>Last seen</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => {
                const r = d.latestReading;
                return (
                  <tr key={d._id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{d.name}</div>
                      {d.location && <div style={{ fontSize: 11.5, color: 'var(--fg-muted)' }}>{d.location}</div>}
                    </td>
                    <td style={{ color: 'var(--fg-muted)', fontSize: 13 }}>{sysMap[d.systemId?.toString()] || '—'}</td>
                    <td>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                        background: d.status === 'online' ? 'var(--ok-soft)' : d.status === 'alert' ? 'var(--danger-soft)' : 'var(--neutral-soft)',
                        color: d.status === 'online' ? 'var(--ok-soft-fg)' : d.status === 'alert' ? 'var(--danger-soft-fg)' : 'var(--neutral-soft-fg)',
                      }}>
                        <StatusDot status={d.status} pulse={d.status === 'online'} />
                        {d.status}
                      </div>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: MC.power }}>{r?.power != null ? fmtPower(r.power) : '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: MC.voltage }}>{r?.voltage != null ? `${r.voltage.toFixed(1)} V` : '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: MC.current }}>{r?.current != null ? `${r.current.toFixed(2)} A` : '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: pfColor(r?.powerFactor) }}>{r?.powerFactor != null ? r.powerFactor.toFixed(3) : '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{d.lastSeenAt ? format(new Date(d.lastSeenAt), 'MMM d, HH:mm') : 'Never'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <Btn kind="ghost" size="sm" icon={IcoKey} title="Rotate API key"
                          onClick={() => { if (confirm('Rotate key? Current key stops working immediately.')) rotateMut.mutate(d._id); }} />
                        <Btn kind="ghost" size="sm" icon={IcoX} title="Remove"
                          onClick={() => { if (confirm(`Remove "${d.name}"?`)) deleteMut.mutate(d._id); }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {!isLoading && devices.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <Btn kind="primary" size="sm" icon={IcoPlus} onClick={() => setShowAdd(true)}>Add device</Btn>
        </div>
      )}

      {showAdd && <DeviceModal systems={systems} onClose={() => setShowAdd(false)} onCreated={handleCreated} />}
      {newKey && <ApiKeyModal apiKey={newKey.apiKey} deviceId={newKey.deviceId} onClose={() => setNewKey(null)} />}
    </div>
  );
}

// ── Systems Tab ────────────────────────────────────────────────────────────────

function SystemsTab({ systems, fleet, isLoading }) {
  const qc = useQueryClient();
  const [modal, setModal] = useState(null);

  const deleteMut = useMutation({
    mutationFn: api.deleteEnergySystem,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['energy-fleet'] }),
  });

  const devices = fleet?.devices || [];

  function sysDevices(sysId) {
    return devices.filter(d => d.systemId?.toString() === sysId?.toString());
  }

  function sysPower(sysId) {
    return sysDevices(sysId).reduce((s, d) => s + (d.latestReading?.power ?? 0), 0);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--fg-muted)' }}>
          {(systems || []).length} system{(systems || []).length !== 1 ? 's' : ''}
        </div>
        <Btn kind="primary" size="sm" icon={IcoPlus} onClick={() => setModal({})}>New system</Btn>
      </div>

      {isLoading ? <Spinner /> : (systems || []).length === 0 ? (
        <Card>
          <Empty icon={IcoLayers} title="No systems" hint="Group devices into logical systems — buildings, distribution boards, or circuits."
            action={<Btn kind="primary" size="sm" icon={IcoPlus} onClick={() => setModal({})}>New system</Btn>} />
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {(systems || []).map(s => {
            const devs = sysDevices(s._id);
            const totalW = sysPower(s._id);
            const onlineCount = devs.filter(d => d.status === 'online').length;

            return (
              <div key={s._id} style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ height: 4, background: 'var(--energy)' }} />
                <div style={{ padding: '16px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)' }}>{s.name}</div>
                      {s.location && <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2 }}>{s.location}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <Btn kind="ghost" size="sm" icon={IcoSettings} onClick={() => setModal(s)} />
                      <Btn kind="ghost" size="sm" icon={IcoX}
                        onClick={() => { if (confirm(`Delete system "${s.name}"?`)) deleteMut.mutate(s._id); }} />
                    </div>
                  </div>

                  {s.description && (
                    <div style={{ fontSize: 12.5, color: 'var(--fg-muted)', marginBottom: 12, lineHeight: 1.5 }}>{s.description}</div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    {[
                      { l: 'Devices', v: devs.length },
                      { l: 'Online',  v: onlineCount, color: onlineCount > 0 ? 'var(--ok)' : undefined },
                      { l: 'Total W', v: fmtPower(totalW), color: 'var(--energy)' },
                    ].map((st, i) => (
                      <div key={i} style={{ padding: '8px 10px', background: 'var(--bg-subtle)', borderRadius: 8, textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{st.l}</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: st.color || 'var(--fg)', fontVariantNumeric: 'tabular-nums' }}>{st.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal !== null && (
        <SystemModal
          initial={modal._id ? modal : null}
          onClose={() => setModal(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['energy-fleet'] }); setModal(null); }}
        />
      )}
    </div>
  );
}

// ── Data Tab ───────────────────────────────────────────────────────────────────

function DataTab({ devices }) {
  const [deviceId, setDeviceId] = useState('');
  const [range, setRange] = useState('24h');
  const [granularity, setGranularity] = useState('raw');
  const [activeMetrics, setActiveMetrics] = useState(['power', 'voltage']);

  const { from, to } = useMemo(() => {
    const to = new Date();
    const from = range === '7d' ? subDays(to, 7) : range === '30d' ? subDays(to, 30) : subHours(to, 24);
    return { from, to };
  }, [range]);

  const { data, isLoading } = useQuery({
    queryKey: ['energy-readings', deviceId, range, granularity],
    queryFn: () => api.getEnergyReadings({ deviceId, from: from.toISOString(), to: to.toISOString(), granularity, limit: 1000 }),
    enabled: !!deviceId,
  });

  const readings = data?.readings || [];

  const chartSeries = useMemo(() => {
    if (!readings.length) return [];
    return activeMetrics
      .filter(m => readings.some(r => r[m] != null))
      .map(m => ({
        name: METRICS.find(x => x.key === m)?.label || m,
        color: MC[m],
        unit: MU[m],
        data: readings.map(r => ({
          v: r[m] != null ? r[m] : null,
          label: format(new Date(r.timestamp), granularity === 'daily' ? 'MMM d' : 'HH:mm'),
        })),
      }));
  }, [readings, activeMetrics, granularity]);

  function toggleMetric(key) {
    setActiveMetrics(ms => ms.includes(key) ? ms.filter(m => m !== key) : [...ms, key]);
  }

  const selectedDevice = devices.find(d => d._id === deviceId || d._id?.toString() === deviceId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Controls row */}
      <div style={{
        display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
        padding: '14px 18px', background: 'var(--bg-elev)', borderRadius: 12,
        border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
      }}>
        <select className="select" value={deviceId} onChange={e => setDeviceId(e.target.value)} style={{ minWidth: 200 }}>
          <option value="">Select device…</option>
          {(devices || []).map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
        </select>
        <div style={{ width: 1, height: 28, background: 'var(--border)' }} />
        <Seg value={range} onChange={setRange} options={[
          { value: '24h', label: '24h' },
          { value: '7d',  label: '7 days' },
          { value: '30d', label: '30 days' },
        ]} />
        <Seg value={granularity} onChange={setGranularity} options={[
          { value: 'raw',    label: 'Raw' },
          { value: 'hourly', label: 'Hourly' },
          { value: 'daily',  label: 'Daily' },
        ]} />
      </div>

      {!deviceId ? (
        <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-sm)' }}>
          <Empty icon={IcoGauge} title="Select a device" hint="Choose an energy monitoring device to explore its readings and trends." />
        </div>
      ) : isLoading ? (
        <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 12, padding: 32 }}><Spinner /></div>
      ) : readings.length === 0 ? (
        <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <Empty icon={IcoActivity} title="No data in range" hint="No readings found for this device. Try a wider time range." />
        </div>
      ) : (
        <>
          {/* Metric pills + chart */}
          <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>
                {selectedDevice?.name} — {granularity === 'raw' ? 'Raw' : granularity === 'hourly' ? 'Hourly averages' : 'Daily averages'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{readings.length} readings</div>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
              {METRICS.map(({ key, label, unit }) => {
                const active = activeMetrics.includes(key);
                const hasData = readings.some(r => r[key] != null);
                if (!hasData) return null;
                return (
                  <button key={key} onClick={() => toggleMetric(key)} style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
                    border: `1px solid ${active ? MC[key] : 'var(--border)'}`,
                    background: active ? `color-mix(in oklch, ${MC[key]} 12%, transparent)` : 'var(--bg-subtle)',
                    color: active ? MC[key] : 'var(--fg-muted)',
                    transition: 'all 0.12s',
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? MC[key] : 'var(--fg-subtle)', display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }} />
                    {label}{unit ? ` (${unit})` : ''}
                  </button>
                );
              })}
            </div>

            {chartSeries.length > 0 ? (
              <LineChart series={chartSeries} height={280} normalize={chartSeries.length > 1} showLegend />
            ) : (
              <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>
                Select at least one metric above
              </div>
            )}
          </div>

          {/* Table */}
          <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Readings</div>
              <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{readings.length} rows</div>
            </div>
            <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    {activeMetrics.map(m => {
                      const def = METRICS.find(x => x.key === m);
                      return <th key={m}>{def?.label} {def?.unit ? `(${def.unit})` : ''}</th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {readings.slice().reverse().map((r, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)' }}>
                        {format(new Date(r.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                      </td>
                      {activeMetrics.map(m => (
                        <td key={m} style={{ fontFamily: 'var(--font-mono)', color: MC[m], fontWeight: 500 }}>
                          {r[m] != null ? r[m].toFixed(m === 'powerFactor' ? 3 : 2) : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function EnergyPage() {
  const qc = useQueryClient();
  const location = useLocation();
  const tab = new URLSearchParams(location.search).get('tab') || 'overview';

  const { data: fleet, isLoading: fleetLoading } = useQuery({
    queryKey: ['energy-fleet'],
    queryFn: api.getEnergyFleet,
    refetchInterval: 30_000,
  });

  const { data: devicesData } = useQuery({
    queryKey: ['energy-devices'],
    queryFn: () => api.listEnergyDevices(),
  });

  const systems = fleet?.systems || [];
  const devices = fleet?.devices || devicesData?.devices || [];
  const { total = 0, online = 0, totalPower = 0 } = fleet?.summary || {};

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0,
              background: 'linear-gradient(135deg, var(--energy), oklch(0.58 0.22 40))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IcoPower size={17} style={{ color: '#fff' }} />
            </div>
            <h1 className="page__title" style={{ margin: 0 }}>Energy</h1>
          </div>
          <div className="page__sub">
            {totalPower > 0
              ? `${fmtPower(totalPower)} total load · ${online}/${total} devices online`
              : 'Power consumption and load analytics'}
          </div>
        </div>
        <div className="page__actions">
          <Btn kind="ghost" size="sm" icon={IcoRefresh}
            onClick={() => { qc.invalidateQueries({ queryKey: ['energy-fleet'] }); qc.invalidateQueries({ queryKey: ['energy-devices'] }); }}
            title="Refresh" />
        </div>
      </div>

      {tab === 'overview' && <OverviewTab fleet={fleet} isLoading={fleetLoading} />}
      {tab === 'devices'  && <DevicesTab systems={systems} />}
      {tab === 'systems'  && <SystemsTab systems={systems} fleet={fleet} isLoading={fleetLoading} />}
      {tab === 'data'     && <DataTab devices={devices} />}
    </div>
  );
}
