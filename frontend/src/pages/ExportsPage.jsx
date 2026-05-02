import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api.js';
import { useAuthStore } from '../store/auth.js';
import { format, subDays } from 'date-fns';
import { Btn, Badge, Card, Seg } from '../components/ui/index.jsx';
import { IcoDownload, IcoPlus, IcoMore, IcoX } from '../components/ui/Icons.jsx';

function ExportModal({ devices, onClose }) {
  const [form, setForm] = useState({
    deviceId: '', sensorKey: 'temperature',
    from: format(subDays(new Date(), 7), "yyyy-MM-dd'T'HH:mm"),
    to: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    format: 'csv',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleExport(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const params = {
        sensorKey: form.sensorKey,
        from: new Date(form.from).toISOString(),
        to: new Date(form.to).toISOString(),
        format: form.format,
      };
      if (form.deviceId) params.deviceId = form.deviceId;
      const blob = await api.exportReadings(params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `taarifa-export-${form.sensorKey}-${format(new Date(), 'yyyyMMdd')}.${form.format}`;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (err) {
      setError(err.message || 'Export failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">One-off export</div>
          <Btn kind="ghost" size="sm" icon={IcoX} onClick={onClose} />
        </div>
        <div className="modal__body">
          {error && <div className="error-banner">{error}</div>}
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field__label">Device</label>
            <select className="select" value={form.deviceId} onChange={e => setForm(f => ({ ...f, deviceId: e.target.value }))}>
              <option value="">All devices</option>
              {devices.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field__label">Sensor</label>
            <select className="select" value={form.sensorKey} onChange={e => setForm(f => ({ ...f, sensorKey: e.target.value }))}>
              {['temperature','humidity','pressure','rainfall','wind_speed','co2'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field__label">From</label>
            <input type="datetime-local" className="input" value={form.from} onChange={e => setForm(f => ({ ...f, from: e.target.value }))} />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field__label">To</label>
            <input type="datetime-local" className="input" value={form.to} onChange={e => setForm(f => ({ ...f, to: e.target.value }))} />
          </div>
          <div className="field" style={{ marginBottom: 16 }}>
            <label className="field__label">Format</label>
            <Seg value={form.format} onChange={v => setForm(f => ({ ...f, format: v }))} options={['csv','xlsx']} />
          </div>
        </div>
        <div className="modal__foot">
          <Btn kind="secondary" onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" icon={IcoDownload} onClick={handleExport} disabled={loading}>
            {loading ? 'Exporting…' : 'Download export'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

export default function ExportsPage() {
  const user = useAuthStore(s => s.user);
  const role = user?.role || 'viewer';
  const [showExport, setShowExport] = useState(false);

  const { data: devicesData } = useQuery({ queryKey: ['devices'], queryFn: () => api.listDevices({ limit: 100 }) });
  const devices = devicesData?.devices || [];

  const REPORTS = [
    { id: 'rep-001', name: 'Weekly fleet health',    cadence: 'Weekly · Mon 06:00',  format: 'PDF', recipients: 3, lastRun: format(subDays(new Date(), 7), 'MMM d'), status: 'ok' },
    { id: 'rep-002', name: 'Monthly rainfall',       cadence: 'Monthly · 1st 06:00', format: 'CSV', recipients: 2, lastRun: format(subDays(new Date(), 30), 'MMM d'), status: 'ok' },
    { id: 'rep-003', name: 'Air quality compliance', cadence: 'Daily · 07:00',       format: 'PDF', recipients: 5, lastRun: 'Today', status: 'ok' },
    { id: 'rep-004', name: 'Critical alerts digest', cadence: 'Daily · 18:00',       format: 'PDF', recipients: 8, lastRun: 'Today', status: 'ok' },
  ];

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Reports</h1>
          <div className="page__sub">Scheduled exports, deliveries, and ad-hoc downloads.</div>
        </div>
        <div className="page__actions">
          <Btn kind="secondary" size="sm" icon={IcoDownload} onClick={() => setShowExport(true)}>One-off export</Btn>
          {role !== 'viewer' && <Btn kind="primary" size="sm" icon={IcoPlus}>New report</Btn>}
        </div>
      </div>

      <Card padding={false}>
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Cadence</th><th>Format</th><th>Recipients</th><th>Last run</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {REPORTS.map(r => (
              <tr key={r.id}>
                <td>
                  <span style={{ fontWeight: 500 }}>{r.name}</span>
                  <div className="text-xs mono muted">{r.id}</div>
                </td>
                <td className="muted text-xs">{r.cadence}</td>
                <td><Badge kind="outline">{r.format}</Badge></td>
                <td className="muted">{r.recipients}</td>
                <td className="muted text-xs">{r.lastRun}</td>
                <td><Badge kind="ok" dot="ok">Healthy</Badge></td>
                <td><Btn kind="ghost" size="sm" icon={IcoMore} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {showExport && <ExportModal devices={devices} onClose={() => setShowExport(false)} />}
    </div>
  );
}
