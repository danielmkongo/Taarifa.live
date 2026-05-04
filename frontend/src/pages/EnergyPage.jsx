import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api.js';
import { Btn, Badge, StatusDot, Card, Seg, LineChart, Empty, Spinner } from '../components/ui/index.jsx';
import {
  IcoPlus, IcoX, IcoKey, IcoPower, IcoCpu, IcoCheck, IcoRefresh,
  IcoCopy, IcoLayers, IcoSettings, IcoMore, IcoGauge, IcoActivity,
} from '../components/ui/Icons.jsx';
import { format, subHours, subDays } from 'date-fns';

const METRIC_COLORS = {
  power:       'oklch(0.68 0.18 55)',
  voltage:     'oklch(0.62 0.16 258)',
  current:     'oklch(0.60 0.20 22)',
  powerFactor: 'oklch(0.62 0.15 155)',
  energy:      'oklch(0.60 0.16 305)',
};
const METRIC_UNITS = { power: 'W', voltage: 'V', current: 'A', powerFactor: '', energy: 'kWh' };
const METRICS = [
  { key: 'power', label: 'Power' },
  { key: 'voltage', label: 'Voltage' },
  { key: 'current', label: 'Current' },
  { key: 'powerFactor', label: 'Power Factor' },
  { key: 'energy', label: 'Energy' },
];

function statusKind(s) {
  return s === 'online' ? 'ok' : s === 'alert' ? 'danger' : 'neutral';
}

function copyToClipboard(text) {
  navigator.clipboard?.writeText(text).catch(() => {});
}

// ── Add / Edit System Modal ────────────────────────────────────────────────────

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
      if (isEdit) {
        await api.updateEnergySystem(initial._id, form);
      } else {
        await api.createEnergySystem(form);
      }
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

// ── Add / Edit Device Modal ────────────────────────────────────────────────────

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
      onCreated(result);
      onClose();
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
            <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: 8, fontSize: 12, color: 'var(--fg-muted)' }}>
              An API key will be generated after registration. The device authenticates via the <code style={{ fontFamily: 'var(--font-mono)' }}>x-api-key</code> header when posting readings.
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

// ── API Key Display Modal ──────────────────────────────────────────────────────

function ApiKeyModal({ apiKey, deviceId, onClose }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    copyToClipboard(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">Device registered</div>
          <Btn kind="ghost" size="sm" icon={IcoX} onClick={onClose} />
        </div>
        <div className="modal__body">
          <div style={{ padding: '14px 16px', background: 'var(--ok-soft)', borderRadius: 8, marginBottom: 16, fontSize: 13, color: 'var(--ok-soft-fg)' }}>
            Device created successfully. Copy the API key below — it will not be shown again.
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field__label">Device ID</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input readOnly className="input" value={deviceId} style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} />
              <Btn kind="ghost" size="sm" icon={IcoCopy} onClick={() => copyToClipboard(deviceId)} />
            </div>
          </div>
          <div className="field">
            <label className="field__label">API Key</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input readOnly className="input" value={apiKey} style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} />
              <Btn kind={copied ? 'ok' : 'primary'} size="sm" icon={copied ? IcoCheck : IcoCopy} onClick={copy}>
                {copied ? 'Copied' : 'Copy'}
              </Btn>
            </div>
          </div>
          <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: 8, fontSize: 12, color: 'var(--fg-muted)' }}>
            <strong style={{ color: 'var(--fg)' }}>Ingest endpoint:</strong> <code style={{ fontFamily: 'var(--font-mono)' }}>POST /api/v1/energy/ingest/{'{deviceId}'}</code>
            <br />Send JSON with <code style={{ fontFamily: 'var(--font-mono)' }}>voltage, current, power, powerFactor, energy</code> fields and <code style={{ fontFamily: 'var(--font-mono)' }}>x-api-key</code> header.
          </div>
        </div>
        <div className="modal__foot">
          <Btn kind="primary" onClick={onClose}>Done</Btn>
        </div>
      </div>
    </div>
  );
}

// ── Overview Tab ───────────────────────────────────────────────────────────────

