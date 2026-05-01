import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api.js';
import { format } from 'date-fns';

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
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 w-full max-w-md">
          <h3 className="font-bold text-lg mb-4 text-green-700">✅ Device created!</h3>
          <p className="text-sm text-gray-600 mb-2">Save this API key — it won't be shown again:</p>
          <div className="bg-gray-100 rounded-lg p-3 font-mono text-sm break-all mb-4">{newKey}</div>
          <button onClick={() => { onSaved(); onClose(); }} className="btn-primary w-full justify-center">Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <h3 className="font-bold text-lg mb-4">Add Device</h3>
        {error && <div className="mb-3 p-2 bg-red-50 text-red-700 text-sm rounded">{error}</div>}
        <form onSubmit={submit} className="space-y-3">
          <div><label className="label">Name *</label><input required className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">Description</label><input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div>
            <label className="label">Group</label>
            <select className="input" value={form.groupId} onChange={e => setForm(f => ({ ...f, groupId: e.target.value }))}>
              <option value="">— No group —</option>
              {groups?.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
            </select>
          </div>
          <div><label className="label">Location Name</label><input className="input" value={form.locationName} onChange={e => setForm(f => ({ ...f, locationName: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Latitude</label><input type="number" step="any" className="input" value={form.lat} onChange={e => setForm(f => ({ ...f, lat: e.target.value }))} /></div>
            <div><label className="label">Longitude</label><input type="number" step="any" className="input" value={form.lon} onChange={e => setForm(f => ({ ...f, lon: e.target.value }))} /></div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center">Create</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DevicesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: () => api.listDevices({ limit: 100 }),
    refetchInterval: 30_000,
  });

  const { data: groups } = useQuery({ queryKey: ['device-groups'], queryFn: api.listGroups });

  const rotateMut = useMutation({
    mutationFn: (id) => api.rotateKey(id),
    onSuccess: () => alert('New API key generated. Check the response.'),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.deleteDevice(id),
    onSuccess: () => qc.invalidateQueries(['devices']),
  });

  const devices = (data?.devices || []).filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('devices.title')}</h1>
          <p className="text-gray-500 mt-1">{data?.total ?? 0} devices registered</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">{t('devices.addDevice')}</button>
      </div>

      <div className="flex gap-3">
        <input
          className="input max-w-xs"
          placeholder={t('common.search') + '...'}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Status', 'Name', 'Group', 'Location', 'Last Seen', 'Battery', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading
              ? <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">{t('common.loading')}</td></tr>
              : devices.length === 0
              ? <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">{t('common.noData')}</td></tr>
              : devices.map(d => (
                <tr key={d._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`w-2.5 h-2.5 rounded-full inline-block ${
                      d.status === 'online' ? 'bg-green-500' :
                      d.status === 'alert' ? 'bg-red-500' : 'bg-gray-400'
                    }`} />
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{d.name}</td>
                  <td className="px-4 py-3 text-gray-500">{groups?.find(g => g._id === d.groupId)?.name || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{d.locationName || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {d.lastSeenAt ? format(new Date(d.lastSeenAt), 'MMM d, HH:mm') : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {d.batteryLevel != null ? `${d.batteryLevel}%` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => rotateMut.mutate(d._id)}
                        className="text-xs text-primary-600 hover:underline"
                      >
                        Rotate Key
                      </button>
                      <button
                        onClick={() => { if (confirm('Delete device?')) deleteMut.mutate(d._id); }}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

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
