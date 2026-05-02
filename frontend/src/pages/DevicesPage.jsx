import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { api } from '../services/api.js';
import { useAuthStore } from '../store/auth.js';
import { Btn, Badge, StatusDot, Seg, Card, Sparkline, Empty, Spinner } from '../components/ui/index.jsx';
import { IcoPlus, IcoFilter, IcoDownload, IcoLayoutGrid, IcoList, IcoGroup, IcoMore, IcoX, IcoCheck, IcoArrowRight, IcoSearch, IcoMap } from '../components/ui/Icons.jsx';

function rng(seed) {
  let s = seed | 0; if (s === 0) s = 1;
  return () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 0) / 4294967296); };
}
function genSeries(n, base, noise, seed = 1) {
  const r = rng(seed); let v = base;
  return Array.from({ length: n }, () => { v += (r() - 0.5) * noise; return { t: v, v: +v.toFixed(2) }; });
}
// Normalise sparkline data from API hourly buckets → [{t,v}]
function normSpark(arr) {
  if (!arr || !arr.length) return null;
  return arr.map((p, i) => ({ t: i, v: p.v }));
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

function SignalBars({ n }) {
  const bars = n ?? 0;
  return (
    <div className="row gap-1" style={{ alignItems: 'flex-end', height: 14 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{ width: 3, height: 2 + i * 2, background: i <= bars ? 'var(--fg)' : 'var(--border-strong)', borderRadius: 1 }} />
      ))}
    </div>
  );
}