function OverviewTab({ fleet, isLoading }) {
  if (isLoading) return <Spinner />;

  const { devices = [], systems = [], summary = {} } = fleet || {};
  const { total = 0, online = 0, offline = 0, alert = 0, totalPower = 0, avgPF, totalEnergy = 0 } = summary;

  return (
    <div>
      <div className="grid grid-cols-4" style={{ gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Power', value: totalPower >= 1000 ? `${(totalPower / 1000).toFixed(2)} kW` : `${totalPower.toFixed(1)} W`, sub: `across ${online} online device${online !== 1 ? 's' : ''}`, color: 'var(--energy)' },
          { label: 'Avg Power Factor', value: avgPF != null ? avgPF.toFixed(3) : '—', sub: avgPF != null ? (avgPF >= 0.9 ? 'Excellent' : avgPF >= 0.8 ? 'Good' : 'Poor') : 'No data', color: avgPF >= 0.9 ? 'var(--ok)' : avgPF >= 0.8 ? 'var(--warn)' : 'var(--danger)' },
          { label: 'Total Energy', value: `${totalEnergy.toFixed(1)} kWh`, sub: 'from latest readings', color: 'var(--accent)' },
          { label: 'Fleet', value: total, sub: `${online} online · ${alert} alert · ${offline} offline`, color: online > 0 ? 'var(--ok)' : 'var(--fg-muted)' },
        ].map((kpi, i) => (
          <div key={i} className="card" style={{ padding: '20px' }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-muted)', marginBottom: 10 }}>{kpi.label}</div>
            <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, color: kpi.color, fontVariantNumeric: 'tabular-nums' }}>{kpi.value}</div>
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--fg-muted)' }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      <Card title="Device fleet" sub={`${total} device${total !== 1 ? 's' : ''}`} padding={false}>
        {devices.length === 0 ? (
          <Empty icon={IcoCpu} title="No devices yet" hint="Register your first energy monitoring device." />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Device</th>
                <th>System</th>
                <th>Status</th>
                <th>Power</th>
                <th>Voltage</th>
                <th>PF</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {devices.map(d => {
                const r = d.latestReading;
                const sys = systems.find(s => s._id?.toString() === d.systemId?.toString());
                return (
                  <tr key={d._id}>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{d.name}</div>
                      {d.location && <div className="text-xs muted">{d.location}</div>}
                    </td>
                    <td className="muted">{sys?.name || '—'}</td>
                    <td>
                      <span className={`badge badge--${statusKind(d.status)}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <StatusDot status={d.status} pulse={d.status === 'online'} />
                        {d.status}
                      </span>
                    </td>
                    <td className="mono">{r?.power != null ? `${r.power.toFixed(1)} W` : '—'}</td>
                    <td className="mono">{r?.voltage != null ? `${r.voltage.toFixed(1)} V` : '—'}</td>
                    <td className="mono">{r?.powerFactor != null ? r.powerFactor.toFixed(3) : '—'}</td>
                    <td className="muted text-xs">{d.lastSeenAt ? format(new Date(d.lastSeenAt), 'MMM d, HH:mm') : 'Never'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// ── Devices Tab ────────────────────────────────────────────────────────────────

function DevicesTab({ systems }) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newKey, setNewKey] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['energy-devices'],
    queryFn: () => api.listEnergyDevices(),
  });

  const deleteMut = useMutation({
    mutationFn: api.deleteEnergyDevice,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['energy-devices'] }),
  });

  const rotateMut = useMutation({
    mutationFn: api.rotateEnergyKey,
    onSuccess: (data) => setNewKey({ apiKey: data.apiKey }),
  });

  function handleCreated(result) {
    setNewKey({ apiKey: result.apiKey, deviceId: result.id });
    qc.invalidateQueries({ queryKey: ['energy-devices'] });
    qc.invalidateQueries({ queryKey: ['energy-fleet'] });
  }

  const devices = data?.devices || [];
  const sysMap = Object.fromEntries((systems || []).map(s => [s._id?.toString(), s.name]));

  return (
    <div>
      <Card
        title="Energy devices"
        sub={`${devices.length} registered`}
        actions={<Btn kind="primary" size="sm" icon={IcoPlus} onClick={() => setShowAdd(true)}>Add device</Btn>}
        padding={false}
      >
        {isLoading ? <Spinner /> : devices.length === 0 ? (
          <Empty icon={IcoCpu} title="No devices" hint="Register an energy monitoring device to get started."
            action={<Btn kind="primary" size="sm" icon={IcoPlus} onClick={() => setShowAdd(true)}>Add device</Btn>} />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Device</th>
                <th>System</th>
                <th>Protocol</th>
                <th>Status</th>
                <th>Power</th>
                <th>Energy</th>
                <th>Last seen</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {devices.map(d => {
                const r = d.latestReading;
                return (
                  <tr key={d._id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{d.name}</div>
                      {d.description && <div className="text-xs muted">{d.description}</div>}
                    </td>
                    <td className="muted">{sysMap[d.systemId?.toString()] || '—'}</td>
                    <td><Badge kind="neutral">{d.protocol}</Badge></td>
                    <td>
                      <span className={`badge badge--${statusKind(d.status)}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <StatusDot status={d.status} pulse={d.status === 'online'} />
                        {d.status}
                      </span>
                    </td>
                    <td className="mono">{r?.power != null ? `${r.power.toFixed(1)} W` : '—'}</td>
                    <td className="mono">{r?.energy != null ? `${r.energy.toFixed(2)} kWh` : '—'}</td>
                    <td className="muted text-xs">{d.lastSeenAt ? format(new Date(d.lastSeenAt), 'MMM d, HH:mm') : 'Never'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Btn kind="ghost" size="sm" icon={IcoKey} title="Rotate API key"
                          onClick={() => { if (confirm('Rotate API key? The current key will stop working immediately.')) rotateMut.mutate(d._id); }} />
                        <Btn kind="ghost" size="sm" icon={IcoX} title="Remove device"
                          onClick={() => { if (confirm(`Remove "${d.name}"?`)) deleteMut.mutate(d._id); }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {showAdd && (
        <DeviceModal
          systems={systems}
          onClose={() => setShowAdd(false)}
          onCreated={handleCreated}
        />
      )}
      {newKey && (
        <ApiKeyModal
          apiKey={newKey.apiKey}
          deviceId={newKey.deviceId || '(rotated)'}
          onClose={() => setNewKey(null)}
        />
      )}
    </div>
  );
}

// ── Systems Tab ────────────────────────────────────────────────────────────────

function SystemsTab({ systems, devicesData, isLoading }) {
  const qc = useQueryClient();
  const [modal, setModal] = useState(null);

  const deleteMut = useMutation({
    mutationFn: api.deleteEnergySystem,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['energy-fleet'] }),
  });

  const devices = devicesData?.devices || [];

  function deviceCount(sysId) {
    return devices.filter(d => d.systemId?.toString() === sysId?.toString()).length;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: 'var(--fg-muted)' }}>{(systems || []).length} system{(systems || []).length !== 1 ? 's' : ''}</div>
        <Btn kind="primary" size="sm" icon={IcoPlus} onClick={() => setModal({})}>New system</Btn>
      </div>

      {isLoading ? <Spinner /> : (systems || []).length === 0 ? (
        <Empty icon={IcoLayers} title="No systems" hint="Group your devices into systems (buildings, circuits, plants)."
          action={<Btn kind="primary" size="sm" icon={IcoPlus} onClick={() => setModal({})}>New system</Btn>} />
      ) : (
        <div className="grid grid-cols-3" style={{ gap: 16 }}>
          {(systems || []).map(s => (
            <div key={s._id} className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--energy-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--energy)' }}>
                  <IcoLayers size={18} />
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <Btn kind="ghost" size="sm" icon={IcoSettings} onClick={() => setModal(s)} />
                  <Btn kind="ghost" size="sm" icon={IcoX} onClick={() => { if (confirm(`Delete system "${s.name}"?`)) deleteMut.mutate(s._id); }} />
                </div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg)', marginBottom: 4 }}>{s.name}</div>
              {s.description && <div style={{ fontSize: 12.5, color: 'var(--fg-muted)', marginBottom: 8 }}>{s.description}</div>}
              {s.location && <div style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>{s.location}</div>}
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--fg-muted)' }}>
                <Badge kind="neutral">{deviceCount(s._id)} device{deviceCount(s._id) !== 1 ? 's' : ''}</Badge>
              </div>
            </div>
          ))}
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
    const from = range === '24h' ? subHours(to, 24)
      : range === '7d'  ? subDays(to, 7)
      : range === '30d' ? subDays(to, 30)
      : subHours(to, 24);
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
        name: `${m.charAt(0).toUpperCase() + m.slice(1)} (${METRIC_UNITS[m] || m})`,
        color: METRIC_COLORS[m],
        unit: METRIC_UNITS[m],
        data: readings.map(r => ({
          v: r[m] != null ? r[m] : null,
          label: format(new Date(r.timestamp), granularity === 'daily' ? 'MMM d' : granularity === 'hourly' ? 'HH:mm' : 'HH:mm'),
        })),
      }));
  }, [readings, activeMetrics, granularity]);

  function toggleMetric(key) {
    setActiveMetrics(ms => ms.includes(key) ? ms.filter(m => m !== key) : [...ms, key]);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card title="Readings explorer" actions={
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select className="select" value={deviceId} onChange={e => setDeviceId(e.target.value)} style={{ width: 200 }}>
            <option value="">Select device…</option>
            {(devices || []).map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
          <Seg value={range} onChange={setRange} options={[
            { value: '24h', label: '24h' },
            { value: '7d', label: '7d' },
            { value: '30d', label: '30d' },
          ]} />
          <Seg value={granularity} onChange={setGranularity} options={[
            { value: 'raw', label: 'Raw' },
            { value: 'hourly', label: 'Hourly' },
            { value: 'daily', label: 'Daily' },
          ]} />
        </div>
      }>
        {!deviceId ? (
          <Empty icon={IcoGauge} title="Select a device" hint="Choose an energy device to explore its readings." />
        ) : isLoading ? (
          <Spinner />
        ) : readings.length === 0 ? (
          <Empty icon={IcoActivity} title="No data" hint="No readings found for this device in the selected time range." />
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {METRICS.map(({ key, label }) => (
                <button key={key}
                  onClick={() => toggleMetric(key)}
                  style={{
                    padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    border: `1px solid ${activeMetrics.includes(key) ? METRIC_COLORS[key] : 'var(--border)'}`,
                    background: activeMetrics.includes(key) ? `${METRIC_COLORS[key]}22` : 'var(--bg-subtle)',
                    color: activeMetrics.includes(key) ? METRIC_COLORS[key] : 'var(--fg-muted)',
                    transition: 'all 0.12s',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {chartSeries.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <LineChart series={chartSeries} height={260} normalize={chartSeries.length > 1} showLegend />
              </div>
            )}
          </>
        )}
      </Card>

      {deviceId && readings.length > 0 && (
        <Card title="Raw readings" sub={`${readings.length} rows`} padding={false}>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  {activeMetrics.map(m => (
                    <th key={m}>{m.charAt(0).toUpperCase() + m.slice(1)} {METRIC_UNITS[m] ? `(${METRIC_UNITS[m]})` : ''}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {readings.slice().reverse().map((r, i) => (
                  <tr key={i}>
                    <td className="mono text-xs">{format(new Date(r.timestamp), 'yyyy-MM-dd HH:mm:ss')}</td>
                    {activeMetrics.map(m => (
                      <td key={m} className="mono">{r[m] != null ? r[m].toFixed(m === 'powerFactor' ? 3 : 2) : '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function EnergyPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('overview');

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

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Energy Monitoring</h1>
          <div className="page__sub">
            {fleet?.summary ? `${fleet.summary.total} device${fleet.summary.total !== 1 ? 's' : ''} · ${fleet.summary.online} online` : 'Power consumption and load analytics'}
          </div>
        </div>
        <div className="page__actions">
          <Seg value={tab} onChange={setTab} options={[
            { value: 'overview', label: 'Overview' },
            { value: 'devices',  label: 'Devices'  },
            { value: 'systems',  label: 'Systems'  },
            { value: 'data',     label: 'Data'     },
          ]} />
          <Btn kind="ghost" size="sm" icon={IcoRefresh} onClick={() => qc.invalidateQueries({ queryKey: ['energy-fleet'] })} title="Refresh" />
        </div>
      </div>

      {tab === 'overview' && <OverviewTab fleet={fleet} isLoading={fleetLoading} />}
      {tab === 'devices'  && <DevicesTab systems={systems} />}
      {tab === 'systems'  && <SystemsTab systems={systems} devicesData={devicesData} isLoading={fleetLoading} />}
      {tab === 'data'     && <DataTab devices={devices} />}
    </div>
  );
}
