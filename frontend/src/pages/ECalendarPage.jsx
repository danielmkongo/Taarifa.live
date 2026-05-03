import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api.js';
import { format, formatDistanceToNow, isAfter, isBefore } from 'date-fns';
import { Btn, Badge, StatusDot, Card, Empty } from '../components/ui/index.jsx';
import {
  IcoPlus, IcoMonitor, IcoMore, IcoX, IcoCheck,
  IcoArrowRight, IcoSettings, IcoRefresh,
  IcoZap, IcoFlame,
} from '../components/ui/Icons.jsx';

// ─── Priority config ───────────────────────────────────────────────────────────
const PRIORITIES = [
  { value: 'critical', label: 'Critical',    color: 'var(--red,  #ef4444)', kind: 'error'   },
  { value: 'high',     label: 'High',        color: 'var(--amber, #f59e0b)', kind: 'warning' },
  { value: 'normal',   label: 'Normal',      color: 'var(--blue,  #3b82f6)', kind: 'info'    },
  { value: 'low',      label: 'Low',         color: 'var(--fg-muted)',        kind: 'neutral' },
];

const CONTENT_TYPES = ['announcement', 'emergency', 'news', 'event', 'advertisement', 'weather'];
const ZONES         = ['main', 'header', 'ticker', 'sidebar', 'footer'];

function priorityBadge(p) {
  const cfg = PRIORITIES.find(x => x.value === p) || PRIORITIES[2];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
      background: `color-mix(in oklch, ${cfg.color} 14%, transparent)`,
      color: cfg.color, border: `1px solid color-mix(in oklch, ${cfg.color} 30%, transparent)`,
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {p === 'critical' && <IcoFlame size={10} />}
      {p === 'high' && <IcoZap size={10} />}
      {cfg.label}
    </span>
  );
}

function contentStatus(c) {
  const now = new Date();
  const start = c.schedule?.startAt ? new Date(c.schedule.startAt) : null;
  const end   = c.schedule?.endAt   ? new Date(c.schedule.endAt)   : null;
  if (!c.isActive) return { label: 'Inactive', kind: 'neutral' };
  if (start && isAfter(start, now)) return { label: 'Scheduled', kind: 'info' };
  if (end && isBefore(end, now))   return { label: 'Ended',     kind: 'neutral' };
  return { label: 'Live', kind: 'ok', dot: true };
}