function AddDeviceModal({ groups, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', description: '', groupId: '', lat: '', lon: '', locationName: '' });
  const [error, setError] = useState('');
  const [newKey, setNewKey] = useState('');
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY });
  const [mapSearch, setMapSearch] = useState('');

  function handleMapSearch() {
    if (!mapSearch.trim() || !window.google) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: mapSearch + ', Tanzania' }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const loc = results[0].geometry.location;
        setForm(f => ({ ...f, lat: loc.lat().toFixed(6), lon: loc.lng().toFixed(6) }));
      }
    });
  }

  async function submit(e) {
    e.preventDefault(); setError('');
    try {
      const body = { ...form, lat: form.lat ? parseFloat(form.lat) : undefined, lon: form.lon ? parseFloat(form.lon) : undefined };
      const res = await api.createDevice(body);
      setNewKey(res.apiKey);
    } catch (err) { setError(err.message); }
  }

  if (newKey) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal__head"><div className="modal__title">Device created</div><Btn kind="ghost" size="sm" icon={IcoX} onClick={onClose} /></div>
          <div className="modal__body">
            <div className="muted text-sm" style={{ marginBottom: 10 }}>Save this API key — it won't be shown again:</div>
            <div style={{ background: 'var(--bg-muted)', borderRadius: 6, padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, wordBreak: 'break-all' }}>{newKey}</div>
          </div>
          <div className="modal__foot"><Btn kind="primary" icon={IcoCheck} onClick={() => { onSaved(); onClose(); }}>Done</Btn></div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__head"><div className="modal__title">Add device</div><Btn kind="ghost" size="sm" icon={IcoX} onClick={onClose} /></div>
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
              <div className="field"><label className="field__label">Latitude</label><input type="number" step="any" className="input" value={form.lat} onChange={e => setForm(f => ({ ...f, lat: e.target.value }))} /></div>
              <div className="field"><label className="field__label">Longitude</label><input type="number" step="any" className="input" value={form.lon} onChange={e => setForm(f => ({ ...f, lon: e.target.value }))} /></div>
            </div>
            <div className="field" style={{ marginTop: 12, marginBottom: 12 }}>
              <label className="field__label">Pick location on map</label>
              <div className="row gap-2" style={{ marginBottom: 8 }}>
                <input className="input" placeholder="Search location…" value={mapSearch}
                  onChange={e => setMapSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleMapSearch(); } }} />
                <Btn kind="secondary" size="sm" type="button" onClick={handleMapSearch}>Search</Btn>
              </div>
              {isLoaded && (
                <div style={{ height: 200, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <GoogleMap
                    mapContainerStyle={{ width: '100%', height: '100%' }}
                    center={form.lat && form.lon
                      ? { lat: parseFloat(form.lat), lng: parseFloat(form.lon) }
                      : { lat: -6.369, lng: 34.889 }}
                    zoom={form.lat && form.lon ? 12 : 6}
                    options={{ mapTypeId: 'hybrid', mapTypeControl: false, streetViewControl: false, fullscreenControl: false }}
                    onClick={e => {
                      const lat = e.latLng.lat().toFixed(6);
                      const lng = e.latLng.lng().toFixed(6);
                      setForm(f => ({ ...f, lat, lon: lng }));
                    }}>
                  </GoogleMap>
                </div>
              )}
              {form.lat && form.lon && (
                <div className="text-xs muted" style={{ marginTop: 4 }}>
                  Selected: {form.lat}, {form.lon}
                </div>
              )}
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
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const role = user?.role || 'viewer';
  const [view, setView] = useState('list');
  const [filter, setFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [pageTab, setPageTab] = useState('devices'); // 'devices' | 'firmware'

  const { data, isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: () => api.listDevices({ limit: 100 }),
    refetchInterval: 30_000,
  });
  const { data: groups } = useQuery({ queryKey: ['device-groups'], queryFn: api.listGroups });
  const { data: sparklines } = useQuery({
    queryKey: ['sparklines'],
    queryFn: () => api.getSparklines({ sensorKey: 'temperature' }),
    refetchInterval: 120_000,
  });
  const { data: firmwareList = [], refetch: refetchFirmware } = useQuery({
    queryKey: ['firmware'],
    queryFn: api.listFirmware,
    enabled: pageTab === 'firmware',
  });

  const devices = data?.devices || [];
  const filtered = devices
    .filter(d => filter === 'all' || d.status === filter)
    .filter(d => !search || [d.name, d.serialNumber, d.locationName].some(v => v?.toLowerCase().includes(search.toLowerCase())));

  const counts = {
    total:       devices.length,
    online:      devices.filter(d => d.status === 'online').length,
    alert:       devices.filter(d => d.status === 'alert').length,
    offline:     devices.filter(d => d.status === 'offline').length,
    maintenance: devices.filter(d => d.status === 'maintenance').length,
  };

  // Build group name map from groups data
  const groupNameMap = useMemo(() => {
    const m = {};
    (groups || []).forEach(g => { m[g._id] = g.name; });
    return m;
  }, [groups]);

  // Devices grouped by groupId/name for "By site" view
  const byGroup = useMemo(() => {
    const map = {};
    filtered.forEach(d => {
      const key = d.groupId || 'ungrouped';
      const label = (d.groupId && groupNameMap[d.groupId]) || 'Ungrouped';
      if (!map[key]) map[key] = { label, devices: [] };
      map[key].devices.push(d);
    });
    return Object.entries(map).sort((a, b) => a[1].label.localeCompare(b[1].label));
  }, [filtered, groupNameMap]);

  function getSpark(device, idx) {
    const real = sparklines?.[device._id];
    if (real && real.length > 1) return normSpark(real);
    return genSeries(24, 22 + (idx * 2 % 8), 1.4, idx + 1).map((p, i) => ({ t: i, v: p.v }));
  }

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Devices</h1>
          <div className="page__sub">{counts.total} registered · {counts.online} online · {counts.alert} alerting</div>
        </div>
        <div className="page__actions">
          <Seg value={view} onChange={setView} options={[
            { value: 'list',  label: 'List',    icon: IcoList },
            { value: 'grid',  label: 'Grid',    icon: IcoLayoutGrid },
            { value: 'group', label: 'By site', icon: IcoGroup },
            { value: 'map',   label: 'Map',     icon: IcoMap },
          ]} />
          {(role === 'admin' || role === 'org_admin') && (
            <Btn kind="primary" size="sm" icon={IcoPlus} onClick={() => setShowAdd(true)}>Add device</Btn>
          )}
        </div>
      </div>

      <div className="row gap-3" style={{ marginBottom: 12 }}>
        <Seg value={pageTab} onChange={setPageTab} options={[
          { value: 'devices',  label: 'Devices' },
          { value: 'firmware', label: 'Firmware' },
        ]} />
      </div>

      {pageTab === 'devices' && (<>
        <div className="row gap-2" style={{ marginBottom: 12 }}>
          <Seg value={filter} onChange={setFilter} options={[
            { value: 'all',         label: `All ${counts.total}` },
            { value: 'online',      label: 'Online' },
            { value: 'alert',       label: 'Alerting' },
            { value: 'offline',     label: 'Offline' },
            { value: 'maintenance', label: 'Maintenance' },
          ]} />
          <div style={{ flex: 1 }} />
          <div className="search" style={{ width: 220 }}>
            <IcoSearch size={13} />
            <input placeholder="Search devices…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Btn kind="secondary" size="sm" icon={IcoFilter}>Filters</Btn>
          <Btn kind="ghost" size="sm" icon={IcoDownload}>Export CSV</Btn>
        </div>

        {isLoading ? <Spinner /> : view === 'map' ? (
          <DeviceMapView devices={filtered} onDeviceClick={id => navigate(`/devices/${id}`)} />
        ) : filtered.length === 0 ? (
          <Card><Empty icon={IcoList} title="No devices" hint="Add a device to get started." /></Card>
        ) : view === 'list' ? (
          <DeviceTable devices={filtered} groupNameMap={groupNameMap} getSpark={getSpark} onRowClick={id => navigate(`/devices/${id}`)} />
        ) : view === 'grid' ? (
          <DeviceGrid devices={filtered} getSpark={getSpark} />
        ) : (
          <div className="grid" style={{ gap: 16 }}>
            {byGroup.map(([key, { label, devices: devs }]) => (
              <Card key={key} title={label} sub={`${devs.length} device${devs.length !== 1 ? 's' : ''}`}
                actions={<Btn kind="ghost" size="sm" iconRight={IcoArrowRight}>View site</Btn>}
                padding={false}>
                <DeviceTable devices={devs} groupNameMap={groupNameMap} getSpark={getSpark} onRowClick={id => navigate(`/devices/${id}`)} />
              </Card>
            ))}
          </div>
        )}
      </>)}

      {pageTab === 'firmware' && (
        <FirmwareTab
          firmwareList={firmwareList}
          onRefetch={refetchFirmware}
          role={role}
          devices={devices}
        />
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

function FirmwareTab({ firmwareList, onRefetch, role, devices }) {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [activating, setActivating] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const activeFw = firmwareList.find(f => f.isActive);

  async function handleActivate(id) {
    setActivating(id);
    try {
      await api.activateFirmware(id);
      onRefetch();
    } finally { setActivating(null); }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this firmware version?')) return;
    setDeleting(id);
    try {
      await api.deleteFirmware(id);
      onRefetch();
    } finally { setDeleting(null); }
  }

  const devicesNeedingUpdate = activeFw
    ? devices.filter(d => {
        const dv = (d.firmwareVersion || '0.0.0').split('.').map(Number);
        const av = activeFw.version.split('.').map(Number);
        for (let i = 0; i < 3; i++) {
          const diff = (dv[i] || 0) - (av[i] || 0);
          if (diff < 0) return true;
          if (diff > 0) return false;
        }
        return false;
      }).length
    : 0;

  return (
    <>
      <div className="row gap-3" style={{ marginBottom: 12, alignItems: 'center' }}>
        <div>
          <span className="text-sm font-medium">Firmware management</span>
          {activeFw && <span className="text-xs muted" style={{ marginLeft: 8 }}>Active: <span className="mono">{activeFw.version}</span></span>}
          {devicesNeedingUpdate > 0 && (
            <span style={{ marginLeft: 8 }}><Badge kind="warn">{devicesNeedingUpdate} devices need update</Badge></span>
          )}
        </div>
        <div style={{ flex: 1 }} />
        {(role === 'admin' || role === 'org_admin') && (
          <Btn kind="primary" size="sm" icon={IcoPlus} onClick={() => setShowModal(true)}>Add version</Btn>
        )}
      </div>

      <Card padding={false}>
        <table className="table">
          <thead>
            <tr><th>Version</th><th>Protocol</th><th>URL</th><th>Notes</th><th>Devices</th><th>Status</th><th>Added</th><th></th></tr>
          </thead>
          <tbody>
            {firmwareList.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '32px 14px', color: 'var(--fg-muted)' }}>
                No firmware versions. Add the first version to enable OTA updates.
              </td></tr>
            ) : firmwareList.map(fw => (
              <tr key={fw._id}>
                <td><span className="font-medium mono">{fw.version}</span></td>
                <td><Badge kind="outline">{fw.protocol || 'http'}</Badge></td>
                <td><span className="text-xs mono muted" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{fw.fileUrl}</span></td>
                <td className="muted text-xs">{fw.releaseNotes || '—'}</td>
                <td className="muted text-xs">{fw.upToDateCount || 0} up to date{fw.needsUpdateCount > 0 ? `, ${fw.needsUpdateCount} pending` : ''}</td>
                <td>
                  {fw.isActive
                    ? <Badge kind="ok" dot="ok">Active</Badge>
                    : <Badge kind="neutral">Inactive</Badge>}
                </td>
                <td className="muted text-xs">{fw.createdAt ? new Date(fw.createdAt).toLocaleDateString() : '—'}</td>
                <td>
                  <div className="row gap-2">
                    {!fw.isActive && (role === 'admin' || role === 'org_admin') && (
                      <Btn kind="secondary" size="sm"
                        disabled={activating === fw._id}
                        onClick={() => handleActivate(fw._id)}>
                        {activating === fw._id ? '…' : 'Set active'}
                      </Btn>
                    )}
                    {!fw.isActive && (role === 'admin' || role === 'org_admin') && (
                      <Btn kind="danger" size="sm"
                        disabled={deleting === fw._id}
                        onClick={() => handleDelete(fw._id)}>
                        Delete
                      </Btn>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {showModal && (
        <AddFirmwareModal
          onClose={() => setShowModal(false)}
          onSaved={onRefetch}
        />
      )}
    </>
  );
}

function AddFirmwareModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ version: '', fileUrl: '', releaseNotes: '', protocol: 'http' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault(); setError('');
    setLoading(true);
    try {
      await api.createFirmware(form);
      onSaved();
      onClose();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">Add firmware version</div>
          <Btn kind="ghost" size="sm" icon={IcoX} onClick={onClose} />
        </div>
        <div className="modal__body">
          {error && <div className="error-banner">{error}</div>}
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field__label">Version *</label>
            <input required className="input mono" placeholder="e.g. 2.5.0" value={form.version}
              onChange={e => setForm(f => ({ ...f, version: e.target.value }))} />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field__label">Download URL *</label>
            <input required className="input" placeholder="https://…/firmware-2.5.0.bin" value={form.fileUrl}
              onChange={e => setForm(f => ({ ...f, fileUrl: e.target.value }))} />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field__label">Protocol</label>
            <Seg value={form.protocol} onChange={v => setForm(f => ({ ...f, protocol: v }))}
              options={[{ value: 'http', label: 'HTTP' }, { value: 'mqtt', label: 'MQTT' }]} />
          </div>
          <div className="field">
            <label className="field__label">Release notes</label>
            <textarea className="textarea" rows={3} value={form.releaseNotes}
              onChange={e => setForm(f => ({ ...f, releaseNotes: e.target.value }))}
              placeholder="What changed in this version…" />
          </div>
        </div>
        <div className="modal__foot">
          <Btn kind="secondary" onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" icon={IcoCheck} onClick={submit} disabled={loading}>
            {loading ? 'Adding…' : 'Add version'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

function DeviceTable({ devices, groupNameMap, getSpark, onRowClick }) {
  return (
    <Card padding={false}>
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 32 }}></th>
            <th>Device</th>
            <th>Site</th>
            <th>Group</th>
            <th>24h activity</th>
            <th>Last seen</th>
            <th>Battery</th>
            <th>Signal</th>
            <th>Firmware</th>
            <th>Protocol</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {devices.map((d, i) => {
            const groupName = (d.groupId && groupNameMap?.[d.groupId]) || '—';
            const sparkData = getSpark(d, i);
            return (
              <tr key={d._id} style={{ cursor: 'pointer' }} onClick={() => onRowClick?.(d._id)}>
                <td><StatusDot status={d.status} pulse={d.status === 'alert'} /></td>
                <td>
                  <div style={{ fontWeight: 500 }}>{d.name}</div>
                  <div className="text-xs mono muted">{d.serialNumber || d._id.toString().slice(-8)}</div>
                </td>
                <td className="muted">{d.locationName || '—'}</td>
                <td><Badge kind="outline">{groupName}</Badge></td>
                <td style={{ width: 110 }}>
                  <Sparkline data={sparkData} color={d.status === 'alert' ? 'var(--danger)' : 'var(--accent)'} height={26} animate={false} />
                </td>
                <td className="muted text-xs">
                  {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}
                </td>
                <td><BatteryBar pct={d.batteryLevel} /></td>
                <td><SignalBars n={d.signalStrength} /></td>
                <td className="muted mono text-xs">{d.firmwareVersion || '—'}</td>
                <td><Badge kind="outline">{d.protocol || 'http'}</Badge></td>
                <td style={{ width: 32 }}><Btn kind="ghost" size="sm" icon={IcoMore} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

// ─── Map view ────────────────────────────────────────────────────────────────
const STATUS_COLORS = { online: '#22c55e', offline: '#94a3b8', alert: '#ef4444', maintenance: '#f59e0b' };

function buildPin(status, selected) {
  const c = STATUS_COLORS[status] || '#94a3b8';
  const w = selected ? 38 : 30, h = Math.round((selected ? 38 : 30) * 1.28);
  const cx = w / 2, cy = Math.round(w * 0.44);
  const r1 = Math.round(w * 0.44), r2 = Math.round(w * 0.25), r3 = Math.round(w * 0.12);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs><filter id="s"><feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="rgba(0,0,0,0.6)"/></filter></defs>
    ${selected ? `<circle cx="${cx}" cy="${cy}" r="${r1 + 5}" fill="${c}" fill-opacity="0.2"/>` : ''}
    <path d="M${cx} 2C${cx - r1} 2 ${cx - r1 - 1} ${cy - r1 + 1} ${cx - r1 - 1} ${cy}c0 ${Math.round(r1 * 1.5)} ${r1 + 1} ${Math.round(r1 * 2.3)} ${r1 + 1} ${Math.round(r1 * 2.3)}S${cx + r1 + 1} ${cy + Math.round(r1 * 1.5)} ${cx + r1 + 1} ${cy}C${cx + r1 + 1} ${cy - r1 + 1} ${cx + r1} 2 ${cx} 2z"
      fill="white" filter="url(#s)"/>
    <path d="M${cx} 4C${cx - r1 + 1} 4 ${cx - r1} ${cy - r1 + 2} ${cx - r1} ${cy}c0 ${Math.round(r1 * 1.4)} ${r1} ${Math.round(r1 * 2.2)} ${r1} ${Math.round(r1 * 2.2)}S${cx + r1} ${cy + Math.round(r1 * 1.4)} ${cx + r1} ${cy}C${cx + r1} ${cy - r1 + 2} ${cx + r1 - 1} 4 ${cx} 4z"
      fill="${c}"/>
    <circle cx="${cx}" cy="${cy}" r="${r2}" fill="white" fill-opacity="0.92"/>
    <circle cx="${cx}" cy="${cy}" r="${r3}" fill="${c}"/>
    ${status === 'alert' ? `<text x="${cx}" y="${cy + 4}" font-size="${Math.round(w * 0.28)}" font-weight="900" font-family="Arial,sans-serif" text-anchor="middle" fill="white">!</text>` : ''}
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: { width: w, height: h },
    anchor: { x: cx, y: h - 1 },
  };
}

function DeviceMapView({ devices, onDeviceClick }) {
  const navigate = useNavigate();
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY });
  const [map, setMap] = useState(null);
  const [selected, setSelected] = useState(null);
  const markersRef = useRef([]);
  const clustererRef = useRef(null);
  const markerMap = useRef({});
  const fitDone = useRef(false);

  const onMapLoad = useCallback(m => setMap(m), []);

  useEffect(() => {
    if (!map || !window.google) return;
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    markerMap.current = {};
    if (clustererRef.current) { clustererRef.current.clearMarkers(); clustererRef.current = null; }

    const positioned = devices.filter(d => d.location?.coordinates);
    const newMarkers = positioned.map(device => {
      const [lng, lat] = device.location.coordinates;
      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        icon: buildPin(device.status, false),
        title: device.name,
        optimized: true,
        zIndex: device.status === 'alert' ? 100 : device.status === 'online' ? 50 : 10,
      });
      marker.addListener('click', () => setSelected(d => {
        const same = d?._id?.toString() === device._id?.toString();
        return same ? null : device;
      }));
      markerMap.current[device._id?.toString()] = marker;
      return marker;
    });
    markersRef.current = newMarkers;
    if (newMarkers.length) clustererRef.current = new MarkerClusterer({ map, markers: newMarkers });

    if (!fitDone.current && positioned.length) {
      fitDone.current = true;
      const bounds = new window.google.maps.LatLngBounds();
      positioned.forEach(d => bounds.extend({ lat: d.location.coordinates[1], lng: d.location.coordinates[0] }));
      map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
      setTimeout(() => { if (map.getZoom() > 12) map.setZoom(12); }, 400);
    }
  }, [map, devices]);

  useEffect(() => {
    devices.filter(d => d.location?.coordinates).forEach(device => {
      const marker = markerMap.current[device._id?.toString()];
      if (!marker) return;
      const isSelected = selected?._id?.toString() === device._id?.toString();
      marker.setIcon(buildPin(device.status, isSelected));
    });
  }, [selected, devices]);

  const withCoords = devices.filter(d => d.location?.coordinates).length;

  return (
    <div style={{ position: 'relative' }}>
      {/* Status strip */}
      <div className="row gap-3" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
        <span className="text-xs muted">{withCoords} of {devices.length} devices on map</span>
        {[
          { s: 'online', l: 'Online', cls: 'dot--ok' },
          { s: 'alert', l: 'Alert', cls: 'dot--danger' },
          { s: 'offline', l: 'Offline', cls: 'dot--off' },
        ].map(({ s, l, cls }) => {
          const n = devices.filter(d => d.status === s).length;
          return n > 0 ? (
            <span key={s} className="row gap-1 text-xs muted">
              <span className={`dot ${cls}`} /> {n} {l}
            </span>
          ) : null;
        })}
      </div>

      {/* Map + side panel */}
      <div style={{ display: 'flex', gap: 0, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', height: 520 }}>
        <div style={{ flex: 1 }}>
          {!isLoaded ? (
            <div style={{ height: '100%', background: 'var(--bg-subtle)', display: 'grid', placeItems: 'center' }}><Spinner /></div>
          ) : (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={{ lat: -6.4, lng: 35.7 }}
              zoom={6}
              options={{ mapTypeId: 'hybrid', zoomControl: true, mapTypeControl: false, streetViewControl: false, fullscreenControl: false }}
              onLoad={onMapLoad}
              onClick={() => setSelected(null)}>
            </GoogleMap>
          )}
        </div>

        {/* Side panel */}
        {selected && (
          <div style={{ width: 260, borderLeft: '1px solid var(--border)', background: 'var(--bg-elev)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="row gap-2">
                <StatusDot status={selected.status} />
                <span style={{ fontWeight: 600, fontSize: 13 }}>{selected.name}</span>
              </div>
              <button className="btn btn--ghost btn--icon btn--sm" onClick={() => setSelected(null)}>
                <IcoX size={13} />
              </button>
            </div>
            <div style={{ padding: '8px 12px', flex: 1, overflow: 'auto' }}>
              <div className="text-xs muted">{selected.locationName || selected.address || '—'}</div>
              {selected.location?.coordinates && (
                <div className="text-xs subtle mono" style={{ marginTop: 2 }}>
                  {selected.location.coordinates[1].toFixed(4)}, {selected.location.coordinates[0].toFixed(4)}
                </div>
              )}
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  { l: 'Status',    v: selected.status },
                  { l: 'Firmware',  v: selected.firmwareVersion || selected.firmware || '—' },
                  { l: 'Protocol',  v: selected.protocol || 'http' },
                  { l: 'Last seen', v: selected.lastSeenAt ? new Date(selected.lastSeenAt).toLocaleTimeString() : '—' },
                ].map(row => (
                  <div key={row.l} className="row gap-2" style={{ justifyContent: 'space-between' }}>
                    <span className="text-xs muted">{row.l}</span>
                    <span className="text-xs mono">{row.v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: 10, borderTop: '1px solid var(--border)' }}>
              <Btn kind="primary" full size="sm" iconRight={IcoArrowRight} onClick={() => navigate(`/devices/${selected._id}`)}>
                Open device
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DeviceGrid({ devices, getSpark }) {
  return (
    <div className="grid grid-cols-3">
      {devices.map((d, i) => (
        <div key={d._id} className="card" style={{ padding: 14 }}>
          <div className="row gap-2" style={{ justifyContent: 'space-between' }}>
            <div className="row gap-2">
              <StatusDot status={d.status} pulse={d.status === 'alert'} />
              <span style={{ fontWeight: 500 }}>{d.name}</span>
            </div>
            <Badge kind="outline">{d.groupName || '—'}</Badge>
          </div>
          <div className="text-xs mono muted" style={{ marginTop: 2 }}>{d.serialNumber || d._id.toString().slice(-8)}</div>
          <div style={{ marginTop: 10 }}>
            <Sparkline data={getSpark(d, i)} color={d.status === 'alert' ? 'var(--danger)' : 'var(--accent)'} height={40} fill animate={false} />
          </div>
          <div className="row gap-3" style={{ marginTop: 10, justifyContent: 'space-between' }}>
            <BatteryBar pct={d.batteryLevel} />
            <SignalBars n={d.signalStrength} />
            <span className="text-xs muted">
              {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
