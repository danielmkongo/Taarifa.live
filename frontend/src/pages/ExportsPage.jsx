import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api.js';
import { format, subDays } from 'date-fns';

export default function ExportsPage() {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    deviceId: '', sensorKey: '', format: 'csv',
    from: format(subDays(new Date(), 7), "yyyy-MM-dd'T'HH:mm"),
    to:   format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  });
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState('');

  const { data: devicesData } = useQuery({ queryKey: ['devices'], queryFn: () => api.listDevices({ limit: 100 }) });
  const devices = devicesData?.devices || [];

  const exportMut = useMutation({
    mutationFn: api.createExport,
    onSuccess: (data) => {
      setJobs(j => [{ ...data, status: 'pending', createdAt: new Date().toISOString() }, ...j]);
      pollJob(data.jobId);
    },
    onError: (err) => setError(err.message),
  });

  async function pollJob(jobId) {
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const job = await api.getExportJob(jobId);
        setJobs(j => j.map(jb => jb.jobId === jobId ? { ...jb, ...job } : jb));
        if (job.status === 'ready' || job.status === 'failed') break;
      } catch {}
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    exportMut.mutate(form);
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('common.export')} Data</h1>
        <p className="text-gray-500 mt-1">Download sensor data as CSV or Excel</p>
      </div>

      <div className="card max-w-xl">
        <h2 className="font-semibold text-gray-900 mb-4">New Export</h2>
        {error && <div className="mb-3 p-2 bg-red-50 text-red-700 text-sm rounded">{error}</div>}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Device *</label>
            <select required className="input" value={form.deviceId} onChange={e => setForm(f => ({ ...f, deviceId: e.target.value }))}>
              <option value="">Select device...</option>
              {devices.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Sensor (optional — all sensors if blank)</label>
            <input className="input" value={form.sensorKey} placeholder="temperature, humidity..." onChange={e => setForm(f => ({ ...f, sensorKey: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">From</label><input required type="datetime-local" className="input" value={form.from} onChange={e => setForm(f => ({ ...f, from: e.target.value }))} /></div>
            <div><label className="label">To</label><input required type="datetime-local" className="input" value={form.to} onChange={e => setForm(f => ({ ...f, to: e.target.value }))} /></div>
          </div>
          <div>
            <label className="label">Format</label>
            <div className="flex gap-2">
              {['csv', 'excel'].map(fmt => (
                <button type="button" key={fmt} onClick={() => setForm(f => ({ ...f, format: fmt }))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    form.format === fmt ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}>
                  {fmt.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" disabled={exportMut.isPending} className="btn-primary">
            {exportMut.isPending ? 'Requesting...' : 'Request Export'}
          </button>
        </form>
      </div>

      {jobs.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Export Jobs</h2>
          <div className="space-y-3">
            {jobs.map((job, i) => (
              <div key={job.jobId || i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="text-sm font-medium text-gray-900">Export #{job.jobId?.slice(-6)}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{format(new Date(job.createdAt), 'MMM d, HH:mm')}</div>
                </div>
                <div className="flex items-center gap-3">
                  {job.rowCount && <span className="text-xs text-gray-500">{job.rowCount.toLocaleString()} rows</span>}
                  <span className={`badge ${
                    job.status === 'ready' ? 'badge-green' :
                    job.status === 'failed' ? 'badge-red' :
                    job.status === 'processing' ? 'badge-blue' : 'badge-gray'
                  }`}>
                    {job.status}
                  </span>
                  {job.status === 'ready' && (
                    <a href={api.downloadExport(job.jobId || job._id)} download
                      className="btn-primary py-1 text-xs">
                      {t('common.download')}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
