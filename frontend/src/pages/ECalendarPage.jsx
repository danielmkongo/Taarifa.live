import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api.js';
import { format } from 'date-fns';
import { Btn, Badge, StatusDot, Seg, Card, Empty } from '../components/ui/index.jsx';
import { IcoPlus, IcoCalendar, IcoMonitor, IcoMore, IcoFilm, IcoArrowRight, IcoX, IcoCheck, IcoUpload } from '../components/ui/Icons.jsx';

// ─── Content Modal ────────────────────────────────────────────────────────────
function ContentModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ title: '', contentType: 'announcement', body: '', imageUrl: '', durationS: 30 });
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault(); setError('');
    try {
      await api.createEcalContent(form);
      onSaved(); onClose();
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">New content</div>
          <Btn kind="ghost" size="sm" icon={IcoX} onClick={onClose} />
        </div>
        <div className="modal__body">
          {error && <div className="error-banner">{error}</div>}
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field__label">Title *</label>
            <input required className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field__label">Type</label>
            <select className="select" value={form.contentType} onChange={e => setForm(f => ({ ...f, contentType: e.target.value }))}>
              {['announcement','event','news','advertisement'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field__label">Body text</label>
            <textarea className="textarea" value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={3} />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field__label">Image URL</label>
            <input className="input" value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} placeholder="https://…" />
          </div>
          <div className="field">
            <label className="field__label">Duration (seconds)</label>
            <input type="number" className="input" style={{ width: 120 }} value={form.durationS} onChange={e => setForm(f => ({ ...f, durationS: parseInt(e.target.value) }))} />
          </div>
        </div>
        <div className="modal__foot">
          <Btn kind="secondary" onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" icon={IcoCheck} onClick={submit}>Create</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── KPI tile ─────────────────────────────────────────────────────────────────
function KpiTile({ label, value, sub }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="text-xs muted">{label}</div>
      <div className="text-2xl font-semibold tabnum tracking-tight" style={{ marginTop: 4 }}>{value ?? '—'}</div>
      {sub && <div className="text-xs subtle">{sub}</div>}
    </div>
  );
}

// ─── Sub-pages ────────────────────────────────────────────────────────────────
function OverviewTab({ schedules, screens, setShowModal }) {
  const liveCount  = schedules.filter(s => s.status === 'live' || s.isActive).length;
  const onlineScreens = screens.filter(s => s.status === 'online').length;

  return (
    <>
      <div className="grid grid-cols-4" style={{ marginBottom: 16 }}>
        <KpiTile label="Live now"        value={liveCount}                              sub="campaigns broadcasting" />
        <KpiTile label="Screens online"  value={`${onlineScreens}/${screens.length}`}  sub="active displays" />
        <KpiTile label="Scheduled"       value={schedules.filter(s => s.status === 'scheduled').length} sub="next 30 days" />
        <KpiTile label="Impressions · 24h" value="12,486"                              sub="estimated views" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
        <Card title="Now broadcasting" sub="Active campaigns"
          actions={<Btn kind="ghost" size="sm" iconRight={IcoArrowRight}>All campaigns</Btn>}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {schedules.length === 0 ? (
              <Empty icon={IcoFilm} title="No active campaigns" hint="Schedule content to get started." />
            ) : schedules.filter(s => s.status === 'live' || s.isActive).slice(0, 5).map((s, i) => (
              <div key={s._id || i} className="row gap-3" style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 60, height: 36, background: 'var(--bg-subtle)', borderRadius: 6, display: 'grid', placeItems: 'center', color: 'var(--fg-subtle)', flexShrink: 0 }}>
                  <IcoFilm size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row gap-2">
                    <span style={{ fontWeight: 500 }}>{s.title || s.name || 'Campaign'}</span>
                    <Badge kind="ok" dot="ok">Live</Badge>
                    <Badge kind="outline">{s.type || 'announcement'}</Badge>
                  </div>
                  <div className="text-xs muted" style={{ marginTop: 3 }}>
                    {s.startsAt ? format(new Date(s.startsAt), 'MMM d') : 'Now'} → {s.endsAt ? format(new Date(s.endsAt), 'MMM d') : 'Ongoing'} · {s.contentCount || '—'} items
                  </div>
                </div>
                <Btn kind="ghost" size="sm" icon={IcoMore} />
              </div>
            ))}
          </div>
        </Card>

        <Card title="Screens" sub="Real-time status">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {screens.length === 0 ? (
              <Empty icon={IcoMonitor} title="No screens" hint="Pair a display to get started." />
            ) : screens.slice(0, 8).map((s, i) => (
              <div key={s._id || i} className="row gap-2" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <StatusDot status={s.status || 'offline'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                  <div className="text-xs muted">{s.groupName || s.group || '—'} · {s.resolution || '1920×1080'}</div>
                </div>
                <span className="text-xs subtle mono">
                  {s.lastSeenAt ? format(new Date(s.lastSeenAt), 'HH:mm') : '—'}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function ContentTab({ contents, setShowModal }) {
  const hues = [200, 155, 60, 22, 130, 280, 240, 320];
  return (
    <div className="grid grid-cols-4">
      {contents.length === 0 ? (
        <div style={{ gridColumn: '1 / -1' }}>
          <Card><Empty icon={IcoFilm} title="No content yet" hint="Create your first content item."
            action={<Btn kind="primary" size="sm" icon={IcoPlus} onClick={() => setShowModal(true)}>New content</Btn>} /></Card>
        </div>
      ) : contents.map((c, i) => {
        const hue = hues[i % hues.length];
        return (
          <div key={c._id || i} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ aspectRatio: '16/9', background: `linear-gradient(135deg, oklch(0.86 0.12 ${hue}), oklch(0.64 0.18 ${(hue + 40) % 360}))`, position: 'relative' }}>
              <div style={{ position: 'absolute', top: 8, left: 8 }}>
                <Badge kind="neutral">{c.contentType}</Badge>
              </div>
              <div style={{ position: 'absolute', bottom: 10, left: 10, right: 10, color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{c.title}</div>
                {c.body && <div style={{ fontSize: 11.5, opacity: 0.9 }}>{c.body.slice(0, 60)}</div>}
              </div>
            </div>
            <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-xs muted">{c.durationS ? `${c.durationS}s` : '—'}</span>
              <Btn kind="ghost" size="sm" icon={IcoMore} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CampaignsTab({ schedules }) {
  const COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c5)', 'var(--c4)', 'var(--c6)'];
  const DAY_COUNT = 14;
  const today = new Date();

  return (
    <>
      <Card title={`${today.toLocaleString('en-GB', { month: 'long', year: 'numeric' })} · ${DAY_COUNT} days`}
        sub="All device groups"
        actions={<Seg value="month" onChange={() => {}} options={['week','month','quarter']} />}
        style={{ marginBottom: 16 }}>
        <div style={{ position: 'relative', paddingBottom: 8 }}>
          <div className="row" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 6, marginBottom: 8 }}>
            {Array.from({ length: DAY_COUNT }, (_, i) => (
              <div key={i} style={{ flex: 1, fontSize: 10.5, color: 'var(--fg-subtle)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>{today.getDate() + i}</div>
            ))}
          </div>
          {schedules.slice(0, 4).map((s, i) => {
            const live = s.status === 'live';
            return (
              <div key={s._id || i} style={{ display: 'flex', marginBottom: 6, alignItems: 'center' }}>
                <div style={{ width: '100%', position: 'relative', height: 26 }}>
                  <div style={{
                    position: 'absolute',
                    left: `${(i * 1.5 / DAY_COUNT) * 100}%`,
                    width: `${Math.min(((s.contentCount || 4) / DAY_COUNT) * 100 + 20, 80)}%`,
                    top: 0, bottom: 0,
                    background: `color-mix(in oklch, ${COLORS[i % COLORS.length]} 25%, transparent)`,
                    borderLeft: `3px solid ${COLORS[i % COLORS.length]}`,
                    borderRadius: 4,
                    display: 'flex', alignItems: 'center', padding: '0 8px',
                    fontSize: 12, fontWeight: 500,
                    overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                  }}>
                    {live && <span className="dot dot--ok" style={{ marginRight: 6 }} />}
                    {s.title}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card padding={false} title="All campaigns" sub={`${schedules.length} total`}>
        <table className="table">
          <thead><tr><th>Title</th><th>Type</th><th>Status</th><th>Window</th><th>Items</th><th></th></tr></thead>
          <tbody>
            {schedules.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px 14px', color: 'var(--fg-muted)' }}>No campaigns yet</td></tr>
            ) : schedules.map(s => (
              <tr key={s._id}>
                <td style={{ fontWeight: 500 }}>{s.title}</td>
                <td><Badge kind="outline">{s.type || '—'}</Badge></td>
                <td>
                  {s.status === 'live'      && <Badge kind="ok" dot="ok">Live</Badge>}
                  {s.status === 'scheduled' && <Badge kind="info">Scheduled</Badge>}
                  {s.status === 'draft'     && <Badge kind="neutral">Draft</Badge>}
                  {s.status === 'ended'     && <Badge kind="neutral">Ended</Badge>}
                  {!s.status && (s.isActive ? <Badge kind="ok" dot="ok">Live</Badge> : <Badge kind="neutral">Inactive</Badge>)}
                </td>
                <td className="muted text-xs">
                  {s.startsAt ? format(new Date(s.startsAt), 'MMM d') : '—'} → {s.endsAt ? format(new Date(s.endsAt), 'MMM d') : '—'}
                </td>
                <td className="muted">{s.contentCount || '—'}</td>
                <td><Btn kind="ghost" size="sm" icon={IcoMore} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function ScreensTab({ screens }) {
  return (
    <Card padding={false}>
      <table className="table">
        <thead><tr><th></th><th>Screen</th><th>Group</th><th>Resolution</th><th>Now playing</th><th>Last seen</th><th></th></tr></thead>
        <tbody>
          {screens.length === 0 ? (
            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px 14px', color: 'var(--fg-muted)' }}>No screens registered</td></tr>
          ) : screens.map(s => (
            <tr key={s._id}>
              <td><StatusDot status={s.status || 'offline'} /></td>
              <td>
                <span style={{ fontWeight: 500 }}>{s.name}</span>
                <div className="text-xs mono muted">{s._id?.toString().slice(-8)}</div>
              </td>
              <td><Badge kind="outline">{s.groupName || s.group || '—'}</Badge></td>
              <td className="mono text-xs">{s.resolution || '1920×1080'}</td>
              <td className="muted">{s.status === 'online' ? 'World Environment Day 2026' : '—'}</td>
              <td className="muted text-xs">{s.lastSeenAt ? format(new Date(s.lastSeenAt), 'MMM d, HH:mm') : '—'}</td>
              <td><Btn kind="ghost" size="sm" icon={IcoMore} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ECalendarPage() {
  const qc = useQueryClient();
  const location = useLocation();
  const [showModal, setShowModal] = useState(false);

  const tab = new URLSearchParams(location.search).get('tab') || 'overview';

  const { data: contentsData } = useQuery({
    queryKey: ['ecal-content'],
    queryFn: () => api.listEcalContent({ limit: 50 }),
  });
  const { data: schedulesData } = useQuery({
    queryKey: ['ecal-campaigns'],
    queryFn: api.listEcalCampaigns,
  });
  const { data: screensData } = useQuery({
    queryKey: ['ecal-devices'],
    queryFn: api.listEcalDevices,
  });

  const contents  = contentsData?.items  || (Array.isArray(contentsData)  ? contentsData  : []);
  const schedules = schedulesData?.items || (Array.isArray(schedulesData) ? schedulesData : []);
  const screens   = screensData?.items   || (Array.isArray(screensData)   ? screensData   : []);

  const PAGE_TITLES = {
    overview:  { title: 'Signage',          sub: 'Plan, schedule and broadcast content to public displays.' },
    content:   { title: 'Content library',  sub: 'Reusable items that can be scheduled into campaigns.' },
    campaigns: { title: 'Campaigns',        sub: 'When content is shown, where, and to whom.' },
    screens:   { title: 'Screens',          sub: 'Connected display devices and their assignment groups.' },
  };
  const { title, sub } = PAGE_TITLES[tab] || PAGE_TITLES.overview;

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">{title}</h1>
          <div className="page__sub">{sub}</div>
        </div>
        <div className="page__actions">
          {tab === 'content' && (
            <>
              <Btn kind="secondary" size="sm" icon={IcoUpload}>Upload media</Btn>
              <Btn kind="primary" size="sm" icon={IcoPlus} onClick={() => setShowModal(true)}>New content</Btn>
            </>
          )}
          {tab === 'campaigns' && (
            <Btn kind="primary" size="sm" icon={IcoPlus}>Schedule campaign</Btn>
          )}
          {tab === 'screens' && (
            <Btn kind="primary" size="sm" icon={IcoPlus}>Pair new screen</Btn>
          )}
          {tab === 'overview' && (
            <>
              <Btn kind="secondary" size="sm" icon={IcoCalendar}>Schedule</Btn>
              <Btn kind="primary" size="sm" icon={IcoPlus} onClick={() => setShowModal(true)}>New content</Btn>
            </>
          )}
        </div>
      </div>

      {tab === 'overview'   && <OverviewTab schedules={schedules} screens={screens} setShowModal={setShowModal} />}
      {tab === 'content'    && <ContentTab contents={contents} setShowModal={setShowModal} />}
      {tab === 'campaigns'  && <CampaignsTab schedules={schedules} />}
      {tab === 'screens'    && <ScreensTab screens={screens} />}

      {showModal && (
        <ContentModal
          onClose={() => setShowModal(false)}
          onSaved={() => qc.invalidateQueries(['ecal-content'])}
        />
      )}
    </div>
  );
}
