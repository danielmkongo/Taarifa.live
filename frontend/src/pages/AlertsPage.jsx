import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api.js';
import { format } from 'date-fns';

const SENSORS = ['temperature','humidity','pressure','rainfall','wind_speed','co2','pm25','pm10'];
const OPERATORS = ['>','<','>=','<=','=','!='];
const SEVERITIES = ['info','warning','critical'];
const CHANNELS = ['email','sms','web','webhook'];

function RuleModal({ devices, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: '', sensorKey: 'temperature', operator: '>', threshold: '',
    severity: 'warning', channels: ['web'], deviceId: '', cooldownS: 300, webhookUrl: '',
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold text-lg mb-4">{useTranslation().t('alerts.createRule')}</h3>
        {error && <div className="mb-3 p-2 bg-red-50 text-red-700 text-sm rounded">{error}</div>}
        <form onSubmit={submit} className="space-y-3">
          <div><label className="label">Rule Name *</label><input required className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="label">Sensor</label>
              <select className="input" value={form.sensorKey} onChange={e => setForm(f => ({ ...f, sensorKey: e.target.value }))}>
                {SENSORS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Operator</label>
              <select className="input" value={form.operator} onChange={e => setForm(f => ({ ...f, operator: e.target.value }))}>
                {OPERATORS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Threshold</label>
              <input required type="number" step="any" className="input" value={form.threshold} onChange={e => setForm(f => ({ ...f, threshold: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Severity</label>
              <select className="input" value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
                {SEVERITIES.map(s => <option key={s} className="capitalize">{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Cooldown (s)</label>
              <input type="number" className="input" value={form.cooldownS} onChange={e => setForm(f => ({ ...f, cooldownS: parseInt(e.target.value) }))} />
            </div>
          </div>
          <div>
            <label className="label">Device (optional — blank = all)</label>
            <select className="input" value={form.deviceId} onChange={e => setForm(f => ({ ...f, deviceId: e.target.value }))}>
              <option value="">All devices</option>
              {devices?.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Notification Channels</label>
            <div className="flex gap-2 flex-wrap">
              {CHANNELS.map(ch => (
                <button type="button" key={ch} onClick={() => toggleChannel(ch)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    form.channels.includes(ch) ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-300 text-gray-600 hover:border-primary-400'
                  }`}>
                  {ch}
                </button>
              ))}
            </div>
          </div>
          {form.channels.includes('webhook') && (
            <div><label className="label">Webhook URL</label><input type="url" className="input" value={form.webhookUrl} onChange={e => setForm(f => ({ ...f, webhookUrl: e.target.value }))} /></div>
          )}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center">Create Rule</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState('events');
  const [showModal, setShowModal] = useState(false);
  const [stateFilter, setStateFilter] = useState('open');

  const { data: rules } = useQuery({ queryKey: ['alert-rules'], queryFn: api.listAlertRules });
  const { data: events, isLoading } = useQuery({
    queryKey: ['alert-events', stateFilter],
    queryFn: () => api.listAlertEvents({ state: stateFilter, limit: 50 }),
    refetchInterval: 15_000,
  });
  const { data: devicesData } = useQuery({ queryKey: ['devices'], queryFn: () => api.listDevices({ limit: 100 }) });

  const ackMut = useMutation({ mutationFn: api.acknowledgeAlert, onSuccess: () => qc.invalidateQueries(['alert-events']) });
  const resMut = useMutation({ mutationFn: api.resolveAlert,     onSuccess: () => qc.invalidateQueries(['alert-events']) });
  const delRuleMut = useMutation({ mutationFn: api.deleteAlertRule, onSuccess: () => qc.invalidateQueries(['alert-rules']) });

  const severityBadge = (s) => s === 'critical' ? 'badge-red' : s === 'warning' ? 'badge-yellow' : 'badge-blue';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('alerts.title')}</h1>
          <p className="text-gray-500 mt-1">Monitor and manage alert rules and events</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">{t('alerts.createRule')}</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {['events', 'rules'].map(tab_ => (
          <button key={tab_} onClick={() => setTab(tab_)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === tab_ ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {tab_ === 'events' ? t('alerts.events') : t('alerts.rules')}
            {tab_ === 'events' && events?.total ? (
              <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-red-100 text-red-700">{events.total}</span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === 'events' && (
        <>
          <div className="flex gap-2">
            {['open','acknowledged','resolved'].map(s => (
              <button key={s} onClick={() => setStateFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-sm capitalize font-medium transition-colors ${
                  stateFilter === s ? 'bg-gray-900 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}>
                {t(`alerts.${s}`)}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {isLoading
              ? <p className="text-gray-400 text-sm">{t('common.loading')}</p>
              : !events?.events?.length
              ? <div className="card text-center text-gray-400 py-12">No {stateFilter} alerts</div>
              : events.events.map(e => (
                <div key={e._id} className="card flex items-start gap-4">
                  <div className={`mt-1 w-3 h-3 rounded-full flex-shrink-0 ${
                    e.severity === 'critical' ? 'bg-red-500' : e.severity === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                  }`} />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{e.message}</div>
                    <div className="text-sm text-gray-500 mt-1">
                      {format(new Date(e.createdAt), 'MMM d, yyyy HH:mm')} · Value: {e.triggerValue}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`badge ${severityBadge(e.severity)}`}>{e.severity}</span>
                    {e.state === 'open' && (
                      <>
                        <button onClick={() => ackMut.mutate(e._id)} className="text-xs text-primary-600 hover:underline">{t('alerts.acknowledge')}</button>
                        <button onClick={() => resMut.mutate(e._id)} className="text-xs text-green-600 hover:underline">{t('alerts.resolve')}</button>
                      </>
                    )}
                    {e.state === 'acknowledged' && (
                      <button onClick={() => resMut.mutate(e._id)} className="text-xs text-green-600 hover:underline">{t('alerts.resolve')}</button>
                    )}
                  </div>
                </div>
              ))
            }
          </div>
        </>
      )}

      {tab === 'rules' && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Name', 'Condition', 'Severity', 'Channels', 'Active', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {!rules?.length
                ? <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No rules defined</td></tr>
                : rules.map(r => (
                  <tr key={r._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{r.sensorKey} {r.operator} {r.threshold}</td>
                    <td className="px-4 py-3"><span className={`badge ${severityBadge(r.severity)}`}>{r.severity}</span></td>
                    <td className="px-4 py-3 text-gray-500">{r.channels?.join(', ')}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${r.isActive ? 'badge-green' : 'badge-gray'}`}>{r.isActive ? 'Yes' : 'No'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => { if (confirm('Delete rule?')) delRuleMut.mutate(r._id); }}
                        className="text-xs text-red-600 hover:underline">Delete</button>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <RuleModal
          devices={devicesData?.devices}
          onClose={() => setShowModal(false)}
          onSaved={() => qc.invalidateQueries(['alert-rules'])}
        />
      )}
    </div>
  );
}
