import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api.js';
import { format } from 'date-fns';

const CONTENT_TYPES = ['event', 'news', 'announcement', 'advertisement'];
const TYPE_COLORS = {
  event: 'badge-blue', news: 'badge-green',
  announcement: 'badge-yellow', advertisement: 'badge-gray',
};

function ContentModal({ groups, onClose, onSaved }) {
  const [form, setForm] = useState({ type: 'announcement', title: '', body: '', mediaUrl: '', priority: 5 });
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.createEcalContent(form);
      onSaved();
      onClose();
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
        <h3 className="font-bold text-lg mb-4">Create Content</h3>
        {error && <div className="mb-3 p-2 bg-red-50 text-red-700 text-sm rounded">{error}</div>}
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {CONTENT_TYPES.map(t => <option key={t} className="capitalize">{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Priority (1=high, 10=low)</label>
              <input type="number" min={1} max={10} className="input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) }))} />
            </div>
          </div>
          <div><label className="label">Title *</label><input required className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
          <div><label className="label">Body</label><textarea className="input" rows={3} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} /></div>
          <div><label className="label">Media URL</label><input type="url" className="input" value={form.mediaUrl} onChange={e => setForm(f => ({ ...f, mediaUrl: e.target.value }))} /></div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center">Create</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CampaignModal({ content, groups, onClose, onSaved }) {
  const [form, setForm] = useState({
    contentId: content?._id || '',
    groupId: '',
    startsAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    endsAt: format(new Date(Date.now() + 7 * 86400000), "yyyy-MM-dd'T'HH:mm"),
    displayDurationS: 30,
  });
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.createEcalCampaign(form);
      onSaved();
      onClose();
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
        <h3 className="font-bold text-lg mb-4">Schedule Campaign</h3>
        {error && <div className="mb-3 p-2 bg-red-50 text-red-700 text-sm rounded">{error}</div>}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Device Group *</label>
            <select required className="input" value={form.groupId} onChange={e => setForm(f => ({ ...f, groupId: e.target.value }))}>
              <option value="">Select group...</option>
              {groups?.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Start</label><input required type="datetime-local" className="input" value={form.startsAt} onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))} /></div>
            <div><label className="label">End</label><input required type="datetime-local" className="input" value={form.endsAt} onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))} /></div>
          </div>
          <div><label className="label">Display Duration (seconds)</label><input type="number" min={5} className="input" value={form.displayDurationS} onChange={e => setForm(f => ({ ...f, displayDurationS: parseInt(e.target.value) }))} /></div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center">Schedule</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ECalendarPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState('content');
  const [showContent, setShowContent] = useState(false);
  const [campaignFor, setCampaignFor] = useState(null);

  const { data: content } = useQuery({ queryKey: ['ecal-content'], queryFn: () => api.listEcalContent({}) });
  const { data: campaigns } = useQuery({ queryKey: ['ecal-campaigns'], queryFn: api.listEcalCampaigns });
  const { data: groups } = useQuery({ queryKey: ['ecal-groups'], queryFn: api.listEcalGroups });
  const { data: devices } = useQuery({ queryKey: ['ecal-devices'], queryFn: api.listEcalDevices });

  const delContent = useMutation({ mutationFn: api.deleteEcalContent, onSuccess: () => qc.invalidateQueries(['ecal-content']) });
  const delCampaign = useMutation({ mutationFn: api.deleteEcalCampaign, onSuccess: () => qc.invalidateQueries(['ecal-campaigns']) });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('nav.ecalendar')}</h1>
          <p className="text-gray-500 mt-1">Manage digital display content and campaigns</p>
        </div>
        {tab === 'content' && <button onClick={() => setShowContent(true)} className="btn-primary">Add Content</button>}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Display Devices', value: devices?.length ?? 0, icon: '🖥' },
          { label: 'Device Groups', value: groups?.length ?? 0, icon: '📁' },
          { label: 'Active Campaigns', value: campaigns?.filter(c => new Date(c.endsAt) > new Date()).length ?? 0, icon: '📢' },
        ].map(s => (
          <div key={s.label} className="card flex items-center gap-3">
            <span className="text-2xl">{s.icon}</span>
            <div>
              <div className="text-xl font-bold text-gray-900">{s.value}</div>
              <div className="text-sm text-gray-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {[['content', 'Content Library'], ['campaigns', 'Campaigns'], ['devices', 'Display Devices']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === id ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'content' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {!content?.length
            ? <div className="col-span-3 card text-center text-gray-400 py-12">No content yet</div>
            : content.map(c => (
              <div key={c._id} className="card hover:shadow-md transition-shadow">
                {c.mediaUrl && (
                  <div className="mb-3 rounded-lg overflow-hidden bg-gray-100 h-32 flex items-center justify-center">
                    <img src={c.mediaUrl} alt={c.title} className="w-full h-full object-cover" onError={e => { e.target.style.display='none'; }} />
                  </div>
                )}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className={`badge ${TYPE_COLORS[c.type]}`}>{c.type}</span>
                  <span className="text-xs text-gray-400">Priority {c.priority}</span>
                </div>
                <h3 className="font-semibold text-gray-900">{c.title}</h3>
                {c.body && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{c.body}</p>}
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setCampaignFor(c)} className="btn-primary text-xs py-1">Schedule</button>
                  <button onClick={() => { if (confirm('Delete?')) delContent.mutate(c._id); }} className="btn-secondary text-xs py-1">Delete</button>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {tab === 'campaigns' && (
        <div className="space-y-3">
          {!campaigns?.length
            ? <div className="card text-center text-gray-400 py-12">No campaigns scheduled</div>
            : campaigns.map(c => {
              const now = new Date();
              const active = new Date(c.startsAt) <= now && new Date(c.endsAt) >= now;
              return (
                <div key={c._id} className="card flex items-center gap-4">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${active ? 'bg-green-500' : new Date(c.endsAt) < now ? 'bg-gray-400' : 'bg-yellow-500'}`} />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">Group: {groups?.find(g => g._id === c.groupId)?.name || c.groupId}</div>
                    <div className="text-sm text-gray-500">
                      {format(new Date(c.startsAt), 'MMM d, HH:mm')} → {format(new Date(c.endsAt), 'MMM d, HH:mm')} · {c.displayDurationS}s each
                    </div>
                  </div>
                  <span className={`badge ${active ? 'badge-green' : new Date(c.endsAt) < now ? 'badge-gray' : 'badge-yellow'}`}>
                    {active ? 'Active' : new Date(c.endsAt) < now ? 'Ended' : 'Scheduled'}
                  </span>
                  <button onClick={() => { if (confirm('Remove campaign?')) delCampaign.mutate(c._id); }} className="text-xs text-red-600 hover:underline">Remove</button>
                </div>
              );
            })
          }
        </div>
      )}

      {tab === 'devices' && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{['Name','Location','Group','Status','Last Seen'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {!devices?.length
                ? <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No display devices</td></tr>
                : devices.map(d => (
                  <tr key={d._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{d.name}</td>
                    <td className="px-4 py-3 text-gray-500">{d.location || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{groups?.find(g => g._id === d.groupId)?.name || '—'}</td>
                    <td className="px-4 py-3"><span className={`badge ${d.status === 'online' ? 'badge-green' : 'badge-gray'}`}>{d.status}</span></td>
                    <td className="px-4 py-3 text-gray-500">{d.lastSeenAt ? format(new Date(d.lastSeenAt), 'MMM d, HH:mm') : 'Never'}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}

      {showContent && (
        <ContentModal groups={groups} onClose={() => setShowContent(false)} onSaved={() => qc.invalidateQueries(['ecal-content'])} />
      )}
      {campaignFor && (
        <CampaignModal
          content={campaignFor}
          groups={groups}
          onClose={() => setCampaignFor(null)}
          onSaved={() => { qc.invalidateQueries(['ecal-campaigns']); setCampaignFor(null); }}
        />
      )}
    </div>
  );
}
