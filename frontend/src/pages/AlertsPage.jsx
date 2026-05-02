import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api.js';
import { useAuthStore } from '../store/auth.js';
import { Btn, Badge, StatusDot, Seg, Card, Sparkline, Empty, Spinner } from '../components/ui/index.jsx';
import { IcoPlus, IcoBellOff, IcoBell, IcoShield, IcoHistory, IcoX, IcoCheck, IcoMore, IcoArrowRight, IcoLayers } from '../components/ui/Icons.jsx';
import { format } from 'date-fns';

const SENSORS = ['temperature','humidity','pressure','rainfall','wind_speed','co2','pm25','pm10'];
const OPERATORS = ['>','<','>=','<=','=','!='];
const SEVERITIES = ['info','warning','critical'];
const CHANNELS = ['web','email','sms','webhook'];

function RuleModal({ devices, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: '', sensorKey: 'temperature', operator: '>', threshold: '',
    severity: 'warning', channels: ['web'], deviceId: '', cooldownS: 300,
  });
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.createAlertRule({ ...form, threshold: parseFloat(form.threshold) });
      onSaved();
      onClose();
    } catch (err) { setError(err.message); }
  }

  function toggleChannel(ch) {
    setForm(f => ({
      ...f,
      channels: f.channels.includes(ch) ? f.channels.filter(c => c !== ch) : [...f.channels, ch],
    }));
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">New alert rule</div>
          <Btn kind="ghost" size="sm" icon={IcoX} onClick={onClose} />
        </div>
        <div className="modal__body">
          {error && <div className="error-banner">{error}</div>}
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field__label">Rule name</label>
            <input required className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>

          <div className="text-xs uppercase tracking-wide subtle" style={{ marginBottom: 6 }}>Condition</div>
          <div style={{ padding: 14, background: 'var(--bg-subtle)', borderRadius: 8, marginBottom: 14 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: 14 }}>
              <span>When</span>
              <select className="select" style={{ width: 'auto', minWidth: 130 }} value={form.sensorKey}
                onChange={e => setForm(f => ({ ...f, sensorKey: e.target.value }))}>
                {SENSORS.map(s => <option key={s}>{s}</option>)}
              </select>
              <span>is</span>
              <select className="select" style={{ width: 70 }} value={form.operator}
                onChange={e => setForm(f => ({ ...f, operator: e.target.value }))}>
                {OPERATORS.map(o => <option key={o}>{o}</option>)}
              </select>
              <input required type="number" step="any" className="input mono"
                style={{ width: 90, fontFamily: 'var(--font-mono)' }}
                value={form.threshold} onChange={e => setForm(f => ({ ...f, threshold: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2" style={{ gap: 12, marginBottom: 14 }}>
            <div className="field">
              <label className="field__label">Severity</label>
              <Seg value={form.severity} onChange={v => setForm(f => ({ ...f, severity: v }))} options={SEVERITIES} />
            </div>
            <div className="field">
              <label className="field__label">Device</label>
              <select className="select" value={form.deviceId}
                onChange={e => setForm(f => ({ ...f, deviceId: e.target.value }))}>
                <option value="">All devices</option>
                {devices?.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          <div className="text-xs uppercase tracking-wide subtle" style={{ marginBottom: 6 }}>Notify via</div>
          <div className="row gap-2" style={{ marginBottom: 14 }}>
            {CHANNELS.map(ch => (
              <button key={ch} onClick={() => toggleChannel(ch)} className="badge"
                style={{
                  padding: '4px 10px', fontSize: 12, cursor: 'pointer',
                  background: form.channels.includes(ch) ? 'var(--accent-soft)' : 'transparent',
                  color: form.channels.includes(ch) ? 'var(--accent-soft-fg)' : 'var(--fg-muted)',
                  border: `1px solid ${form.channels.includes(ch) ? 'transparent' : 'var(--border)'}`,
                  borderRadius: 9999,
                }}>
                {ch}
              </button>
            ))}
          </div>

          <div className="field">
            <label className="field__label">Cooldown (seconds)</label>
            <input type="number" className="input" style={{ width: 120 }} value={form.cooldownS}
              onChange={e => setForm(f => ({ ...f, cooldownS: parseInt(e.target.value) }))} />
          </div>
        </div>
        <div className="modal__foot">
          <Btn kind="secondary" onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" icon={IcoCheck} onClick={submit}>Create rule</Btn>
        </div>
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  const role = user?.role || 'viewer';
  const [tab, setTab] = useState('inbox');
  const [stateFilter, setStateFilter] = useState('open');
  const [showRule, setShowRule] = useState(false);

  const { data: rules } = useQuery({ queryKey: ['alert-rules'], queryFn: api.listAlertRules });
  const { data: events, isLoading } = useQuery({
    queryKey: ['alert-events', stateFilter],
    queryFn: () => api.listAlertEvents({ state: stateFilter, limit: 50 }),
    refetchInterval: 15_000,
  });
  const { data: openData } = useQuery({
    queryKey: ['alert-events', 'open-count'],
    queryFn: () => api.listAlertEvents({ state: 'open', limit: 1 }),
  });
  const { data: ackData } = useQuery({
    queryKey: ['alert-events', 'ack-count'],
    queryFn: () => api.listAlertEvents({ state: 'acknowledged', limit: 1 }),
  });
  const { data: resData } = useQuery({
    queryKey: ['alert-events', 'res-count'],
    queryFn: () => api.listAlertEvents({ state: 'resolved', limit: 1 }),
  });
  const { data: devicesData } = useQuery({ queryKey: ['devices'], queryFn: () => api.listDevices({ limit: 100 }) });

  const ackMut = useMutation({ mutationFn: api.acknowledgeAlert, onSuccess: () => qc.invalidateQueries(['alert-events']) });
  const resMut = useMutation({ mutationFn: api.resolveAlert,     onSuccess: () => qc.invalidateQueries(['alert-events']) });
  const delRuleMut = useMutation({ mutationFn: api.deleteAlertRule, onSuccess: () => qc.invalidateQueries(['alert-rules']) });

  const openCount = openData?.total ?? 0;
  const ackCount  = ackData?.total  ?? 0;
  const resCount  = resData?.total  ?? 0;
  const allEvents = events?.events || [];

  const deviceMap = useMemo(() => {
    const m = {};
    (devicesData?.devices || []).forEach(d => { m[d._id.toString()] = d; });
    return m;
  }, [devicesData]);

  const ruleMap = useMemo(() => {
    const m = {};
    (rules || []).forEach(r => { m[r._id.toString()] = r; });
    return m;
  }, [rules]);

  const grouped = useMemo(() => {
    const map = {};
    allEvents.forEach(e => {
      const key = e.deviceId?.toString() || 'unknown';
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [allEvents]);

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Alerts</h1>
          <div className="page__sub">{openCount} open · {ackCount} acknowledged · {resCount} resolved</div>
        </div>
        <div className="page__actions">
          {role !== 'viewer' && (
            <>
              <Btn kind="secondary" size="sm" icon={IcoBellOff}>Snooze rules</Btn>
              <Btn kind="primary" size="sm" icon={IcoPlus} onClick={() => setShowRule(true)}>New rule</Btn>
            </>
          )}
        </div>
      </div>

      <div className="row gap-3" style={{ marginBottom: 12 }}>
        <Seg value={tab} onChange={setTab} options={[
          { value: 'inbox',   label: 'Triage',                        icon: IcoBell },
          { value: 'rules',   label: `Rules · ${rules?.length ?? 0}`, icon: IcoShield },
          { value: 'history', label: 'History',                       icon: IcoHistory },
        ]} />
        {tab === 'inbox' && (
          <Seg value={stateFilter} onChange={setStateFilter} options={[
            { value: 'open',         label: `Open · ${openCount}` },
            { value: 'acknowledged', label: 'Acknowledged' },
            { value: 'resolved',     label: 'Resolved' },
            { value: 'all',          label: 'All' },
          ]} />
        )}
        <div style={{ flex: 1 }} />
        {tab === 'inbox' && <Btn kind="ghost" size="sm" icon={IcoLayers}>Group by device</Btn>}
      </div>

      {tab === 'inbox' && (
        <div className="grid" style={{ gridTemplateColumns: '1fr 280px', gap: 16 }}>
          <div className="grid" style={{ gap: 10 }}>
            {isLoading ? <Spinner /> : allEvents.length === 0 ? (
              <Card><Empty icon={IcoCheck} title="All clear" hint="No alerts in this category." /></Card>
            ) : Object.entries(grouped).map(([devId, items]) => {
              const dev = deviceMap[devId];
              return (
                <Card key={devId} padding={false}>
                  <div className="row gap-2" style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                    <StatusDot status={dev?.status} pulse={dev?.status === 'alert'} />
                    <span style={{ fontWeight: 500 }}>{dev?.name || 'Unknown device'}</span>
                    <span className="text-xs mono muted">{devId.slice(-8)}</span>
                    <Badge kind="outline">{items.length} {items.length === 1 ? 'event' : 'events'}</Badge>
                    <div style={{ flex: 1 }} />
                    <Btn kind="ghost" size="sm" iconRight={IcoArrowRight}>Open device</Btn>
                  </div>
                  {items.map(e => {
                    const rule = ruleMap[e.ruleId?.toString()];
                    return (
                      <div key={e._id} className="row gap-3" style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' }}>
                        <div style={{ marginTop: 2 }}><StatusDot status={e.severity} /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="row gap-2">
                            <span style={{ fontWeight: 500, fontSize: 13 }}>{e.message}</span>
                            <Badge kind={e.severity === 'critical' ? 'danger' : e.severity === 'warning' ? 'warn' : 'info'}>{e.severity}</Badge>
                            {rule && <Badge kind="outline">{rule.name}</Badge>}
                          </div>
                          <div className="text-xs muted" style={{ marginTop: 3 }}>
                            {e.triggerValue != null ? `Value: ${e.triggerValue}` : ''} · <span className="mono">{devId.slice(-6)}</span> · {e.createdAt ? format(new Date(e.createdAt), 'MMM d, HH:mm') : ''}
                          </div>
                          {(e.acknowledgedBy || e.resolvedBy) && (
                            <div className="text-xs subtle" style={{ marginTop: 3 }}>
                              {e.acknowledgedBy && 'Acknowledged'}
                              {e.resolvedBy && 'Resolved'}
                            </div>
                          )}
                        </div>
                        {e.state === 'open' && role !== 'viewer' && (
                          <div className="row gap-2">
                            <Btn kind="secondary" size="sm" onClick={() => ackMut.mutate(e._id)}>Acknowledge</Btn>
                            <Btn kind="primary" size="sm" onClick={() => resMut.mutate(e._id)}>Resolve</Btn>
                          </div>
                        )}
                        {e.state === 'acknowledged' && role !== 'viewer' && (
                          <Btn kind="primary" size="sm" onClick={() => resMut.mutate(e._id)}>Resolve</Btn>
                        )}
                        {e.state === 'resolved' && <Badge kind="ok">Resolved</Badge>}
                      </div>
                    );
                  })}
                </Card>
              );
            })}
          </div>

          <div className="grid" style={{ gap: 12, alignContent: 'flex-start' }}>
            <Card title="Volume · 7 days">
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 90 }}>
                {[12, 8, 14, 22, 9, 6, openCount].map((v, i) => (
                  <div key={i} style={{ flex: 1, height: `${(Math.max(v, 1) / 22) * 100}%`, background: i === 3 ? 'var(--danger)' : 'var(--accent)', borderRadius: 2, opacity: i === 6 ? 0.5 : 0.85, minHeight: 2 }} />
                ))}
              </div>
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 6, fontSize: 10.5, color: 'var(--fg-subtle)', fontFamily: 'var(--font-mono)' }}>
                {['Wed','Thu','Fri','Sat','Sun','Mon','Today'].map(d => <span key={d}>{d}</span>)}
              </div>
            </Card>
            <Card title="Most-triggered rule">
              {rules?.[0] ? (
                <>
                  <div style={{ fontWeight: 500 }}>{rules[0].name}</div>
                  <div className="text-xs muted">{rules[0].sensorKey} {rules[0].operator} {rules[0].threshold}</div>
                </>
              ) : <div className="text-xs muted">No rules yet</div>}
            </Card>
            <Card title="Mean time to acknowledge">
              <div className="row gap-3" style={{ alignItems: 'flex-end' }}>
                <div className="text-2xl font-semibold tabnum">4m 12s</div>
              </div>
              <div className="text-xs subtle">vs last week</div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'rules' && (
        <Card padding={false}>
          <table className="table">
            <thead>
              <tr><th>Rule</th><th>Condition</th><th>Severity</th><th>Scope</th><th>Channels</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {!rules?.length ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px 14px', color: 'var(--fg-muted)' }}>No rules defined</td></tr>
              ) : rules.map(r => (
                <tr key={r._id}>
                  <td><span style={{ fontWeight: 500 }}>{r.name}</span></td>
                  <td className="mono text-xs">{r.sensorKey} {r.operator} {r.threshold}</td>
                  <td><Badge kind={r.severity === 'critical' ? 'danger' : r.severity === 'warning' ? 'warn' : 'info'}>{r.severity}</Badge></td>
                  <td className="muted text-xs">{r.scope || 'All devices'}</td>
                  <td><div className="row gap-1">{r.channels?.map(c => <Badge key={c} kind="outline">{c}</Badge>)}</div></td>
                  <td>
                    <span className={`row gap-2 text-xs ${r.isActive ? '' : 'subtle'}`}>
                      <span className={`dot ${r.isActive ? 'dot--ok' : 'dot--off'}`} />
                      {r.isActive ? 'Active' : 'Paused'}
                    </span>
                  </td>
                  <td>
                    {role !== 'viewer' && (
                      <Btn kind="danger" size="sm" onClick={() => { if (confirm('Delete rule?')) delRuleMut.mutate(r._id); }}>Delete</Btn>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'history' && (
        <Card padding={false}>
          <table className="table">
            <thead>
              <tr><th>When</th><th>Severity</th><th>Device</th><th>Rule</th><th>Detail</th><th>Resolution</th></tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32 }}><Spinner /></td></tr>
              ) : allEvents.map(e => {
                const dev = deviceMap[e.deviceId?.toString()];
                const rule = ruleMap[e.ruleId?.toString()];
                return (
                  <tr key={e._id}>
                    <td className="muted text-xs mono">{e.createdAt ? format(new Date(e.createdAt), 'MMM d, HH:mm') : '—'}</td>
                    <td><Badge kind={e.severity === 'critical' ? 'danger' : e.severity === 'warning' ? 'warn' : 'info'}>{e.severity}</Badge></td>
                    <td className="mono text-xs">{dev?.name || e.deviceId?.toString().slice(-8) || '—'}</td>
                    <td className="text-xs">{rule?.name || '—'}</td>
                    <td className="muted text-xs">{e.triggerValue != null ? `Value: ${e.triggerValue}` : e.message}</td>
                    <td className="text-xs muted">
                      {e.resolvedBy ? `Resolved` : e.acknowledgedBy ? `Acknowledged` : e.resolvedAt ? 'Resolved' : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {showRule && (
        <RuleModal
          devices={devicesData?.devices}
          onClose={() => setShowRule(false)}
          onSaved={() => qc.invalidateQueries(['alert-rules'])}
        />
      )}
    </div>
  );
}