// ─── Content modal ─────────────────────────────────────────────────────────────
function ContentModal({ onClose, onSaved, groups = [], devices = [], initial = null }) {
  const [form, setForm] = useState(initial || {
    title:     '', type: 'announcement', priority: 'normal', zone: 'main',
    body:      '', mediaUrl: '',
    targetScope: 'global', targetId: '',
    startAt:   '', endAt: '',
    durationS: 30,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      const payload = {
        type:      form.type,
        title:     form.title,
        body:      form.body || undefined,
        mediaUrl:  form.mediaUrl || undefined,
        priority:  form.priority,
        zone:      form.zone,
        target:    { scope: form.targetScope, id: form.targetId || undefined },
        schedule:  { startAt: form.startAt || undefined, endAt: form.endAt || undefined },
        durationS: Number(form.durationS),
      };
      if (initial?._id) {
        await api.updateEcalContent(initial._id, payload);
      } else {
        await api.createEcalContent(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">{initial ? 'Edit content' : 'New content item'}</div>
          <Btn kind="ghost" size="sm" icon={IcoX} onClick={onClose} />
        </div>
        <form onSubmit={submit}>
          <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {error && <div className="error-banner">{error}</div>}

            <div className="field">
              <label className="field__label">Title *</label>
              <input required className="input" value={form.title}
                onChange={e => set('title', e.target.value)} />
            </div>

            <div className="row gap-3">
              <div className="field" style={{ flex: 1 }}>
                <label className="field__label">Type</label>
                <select className="select" value={form.type} onChange={e => set('type', e.target.value)}>
                  {CONTENT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label className="field__label">Priority</label>
                <select className="select" value={form.priority} onChange={e => set('priority', e.target.value)}>
                  {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label className="field__label">Zone</label>
                <select className="select" value={form.zone} onChange={e => set('zone', e.target.value)}>
                  {ZONES.map(z => <option key={z}>{z}</option>)}
                </select>
              </div>
            </div>

            <div className="field">
              <label className="field__label">Body text</label>
              <textarea className="textarea" rows={3} value={form.body}
                onChange={e => set('body', e.target.value)} />
            </div>

            <div className="field">
              <label className="field__label">Media URL (optional)</label>
              <input className="input" value={form.mediaUrl} placeholder="https://…"
                onChange={e => set('mediaUrl', e.target.value)} />
            </div>

            <div className="row gap-3">
              <div className="field" style={{ flex: 1 }}>
                <label className="field__label">Target</label>
                <select className="select" value={form.targetScope} onChange={e => { set('targetScope', e.target.value); set('targetId', ''); }}>
                  <option value="global">All screens (global)</option>
                  <option value="group">Device group</option>
                  <option value="device">Specific screen</option>
                </select>
              </div>
              {form.targetScope === 'group' && (
                <div className="field" style={{ flex: 1 }}>
                  <label className="field__label">Group</label>
                  <select className="select" value={form.targetId} onChange={e => set('targetId', e.target.value)}>
                    <option value="">— select —</option>
                    {groups.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
                  </select>
                </div>
              )}
              {form.targetScope === 'device' && (
                <div className="field" style={{ flex: 1 }}>
                  <label className="field__label">Screen</label>
                  <select className="select" value={form.targetId} onChange={e => set('targetId', e.target.value)}>
                    <option value="">— select —</option>
                    {devices.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="row gap-3">
              <div className="field" style={{ flex: 1 }}>
                <label className="field__label">Start date/time</label>
                <input className="input" type="datetime-local" value={form.startAt}
                  onChange={e => set('startAt', e.target.value)} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label className="field__label">End date/time (optional)</label>
                <input className="input" type="datetime-local" value={form.endAt}
                  onChange={e => set('endAt', e.target.value)} />
              </div>
              <div className="field" style={{ width: 100 }}>
                <label className="field__label">Duration (s)</label>
                <input className="input" type="number" min={5} max={300} value={form.durationS}
                  onChange={e => set('durationS', e.target.value)} />
              </div>
            </div>
          </div>
          <div className="modal__foot">
            <Btn kind="secondary" type="button" onClick={onClose}>Cancel</Btn>
            <Btn kind="primary" type="submit" icon={IcoCheck} disabled={saving}>
              {initial ? 'Save changes' : 'Create'}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Screen modal ───────────────────────────────────────────────────────────────
function ScreenModal({ onClose, onSaved, groups = [] }) {
  const [form, setForm] = useState({ name: '', location: '', groupId: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      const data = await api.createEcalDevice(form);
      setResult(data);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (result) return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">Screen registered</div>
          <Btn kind="ghost" size="sm" icon={IcoX} onClick={onClose} />
        </div>
        <div className="modal__body">
          <div style={{ background: 'var(--bg-subtle)', borderRadius: 8, padding: 16, marginBottom: 4 }}>
            <div className="text-xs muted" style={{ marginBottom: 4 }}>Device ID</div>
            <code style={{ fontSize: 12 }}>{result.id}</code>
          </div>
          <div style={{ background: 'var(--bg-subtle)', borderRadius: 8, padding: 16, marginBottom: 4, marginTop: 8 }}>
            <div className="text-xs muted" style={{ marginBottom: 4 }}>API Key (shown once — copy now)</div>
            <code style={{ wordBreak: 'break-all', fontSize: 12 }}>{result.apiKey}</code>
          </div>
          <div className="text-xs muted" style={{ marginTop: 8 }}>
            Configure these on the display device. It authenticates with <code>x-api-key</code> header.
          </div>
        </div>
        <div className="modal__foot">
          <Btn kind="primary" onClick={onClose}>Done</Btn>
        </div>
      </div>
    </div>
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">Register new screen</div>
          <Btn kind="ghost" size="sm" icon={IcoX} onClick={onClose} />
        </div>
        <form onSubmit={submit}>
          <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {error && <div className="error-banner">{error}</div>}
            <div className="field">
              <label className="field__label">Screen name *</label>
              <input required className="input" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="field">
              <label className="field__label">Location</label>
              <input className="input" value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Main lobby, Level 2" />
            </div>
            <div className="field">
              <label className="field__label">Device group</label>
              <select className="select" value={form.groupId}
                onChange={e => setForm(f => ({ ...f, groupId: e.target.value }))}>
                <option value="">No group</option>
                {groups.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
              </select>
            </div>
            <div className="text-xs muted" style={{ padding: '4px 0' }}>
              This display authenticates via MQTT using an <code>x-api-key</code> header.
            </div>
          </div>
          <div className="modal__foot">
            <Btn kind="secondary" type="button" onClick={onClose}>Cancel</Btn>
            <Btn kind="primary" type="submit" icon={IcoCheck} disabled={saving}>Register screen</Btn>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── OTA modal (push firmware to a single display screen) ──────────────────────
function OtaModal({ screen, onClose, onSaved }) {
  const [form, setForm] = useState({ version: '', fileUrl: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!form.version || !form.fileUrl) { setError('Version and URL are required'); return; }
    setSaving(true); setError('');
    try {
      await api.otaEcalDevice(screen._id, form);
      onSaved();
      onClose();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">Push OTA · {screen.name}</div>
          <Btn kind="ghost" size="sm" icon={IcoX} onClick={onClose} />
        </div>
        <form onSubmit={submit}>
          <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {error && <div className="error-banner">{error}</div>}
            <div style={{ padding: '8px 10px', background: 'var(--bg-subtle)', borderRadius: 6, fontSize: 12 }}>
              <span className="muted">Current firmware: </span>
              <code>{screen.firmwareVersion || 'unknown'}</code>
            </div>
            <div className="field">
              <label className="field__label">Target version *</label>
              <input required className="input mono" value={form.version} placeholder="e.g. 2.1.0"
                onChange={e => setForm(f => ({ ...f, version: e.target.value }))} />
            </div>
            <div className="field">
              <label className="field__label">Firmware URL *</label>
              <input required className="input" value={form.fileUrl} placeholder="https://…/firmware.bin"
                onChange={e => setForm(f => ({ ...f, fileUrl: e.target.value }))} />
              <div className="text-xs muted" style={{ marginTop: 3 }}>
                The display device will download and flash this binary on next heartbeat.
              </div>
            </div>
          </div>
          <div className="modal__foot">
            <Btn kind="secondary" type="button" onClick={onClose}>Cancel</Btn>
            <Btn kind="primary" type="submit" disabled={saving}>{saving ? 'Pushing…' : 'Push OTA'}</Btn>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── KPI tile ───────────────────────────────────────────────────────────────────
function KpiTile({ label, value, sub, accent }) {
  return (
    <div className="card" style={{ padding: 14, borderLeft: accent ? `3px solid ${accent}` : undefined }}>
      <div className="text-xs muted">{label}</div>
      <div className="text-2xl font-semibold tabnum tracking-tight" style={{ marginTop: 4 }}>{value ?? '—'}</div>
      {sub && <div className="text-xs subtle" style={{ marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ─── Overview tab ───────────────────────────────────────────────────────────────
function OverviewTab({ stats, content, screens, onNewContent }) {
  const now = new Date();
  const liveContent = content.filter(c => {
    if (!c.isActive) return false;
    const start = c.schedule?.startAt ? new Date(c.schedule.startAt) : null;
    const end   = c.schedule?.endAt   ? new Date(c.schedule.endAt)   : null;
    if (start && isAfter(start, now)) return false;
    if (end   && isBefore(end, now))  return false;
    return true;
  });
  const onlineScreens = screens.filter(s => s.status === 'online');

  const TYPE_HUE = { announcement: 210, emergency: 0, news: 155, event: 280, advertisement: 40, weather: 200 };

  return (
    <>
      <div className="grid grid-cols-4" style={{ marginBottom: 16 }}>
        <KpiTile label="Live content"    value={liveContent.length}                             sub="items broadcasting now"    accent={liveContent.length ? 'var(--green, #22c55e)' : undefined} />
        <KpiTile label="Screens online"  value={`${onlineScreens.length}/${screens.length}`}    sub="connected displays"        accent={onlineScreens.length ? 'var(--blue, #3b82f6)' : undefined} />
        <KpiTile label="Critical alerts" value={stats?.criticalContent ?? '—'}                  sub="active critical items"     accent={stats?.criticalContent ? '#ef4444' : undefined} />
        <KpiTile label="Total content"   value={stats?.activeContent ?? '—'}                    sub="scheduled items" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <Card title="Broadcasting now" sub="Active and upcoming content"
          actions={<Btn kind="ghost" size="sm" iconRight={IcoArrowRight} onClick={onNewContent}>Add content</Btn>}>
          {liveContent.length === 0 ? (
            <Empty icon={IcoMonitor} title="Nothing broadcasting" hint="Schedule content to get started."
              action={<Btn kind="primary" size="sm" icon={IcoPlus} onClick={onNewContent}>New content</Btn>} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {liveContent.slice(0, 6).map((c, i) => {
                const hue = TYPE_HUE[c.type] ?? 200;
                return (
                  <div key={c._id || i} className="row gap-3" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{
                      width: 48, height: 32, borderRadius: 6, flexShrink: 0,
                      background: `linear-gradient(135deg, oklch(0.80 0.14 ${hue}), oklch(0.60 0.20 ${(hue + 50) % 360}))`,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 500, fontSize: 13 }}>{c.title}</span>
                        {priorityBadge(c.priority)}
                        <Badge kind="outline">{c.zone}</Badge>
                      </div>
                      <div className="text-xs muted" style={{ marginTop: 2 }}>
                        {c.type} · {c.durationS}s · {c.target?.scope === 'global' ? 'All screens' : c.target?.scope}
                        {c.schedule?.endAt && ` · ends ${format(new Date(c.schedule.endAt), 'MMM d')}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Screens" sub="Real-time heartbeat status">
          {screens.length === 0 ? (
            <Empty icon={IcoMonitor} title="No screens registered" hint="Register a display to get started." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {screens.slice(0, 8).map((s, i) => (
                <div key={s._id || i} className="row gap-2" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <StatusDot status={s.status || 'offline'} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                    <div className="text-xs muted">{s.groupName || '—'} · {s.location || 'No location'}</div>
                  </div>
                  <span className="text-xs subtle mono">
                    {s.lastSeenAt ? formatDistanceToNow(new Date(s.lastSeenAt), { addSuffix: true }) : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

// ─── Content tab ────────────────────────────────────────────────────────────────
function ContentTab({ content, onNew, onEdit, onDelete, groups, devices }) {
  const [filter, setFilter] = useState('all');
  const TYPE_HUE = { announcement: 210, emergency: 0, news: 155, event: 280, advertisement: 40, weather: 200 };

  const filtered = filter === 'all' ? content : content.filter(c => c.priority === filter);

  return (
    <>
      <div className="row gap-2" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        {['all', ...PRIORITIES.map(p => p.value)].map(v => (
          <button key={v}
            className={`btn btn--sm ${filter === v ? 'btn--secondary' : 'btn--ghost'}`}
            onClick={() => setFilter(v)}>
            {v === 'all' ? 'All' : PRIORITIES.find(p => p.value === v)?.label}
            <span className="text-xs muted" style={{ marginLeft: 4 }}>
              {v === 'all' ? content.length : content.filter(c => c.priority === v).length}
            </span>
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <Btn kind="primary" size="sm" icon={IcoPlus} onClick={onNew}>New content</Btn>
      </div>

      {filtered.length === 0 ? (
        <Card><Empty icon={IcoMonitor} title="No content" hint="Create your first content item."
          action={<Btn kind="primary" size="sm" icon={IcoPlus} onClick={onNew}>New content</Btn>} /></Card>
      ) : (
        <div className="grid grid-cols-4">
          {filtered.map((c, i) => {
            const hue = TYPE_HUE[c.type] ?? 200;
            const status = contentStatus(c);
            return (
              <div key={c._id || i} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ aspectRatio: '16/9', background: `linear-gradient(135deg, oklch(0.82 0.14 ${hue}), oklch(0.60 0.22 ${(hue + 50) % 360}))`, position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 7, left: 8, display: 'flex', gap: 4 }}>
                    {priorityBadge(c.priority)}
                    <Badge kind="neutral">{c.zone}</Badge>
                  </div>
                  <div style={{ position: 'absolute', bottom: 8, left: 10, right: 10, color: 'white', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>{c.title}</div>
                    {c.body && <div style={{ fontSize: 11, opacity: 0.88, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.body}</div>}
                  </div>
                </div>
                <div style={{ padding: '8px 12px' }}>
                  <div className="row gap-2" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="row gap-2">
                      <Badge kind={status.kind} dot={status.dot ? status.kind : undefined}>{status.label}</Badge>
                      <Badge kind="outline">{c.type}</Badge>
                    </div>
                    <span className="text-xs muted">{c.durationS}s</span>
                  </div>
                  <div className="text-xs muted" style={{ marginTop: 4 }}>
                    {c.target?.scope === 'global' ? 'All screens' : c.target?.scope}
                    {c.schedule?.endAt ? ` · ends ${format(new Date(c.schedule.endAt), 'MMM d')}` : ' · no expiry'}
                  </div>
                  <div className="row gap-1" style={{ marginTop: 6, justifyContent: 'flex-end' }}>
                    <Btn kind="ghost" size="sm" onClick={() => onEdit(c)}>Edit</Btn>
                    <Btn kind="ghost" size="sm" onClick={() => onDelete(c._id)}>Delete</Btn>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ─── Schedule tab ───────────────────────────────────────────────────────────────
function ScheduleTab({ content }) {
  const now = new Date();
  const sorted = [...content].sort((a, b) => {
    const pa = { critical: 0, high: 1, normal: 2, low: 3 }[a.priority] ?? 9;
    const pb = { critical: 0, high: 1, normal: 2, low: 3 }[b.priority] ?? 9;
    return pa - pb;
  });

  const PRI_COLOR = { critical: '#ef4444', high: '#f59e0b', normal: '#3b82f6', low: 'var(--fg-subtle)' };

  return (
    <>
      <Card padding={false} title="Content schedule" sub={`${content.length} items · sorted by priority`}>
        <table className="table">
          <thead>
            <tr>
              <th>Priority</th><th>Title</th><th>Type</th><th>Zone</th>
              <th>Target</th><th>Window</th><th>Duration</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '32px 14px', color: 'var(--fg-muted)' }}>No content yet</td></tr>
            ) : sorted.map(c => {
              const status = contentStatus(c);
              const start  = c.schedule?.startAt ? new Date(c.schedule.startAt) : null;
              const end    = c.schedule?.endAt   ? new Date(c.schedule.endAt)   : null;
              return (
                <tr key={c._id}>
                  <td>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 3, height: 18, borderRadius: 2, background: PRI_COLOR[c.priority] || 'var(--fg-subtle)', flexShrink: 0 }} />
                      {priorityBadge(c.priority)}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</td>
                  <td><Badge kind="outline">{c.type}</Badge></td>
                  <td><Badge kind="neutral">{c.zone}</Badge></td>
                  <td className="text-xs muted">
                    {c.target?.scope === 'global' ? 'Global' : c.target?.scope}
                  </td>
                  <td className="muted text-xs mono">
                    {start ? format(start, 'MMM d') : '—'}
                    {' → '}
                    {end ? format(end, 'MMM d') : '∞'}
                  </td>
                  <td className="muted text-xs">{c.durationS}s</td>
                  <td>
                    <Badge kind={status.kind} dot={status.dot ? status.kind : undefined}>{status.label}</Badge>
                  </td>
                  <td><Btn kind="ghost" size="sm" icon={IcoMore} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}

// ─── Screens tab ────────────────────────────────────────────────────────────────
function ScreensTab({ screens, onNew, onDelete, onOta }) {
  return (
    <>
      <div className="row" style={{ marginBottom: 12, justifyContent: 'flex-end' }}>
        <Btn kind="primary" size="sm" icon={IcoPlus} onClick={onNew}>Register screen</Btn>
      </div>
      <Card padding={false}>
        <table className="table">
          <thead>
            <tr>
              <th></th><th>Screen</th><th>Group</th><th>Location</th>
              <th>Firmware</th><th>Now playing</th><th>Last heartbeat</th><th></th>
            </tr>
          </thead>
          <tbody>
            {screens.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '32px 14px', color: 'var(--fg-muted)' }}>
                No screens registered — register a display device to get started
              </td></tr>
            ) : screens.map(s => (
              <tr key={s._id}>
                <td><StatusDot status={s.status || 'offline'} /></td>
                <td>
                  <div style={{ fontWeight: 500 }}>{s.name}</div>
                  <div className="text-xs mono muted">{s.apiKeyPrefix}…</div>
                </td>
                <td><Badge kind="outline">{s.groupName || '—'}</Badge></td>
                <td className="muted text-xs">{s.location || '—'}</td>
                <td className="text-xs">
                  <div className="row gap-1" style={{ alignItems: 'center' }}>
                    <code style={{ fontSize: 11 }}>{s.firmwareVersion || '—'}</code>
                    {s.otaPending && (
                      <Badge kind="warning" dot="warning">OTA pending</Badge>
                    )}
                  </div>
                </td>
                <td className="muted text-xs">{s.nowPlaying || (s.status === 'online' ? 'Syncing…' : '—')}</td>
                <td className="muted text-xs">
                  {s.lastSeenAt
                    ? <>{format(new Date(s.lastSeenAt), 'MMM d, HH:mm')} <span className="subtle">({formatDistanceToNow(new Date(s.lastSeenAt), { addSuffix: true })})</span></>
                    : 'Never'}
                </td>
                <td>
                  <div className="row gap-1">
                    <Btn kind="ghost" size="sm" icon={IcoSettings} title="Push OTA" onClick={() => onOta(s)}>OTA</Btn>
                    <Btn kind="ghost" size="sm" icon={IcoMore} title="More" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────────
export default function ECalendarPage() {
  const qc = useQueryClient();
  const location = useLocation();
  const tab = new URLSearchParams(location.search).get('tab') || 'overview';

  const [showContentModal, setShowContentModal] = useState(false);
  const [showScreenModal,  setShowScreenModal]  = useState(false);
  const [editingContent,   setEditingContent]   = useState(null);
  const [otaScreen,        setOtaScreen]        = useState(null);

  const { data: stats }    = useQuery({ queryKey: ['ecal-stats'],    queryFn: api.getEcalStats,    refetchInterval: 30_000 });
  const { data: rawContent } = useQuery({ queryKey: ['ecal-content'], queryFn: () => api.listEcalContent() });
  const { data: rawScreens } = useQuery({ queryKey: ['ecal-devices'], queryFn: api.listEcalDevices, refetchInterval: 30_000 });
  const { data: rawGroups }  = useQuery({ queryKey: ['ecal-groups'],  queryFn: api.listEcalGroups });

  const content = Array.isArray(rawContent) ? rawContent : (rawContent?.items || []);
  const screens = Array.isArray(rawScreens) ? rawScreens : (rawScreens?.items || []);
  const groups  = Array.isArray(rawGroups)  ? rawGroups  : (rawGroups?.items  || []);

  const delContent = useMutation({
    mutationFn: api.deleteEcalContent,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ecal-content'] }),
  });

  const delScreen = useMutation({
    mutationFn: api.deleteEcalDevice,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ecal-devices'] }),
  });

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ['ecal-content'] });
    qc.invalidateQueries({ queryKey: ['ecal-stats'] });
  }

  const PAGE_META = {
    overview:  { title: 'e-Calendar',       sub: 'Display network overview — screens, content, and live status.' },
    content:   { title: 'Content library',  sub: 'Reusable content items scheduled to display devices.' },
    schedule:  { title: 'Schedule',         sub: 'Prioritised content distribution timeline.' },
    screens:   { title: 'Screens',          sub: 'Registered display devices and real-time heartbeat status.' },
  };
  const { title, sub } = PAGE_META[tab] || PAGE_META.overview;

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">{title}</h1>
          <div className="page__sub">{sub}</div>
        </div>
        <div className="page__actions">
          {(tab === 'overview' || tab === 'content') && (
            <Btn kind="primary" size="sm" icon={IcoPlus} onClick={() => { setEditingContent(null); setShowContentModal(true); }}>
              New content
            </Btn>
          )}
          {tab === 'screens' && (
            <Btn kind="primary" size="sm" icon={IcoPlus} onClick={() => setShowScreenModal(true)}>
              Register screen
            </Btn>
          )}
          <Btn kind="ghost" size="sm" icon={IcoRefresh}
            onClick={() => { qc.invalidateQueries({ queryKey: ['ecal-content'] }); qc.invalidateQueries({ queryKey: ['ecal-devices'] }); qc.invalidateQueries({ queryKey: ['ecal-stats'] }); }}
            title="Refresh" />
        </div>
      </div>

      {tab === 'overview' && (
        <OverviewTab stats={stats} content={content} screens={screens}
          onNewContent={() => { setEditingContent(null); setShowContentModal(true); }} />
      )}
      {tab === 'content' && (
        <ContentTab content={content} groups={groups} devices={screens}
          onNew={() => { setEditingContent(null); setShowContentModal(true); }}
          onEdit={c => { setEditingContent(c); setShowContentModal(true); }}
          onDelete={id => { if (confirm('Delete this content item?')) delContent.mutate(id); }} />
      )}
      {tab === 'schedule' && <ScheduleTab content={content} />}
      {tab === 'screens' && (
        <ScreensTab screens={screens}
          onNew={() => setShowScreenModal(true)}
          onDelete={id => { if (confirm('Remove this screen?')) delScreen.mutate(id); }}
          onOta={s => setOtaScreen(s)} />
      )}

      {showContentModal && (
        <ContentModal
          initial={editingContent}
          groups={groups}
          devices={screens}
          onClose={() => { setShowContentModal(false); setEditingContent(null); }}
          onSaved={invalidateAll}
        />
      )}

      {showScreenModal && (
        <ScreenModal
          groups={groups}
          onClose={() => setShowScreenModal(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['ecal-devices'] })}
        />
      )}

      {otaScreen && (
        <OtaModal
          screen={otaScreen}
          onClose={() => setOtaScreen(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['ecal-devices'] })}
        />
      )}
    </div>
  );
}
