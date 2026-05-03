import { useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api.js';
import { format, formatDistanceToNow, isAfter, isBefore } from 'date-fns';
import { Btn, Badge, StatusDot, Card, Empty } from '../components/ui/index.jsx';
import {
  IcoPlus, IcoMonitor, IcoMore, IcoX, IcoCheck,
  IcoArrowRight, IcoSettings, IcoRefresh, IcoUpload,
  IcoZap, IcoFlame, IcoExternal, IcoLayers,
} from '../components/ui/Icons.jsx';

// ─── Priority config ────────────────────────────────────────────────────────────
const PRIORITIES = [
  { value: 'critical', label: 'Critical', color: '#ef4444', kind: 'error'   },
  { value: 'high',     label: 'High',     color: '#f59e0b', kind: 'warning' },
  { value: 'normal',   label: 'Normal',   color: '#3b82f6', kind: 'info'    },
  { value: 'low',      label: 'Low',      color: '#94a3b8', kind: 'neutral' },
];
const CONTENT_TYPES = ['announcement', 'emergency', 'news', 'event', 'advertisement', 'weather'];
const ZONES         = ['main', 'header', 'ticker', 'sidebar', 'footer'];
const ANIMATIONS    = ['fade', 'slide-left', 'slide-right', 'none'];
const TEXT_SIZES    = ['small', 'medium', 'large', 'xlarge'];
const TYPE_HUE      = { announcement: 210, emergency: 0, news: 155, event: 280, advertisement: 40, weather: 200 };

function priorityBadge(p) {
  const cfg = PRIORITIES.find(x => x.value === p) || PRIORITIES[2];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600,
      padding: '2px 7px', borderRadius: 4,
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

// ─── Content Preview Modal ──────────────────────────────────────────────────────
function ContentPreviewModal({ content, onClose }) {
  const dc        = content.displayConfig || {};
  const zone      = content.zone || 'main';
  const hue       = TYPE_HUE[content.type] ?? 200;
  const baseBg    = dc.bgColor || `oklch(0.12 0.04 ${hue})`;
  const accentClr = `oklch(0.65 0.20 ${hue})`;
  const textClr   = dc.textColor || '#ffffff';
  const fontSize  = { small: 11, medium: 14, large: 19, xlarge: 28 }[dc.textSize || 'medium'];

  const renderZoneContent = (z) => {
    const isActive = z === zone;
    if (!isActive) return null;

    const inner = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%', justifyContent: z === 'header' || z === 'footer' || z === 'ticker' ? 'center' : 'flex-start', padding: z === 'ticker' ? '0 12px' : z === 'header' || z === 'footer' ? '0 14px' : 14 }}>
        {z !== 'ticker' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {priorityBadge(content.priority)}
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{content.type}</span>
          </div>
        )}
        {content.mediaUrl && z === 'main' && (
          <div style={{ borderRadius: 6, overflow: 'hidden', maxHeight: 120, background: 'rgba(0,0,0,0.3)' }}>
            <img src={content.mediaUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={e => { e.target.style.display = 'none'; }} />
          </div>
        )}
        <div style={{ fontSize: z === 'ticker' ? 13 : z === 'header' || z === 'footer' ? 13 : fontSize, fontWeight: z === 'header' || z === 'footer' ? 600 : 700, color: textClr, lineHeight: 1.3,
          ...(dc.autoScroll && z === 'ticker' ? { animation: `ecal-scroll ${dc.scrollSpeed === 'slow' ? '18s' : dc.scrollSpeed === 'fast' ? '6s' : '11s'} linear infinite`, whiteSpace: 'nowrap', display: 'inline-block' } : {}),
        }}>
          {content.title}
        </div>
        {content.body && z !== 'ticker' && z !== 'header' && (
          <div style={{ fontSize: Math.max(10, fontSize - 3), color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
            {content.body}
          </div>
        )}
        {z !== 'ticker' && z !== 'header' && (
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 'auto' }}>
            {content.durationS}s · {content.target?.scope === 'global' ? 'All screens' : content.target?.scope}
          </div>
        )}
      </div>
    );

    return inner;
  };

  const zoneStyle = (z) => ({
    background: z === zone ? baseBg : 'rgba(255,255,255,0.03)',
    border: z === zone ? `1px solid color-mix(in oklch, ${accentClr} 40%, transparent)` : '1px solid rgba(255,255,255,0.06)',
    borderRadius: 4, overflow: 'hidden', position: 'relative',
    boxShadow: z === zone ? `inset 0 0 40px color-mix(in oklch, ${accentClr} 10%, transparent)` : 'none',
    transition: 'all 0.2s',
  });

  const zoneLabel = (z) => (
    <div style={{ position: 'absolute', top: 4, right: 6, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: z === zone ? accentClr : 'rgba(255,255,255,0.2)', zIndex: 2 }}>{z}</div>
  );

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ alignItems: 'center', zIndex: 300 }}>
      <div style={{ width: '90vw', maxWidth: 900, background: 'var(--bg-elev)', borderRadius: 14, border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.3)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <IcoMonitor size={16} style={{ color: 'var(--fg-muted)' }} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>Content Preview</span>
            <span className="text-xs muted">· {content.title}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {priorityBadge(content.priority)}
            <Badge kind="outline">{zone}</Badge>
            <Btn kind="ghost" size="sm" icon={IcoX} onClick={onClose} />
          </div>
        </div>

        {/* Display */}
        <div style={{ padding: '20px 24px' }}>
          {/* Monitor bezel */}
          <div style={{ background: '#111318', borderRadius: 10, padding: 14, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)', marginBottom: 14 }}>
            {/* Screen */}
            <div style={{ aspectRatio: '16/9', background: '#080b0f', borderRadius: 6, display: 'grid', overflow: 'hidden',
              gridTemplateAreas: '"head head" "main side" "foot foot" "tick tick"',
              gridTemplateRows: '42px 1fr 34px 30px',
              gridTemplateColumns: '1fr 200px',
              gap: 2, padding: 2 }}>

              <div style={{ gridArea: 'head', ...zoneStyle('header') }}>
                {zoneLabel('header')}
                {renderZoneContent('header') || (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', padding: '0 14px', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.06)' }} />
                    <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)' }} />
                    <div style={{ width: 60, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.04)' }} />
                  </div>
                )}
              </div>

              <div style={{ gridArea: 'main', ...zoneStyle('main') }}>
                {zoneLabel('main')}
                {renderZoneContent('main') || (
                  <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ height: 10, borderRadius: 4, background: 'rgba(255,255,255,0.06)', width: '60%' }} />
                    <div style={{ height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.04)', width: '80%' }} />
                    <div style={{ height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.04)', width: '50%' }} />
                  </div>
                )}
              </div>

              <div style={{ gridArea: 'side', ...zoneStyle('sidebar') }}>
                {zoneLabel('sidebar')}
                {renderZoneContent('sidebar') || (
                  <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {[80, 60, 70, 45].map((w, i) => (
                      <div key={i} style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.05)', width: `${w}%` }} />
                    ))}
                  </div>
                )}
              </div>

              <div style={{ gridArea: 'foot', ...zoneStyle('footer') }}>
                {zoneLabel('footer')}
                {renderZoneContent('footer') || (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', padding: '0 14px', gap: 8 }}>
                    <div style={{ height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.05)', width: '40%' }} />
                    <div style={{ flex: 1 }} />
                    <div style={{ height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.04)', width: '20%' }} />
                  </div>
                )}
              </div>

              <div style={{ gridArea: 'tick', ...zoneStyle('ticker'), overflow: 'hidden' }}>
                {zoneLabel('ticker')}
                {renderZoneContent('ticker') || (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', padding: '0 12px', overflow: 'hidden' }}>
                    <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', width: '90%' }} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stand */}
          <div style={{ display: 'flex', justifyContent: 'center', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
            <div style={{ width: 48, height: 10, background: '#111318', borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }} />
            <div style={{ width: 80, height: 4, background: '#0d1014', borderRadius: 2 }} />
          </div>
        </div>

        {/* Settings summary */}
        <div style={{ padding: '12px 24px 20px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { l: 'Zone', v: zone },
            { l: 'Duration', v: `${content.durationS}s` },
            { l: 'Animation', v: dc.animation || 'fade' },
            { l: 'Text size', v: dc.textSize || 'medium' },
            dc.autoScroll && { l: 'Auto-scroll', v: `${dc.scrollSpeed || 'normal'} speed` },
            dc.bgColor && { l: 'BG', v: dc.bgColor },
          ].filter(Boolean).map(s => (
            <div key={s.l} style={{ display: 'flex', gap: 4, fontSize: 12, padding: '4px 10px', borderRadius: 20, background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--fg-muted)' }}>{s.l}:</span>
              <span style={{ fontWeight: 600 }}>{s.v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Content Modal ──────────────────────────────────────────────────────────────
const EMPTY_DC = { autoScroll: false, scrollSpeed: 'normal', animation: 'fade', textSize: 'medium', bgColor: '', textColor: '' };

function ContentModal({ onClose, onSaved, groups = [], devices = [], initial = null }) {
  const [tab, setTab]         = useState('content');
  const [mediaMode, setMediaMode] = useState('url');
  const [form, setForm] = useState({
    title:        initial?.title         || '',
    type:         initial?.type          || 'announcement',
    priority:     initial?.priority      || 'normal',
    body:         initial?.body          || '',
    mediaUrl:     initial?.mediaUrl      || '',
    zone:         initial?.zone          || 'main',
    targetScope:  initial?.target?.scope || 'global',
    targetId:     initial?.target?.id?.toString() || '',
    startAt:      initial?.schedule?.startAt ? format(new Date(initial.schedule.startAt), "yyyy-MM-dd'T'HH:mm") : '',
    endAt:        initial?.schedule?.endAt   ? format(new Date(initial.schedule.endAt),   "yyyy-MM-dd'T'HH:mm") : '',
    durationS:    initial?.durationS     ?? 30,
    displayConfig: { ...EMPTY_DC, ...(initial?.displayConfig || {}) },
  });
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const set  = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setDC = (k, v) => setForm(f => ({ ...f, displayConfig: { ...f.displayConfig, [k]: v } }));
  const dc   = form.displayConfig;

  function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => set('mediaUrl', ev.target.result);
    reader.readAsDataURL(file);
  }

  async function submit(e) {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      const payload = {
        type: form.type, title: form.title, body: form.body || undefined,
        mediaUrl: form.mediaUrl || undefined,
        priority: form.priority, zone: form.zone,
        target: { scope: form.targetScope, id: form.targetId || undefined },
        schedule: { startAt: form.startAt || undefined, endAt: form.endAt || undefined },
        durationS: Number(form.durationS),
        displayConfig: form.displayConfig,
      };
      if (initial?._id) await api.updateEcalContent(initial._id, payload);
      else              await api.createEcalContent(payload);
      onSaved(); onClose();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  const tabStyle = (t) => ({
    background: 'none', border: 'none', cursor: 'pointer', padding: '8px 14px',
    fontSize: 13, fontWeight: tab === t ? 600 : 400,
    color: tab === t ? 'var(--fg)' : 'var(--fg-muted)',
    borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
    marginBottom: -1,
  });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">{initial ? 'Edit content' : 'New content item'}</div>
          <Btn kind="ghost" size="sm" icon={IcoX} onClick={onClose} />
        </div>

        {/* Tabs */}
        <div className="row gap-0" style={{ borderBottom: '1px solid var(--border)', padding: '0 20px' }}>
          {[['content', 'Content'], ['display', 'Display tools'], ['schedule', 'Schedule']].map(([k, l]) => (
            <button key={k} style={tabStyle(k)} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        <form onSubmit={submit}>
          <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 360 }}>
            {error && <div className="error-banner">{error}</div>}

            {/* ── Content tab ── */}
            {tab === 'content' && (<>
              <div className="field">
                <label className="field__label">Title *</label>
                <input required className="input" value={form.title}
                  onChange={e => set('title', e.target.value)} placeholder="e.g. Dar es Salaam Weather Update" />
              </div>

              <div className="field">
                <label className="field__label">Body text</label>
                <textarea className="textarea" rows={3} value={form.body}
                  onChange={e => set('body', e.target.value)}
                  placeholder="Message body that appears below the title…" />
              </div>

              {/* Media */}
              <div className="field">
                <label className="field__label">Media</label>
                <div className="row gap-0" style={{ marginBottom: 8 }}>
                  {[['url', 'Image URL'], ['upload', 'Upload file']].map(([m, l]) => (
                    <button key={m} type="button" onClick={() => setMediaMode(m)} style={{
                      padding: '4px 12px', fontSize: 12, fontWeight: mediaMode === m ? 600 : 400,
                      background: mediaMode === m ? 'var(--accent)' : 'var(--bg-subtle)',
                      color: mediaMode === m ? 'white' : 'var(--fg-muted)',
                      border: '1px solid var(--border)', cursor: 'pointer',
                      borderRadius: m === 'url' ? '6px 0 0 6px' : '0 6px 6px 0',
                    }}>{l}</button>
                  ))}
                </div>
                {mediaMode === 'url' ? (
                  <input className="input" value={form.mediaUrl} placeholder="https://example.com/image.jpg"
                    onChange={e => set('mediaUrl', e.target.value)} />
                ) : (
                  <div>
                    <input type="file" ref={fileRef} accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
                    <Btn kind="secondary" size="sm" icon={IcoUpload} type="button" onClick={() => fileRef.current?.click()}>
                      Choose image
                    </Btn>
                    {form.mediaUrl?.startsWith('data:') && <span className="text-xs muted" style={{ marginLeft: 8 }}>File loaded</span>}
                  </div>
                )}
                {form.mediaUrl && (
                  <div style={{ marginTop: 8, borderRadius: 6, overflow: 'hidden', maxHeight: 120, background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
                    <img src={form.mediaUrl} alt="preview" style={{ width: '100%', height: 120, objectFit: 'cover' }}
                      onError={e => e.target.style.display = 'none'} />
                  </div>
                )}
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
              </div>
            </>)}

            {/* ── Display tab ── */}
            {tab === 'display' && (<>
              <div className="field">
                <label className="field__label">Screen zone</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                  {ZONES.map(z => (
                    <button key={z} type="button" onClick={() => set('zone', z)} style={{
                      padding: '7px 0', fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
                      letterSpacing: '0.04em', borderRadius: 6, cursor: 'pointer',
                      border: `1.5px solid ${form.zone === z ? 'var(--accent)' : 'var(--border)'}`,
                      background: form.zone === z ? 'color-mix(in oklch, var(--accent) 12%, transparent)' : 'var(--bg-subtle)',
                      color: form.zone === z ? 'var(--accent)' : 'var(--fg-muted)',
                    }}>{z}</button>
                  ))}
                </div>
              </div>

              {/* Auto-scroll */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Auto-scroll text</div>
                  <div className="text-xs muted">Scrolls text across the screen like a news ticker</div>
                </div>
                <button type="button" onClick={() => setDC('autoScroll', !dc.autoScroll)} style={{
                  width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', transition: 'background 0.2s',
                  background: dc.autoScroll ? 'var(--accent)' : 'var(--border-strong)', position: 'relative', flexShrink: 0,
                }}>
                  <span style={{ position: 'absolute', top: 2, left: dc.autoScroll ? 20 : 2, width: 18, height: 18, borderRadius: 9, background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
                </button>
              </div>

              {dc.autoScroll && (
                <div className="field">
                  <label className="field__label">Scroll speed</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['slow', 'normal', 'fast'].map(s => (
                      <button key={s} type="button" onClick={() => setDC('scrollSpeed', s)} style={{
                        flex: 1, padding: '6px 0', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
                        border: `1.5px solid ${dc.scrollSpeed === s ? 'var(--accent)' : 'var(--border)'}`,
                        background: dc.scrollSpeed === s ? 'color-mix(in oklch, var(--accent) 12%, transparent)' : 'transparent',
                        color: dc.scrollSpeed === s ? 'var(--accent)' : 'var(--fg-muted)',
                        textTransform: 'capitalize',
                      }}>{s}</button>
                    ))}
                  </div>
                </div>
              )}

              <div className="row gap-3">
                <div className="field" style={{ flex: 1 }}>
                  <label className="field__label">Animation</label>
                  <select className="select" value={dc.animation} onChange={e => setDC('animation', e.target.value)}>
                    {ANIMATIONS.map(a => <option key={a} value={a}>{a.replace('-', ' ')}</option>)}
                  </select>
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label className="field__label">Text size</label>
                  <select className="select" value={dc.textSize} onChange={e => setDC('textSize', e.target.value)}>
                    {TEXT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="row gap-3">
                <div className="field" style={{ flex: 1 }}>
                  <label className="field__label">Background colour</label>
                  <div className="row gap-2">
                    <input type="color" value={dc.bgColor || '#000000'} onChange={e => setDC('bgColor', e.target.value)}
                      style={{ width: 36, height: 34, border: '1px solid var(--border)', borderRadius: 6, padding: 3, cursor: 'pointer', background: 'var(--bg-subtle)' }} />
                    <input className="input mono" value={dc.bgColor} placeholder="#000000"
                      onChange={e => setDC('bgColor', e.target.value)} style={{ flex: 1 }} />
                    {dc.bgColor && <button type="button" onClick={() => setDC('bgColor', '')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)', fontSize: 11 }}>Clear</button>}
                  </div>
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label className="field__label">Text colour</label>
                  <div className="row gap-2">
                    <input type="color" value={dc.textColor || '#ffffff'} onChange={e => setDC('textColor', e.target.value)}
                      style={{ width: 36, height: 34, border: '1px solid var(--border)', borderRadius: 6, padding: 3, cursor: 'pointer', background: 'var(--bg-subtle)' }} />
                    <input className="input mono" value={dc.textColor} placeholder="#ffffff"
                      onChange={e => setDC('textColor', e.target.value)} style={{ flex: 1 }} />
                    {dc.textColor && <button type="button" onClick={() => setDC('textColor', '')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)', fontSize: 11 }}>Clear</button>}
                  </div>
                </div>
              </div>
            </>)}

            {/* ── Schedule tab ── */}
            {tab === 'schedule' && (<>
              <div className="field">
                <label className="field__label">Target</label>
                <select className="select" value={form.targetScope}
                  onChange={e => { set('targetScope', e.target.value); set('targetId', ''); }}>
                  <option value="global">All screens (global)</option>
                  <option value="group">Device group</option>
                  <option value="device">Specific screen</option>
                </select>
              </div>
              {form.targetScope === 'group' && (
                <div className="field">
                  <label className="field__label">Group</label>
                  <select className="select" value={form.targetId} onChange={e => set('targetId', e.target.value)}>
                    <option value="">— select —</option>
                    {groups.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
                  </select>
                </div>
              )}
              {form.targetScope === 'device' && (
                <div className="field">
                  <label className="field__label">Screen</label>
                  <select className="select" value={form.targetId} onChange={e => set('targetId', e.target.value)}>
                    <option value="">— select —</option>
                    {devices.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                  </select>
                </div>
              )}

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
              </div>

              <div className="field" style={{ maxWidth: 160 }}>
                <label className="field__label">Display duration (seconds)</label>
                <input className="input" type="number" min={5} max={300} value={form.durationS}
                  onChange={e => set('durationS', e.target.value)} />
              </div>
            </>)}
          </div>

          <div className="modal__foot">
            <Btn kind="secondary" type="button" onClick={onClose}>Cancel</Btn>
            <Btn kind="ghost" type="button" onClick={() => setTab(tab === 'content' ? 'display' : tab === 'display' ? 'schedule' : 'content')}>
              {tab === 'schedule' ? '← Back' : 'Next →'}
            </Btn>
            <Btn kind="primary" type="submit" icon={IcoCheck} disabled={saving}>
              {saving ? 'Saving…' : initial ? 'Save changes' : 'Create'}
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
        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ background: 'var(--bg-subtle)', borderRadius: 8, padding: 14 }}>
            <div className="text-xs muted" style={{ marginBottom: 4 }}>Device ID</div>
            <code style={{ fontSize: 12 }}>{result.id}</code>
          </div>
          <div style={{ background: 'var(--bg-subtle)', borderRadius: 8, padding: 14 }}>
            <div className="text-xs muted" style={{ marginBottom: 4 }}>API Key (shown once — copy now)</div>
            <code style={{ wordBreak: 'break-all', fontSize: 12 }}>{result.apiKey}</code>
          </div>
          <div className="text-xs muted">Configure these on the display device. Authenticates with <code>x-api-key</code> header via MQTT.</div>
        </div>
        <div className="modal__foot"><Btn kind="primary" onClick={onClose}>Done</Btn></div>
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
            <div className="text-xs muted">This display communicates via MQTT using an <code>x-api-key</code> header.</div>
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

// ─── OTA modal ──────────────────────────────────────────────────────────────────
function OtaModal({ screen, onClose, onSaved }) {
  const [form, setForm] = useState({ version: '', fileUrl: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault();
    if (!form.version || !form.fileUrl) { setError('Version and URL are required'); return; }
    setSaving(true); setError('');
    try { await api.otaEcalDevice(screen._id, form); onSaved(); onClose(); }
    catch (err) { setError(err.message); }
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
              <span className="muted">Current firmware: </span><code>{screen.firmwareVersion || 'unknown'}</code>
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
function KpiTile({ label, value, sub }) {
  return (
    <div className="card" style={{ padding: '10px 14px' }}>
      <div className="text-xs muted">{label}</div>
      <div className="text-2xl font-semibold tabnum tracking-tight" style={{ marginTop: 4 }}>{value ?? '—'}</div>
      {sub && <div className="text-xs subtle" style={{ marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ─── Overview tab ────────────────────────────────────────────────────────────────
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
  return (
    <>
      <div className="grid grid-cols-4" style={{ marginBottom: 16 }}>
        <KpiTile label="Live content"    value={liveContent.length}                          sub="items broadcasting now" />
        <KpiTile label="Screens online"  value={`${onlineScreens.length}/${screens.length}`} sub="connected displays" />
        <KpiTile label="Critical alerts" value={stats?.criticalContent ?? '—'}               sub="active critical items" />
        <KpiTile label="Total content"   value={stats?.activeContent ?? '—'}                 sub="scheduled items" />
      </div>
      <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <Card title="Broadcasting now" sub="Active content"
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
                    <div style={{ width: 48, height: 32, borderRadius: 6, flexShrink: 0, background: `linear-gradient(135deg, oklch(0.80 0.14 ${hue}), oklch(0.60 0.20 ${(hue + 50) % 360}))` }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 500, fontSize: 13 }}>{c.title}</span>
                        {priorityBadge(c.priority)}
                        <Badge kind="outline">{c.zone}</Badge>
                      </div>
                      <div className="text-xs muted" style={{ marginTop: 2 }}>
                        {c.type} · {c.durationS}s · {c.target?.scope === 'global' ? 'All screens' : c.target?.scope}
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

// ─── Content tab ─────────────────────────────────────────────────────────────────
function ContentTab({ content, onNew, onEdit, onDelete, onPreview, onPost, groups, devices }) {
  const [filter, setFilter] = useState('all');
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
            const hue    = TYPE_HUE[c.type] ?? 200;
            const status = contentStatus(c);
            const isLive = status.label === 'Live';
            return (
              <div key={c._id || i} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Thumbnail */}
                <div style={{ aspectRatio: '16/9', position: 'relative', overflow: 'hidden',
                  background: c.displayConfig?.bgColor || `linear-gradient(135deg, oklch(0.82 0.14 ${hue}), oklch(0.60 0.22 ${(hue + 50) % 360}))` }}>
                  {c.mediaUrl && (
                    <img src={c.mediaUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => e.target.style.display = 'none'} />
                  )}
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.5))' }} />
                  <div style={{ position: 'absolute', top: 7, left: 8, display: 'flex', gap: 4 }}>
                    {priorityBadge(c.priority)}
                    <Badge kind="neutral">{c.zone}</Badge>
                  </div>
                  <div style={{ position: 'absolute', bottom: 8, left: 10, right: 10, color: 'white', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3,
                      color: c.displayConfig?.textColor || 'white' }}>{c.title}</div>
                    {c.body && <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.body}</div>}
                  </div>
                  {/* Preview button overlay */}
                  <button onClick={() => onPreview(c)}
                    style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                      opacity: 0, transition: 'opacity 0.15s', background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.3)',
                      color: 'white', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 1}
                    onMouseLeave={e => e.currentTarget.style.opacity = 0}>
                    <IcoExternal size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />Preview
                  </button>
                </div>
                {/* Card footer */}
                <div style={{ padding: '8px 12px' }}>
                  <div className="row gap-2" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div className="row gap-2">
                      <Badge kind={status.kind} dot={status.dot ? status.kind : undefined}>{status.label}</Badge>
                      <Badge kind="outline">{c.type}</Badge>
                    </div>
                    <span className="text-xs muted">{c.durationS}s</span>
                  </div>
                  <div className="text-xs muted" style={{ marginBottom: 6 }}>
                    {c.target?.scope === 'global' ? 'All screens' : c.target?.scope}
                    {c.schedule?.endAt ? ` · ends ${format(new Date(c.schedule.endAt), 'MMM d')}` : ' · no expiry'}
                  </div>
                  <div className="row gap-1">
                    <Btn kind="ghost" size="sm" onClick={() => onPreview(c)} icon={IcoExternal}>Preview</Btn>
                    <Btn kind={isLive ? 'ghost' : 'secondary'} size="sm" onClick={() => onPost(c)}
                      style={isLive ? { color: 'var(--ok-soft-fg, #14532d)' } : undefined}>
                      {isLive ? 'Live ✓' : status.label === 'Ended' || status.label === 'Inactive' ? 'Repost' : 'Post now'}
                    </Btn>
                    <div style={{ flex: 1 }} />
                    <Btn kind="ghost" size="sm" onClick={() => onEdit(c)}>Edit</Btn>
                    <Btn kind="ghost" size="sm" onClick={() => onDelete(c._id)}>Del</Btn>
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

// ─── Schedule tab ────────────────────────────────────────────────────────────────
function ScheduleTab({ content, onPreview, onPost }) {
  const sorted = [...content].sort((a, b) => {
    const pa = { critical: 0, high: 1, normal: 2, low: 3 }[a.priority] ?? 9;
    const pb = { critical: 0, high: 1, normal: 2, low: 3 }[b.priority] ?? 9;
    return pa - pb;
  });
  return (
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
            const isLive = status.label === 'Live';
            return (
              <tr key={c._id}>
                <td>{priorityBadge(c.priority)}</td>
                <td style={{ fontWeight: 500, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</td>
                <td><Badge kind="outline">{c.type}</Badge></td>
                <td><Badge kind="neutral">{c.zone}</Badge></td>
                <td className="text-xs muted">{c.target?.scope === 'global' ? 'Global' : c.target?.scope}</td>
                <td className="muted text-xs mono">{start ? format(start, 'MMM d') : '—'}{' → '}{end ? format(end, 'MMM d') : '∞'}</td>
                <td className="muted text-xs">{c.durationS}s</td>
                <td><Badge kind={status.kind} dot={status.dot ? status.kind : undefined}>{status.label}</Badge></td>
                <td>
                  <div className="row gap-1">
                    <Btn kind="ghost" size="sm" icon={IcoExternal} onClick={() => onPreview(c)} title="Preview" />
                    <Btn kind="ghost" size="sm" onClick={() => onPost(c)}
                      style={isLive ? { color: 'var(--ok-soft-fg, #14532d)', fontSize: 11 } : { fontSize: 11 }}>
                      {isLive ? 'Live' : 'Post'}
                    </Btn>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

// ─── Screens tab ─────────────────────────────────────────────────────────────────
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
                    {s.otaPending && <Badge kind="warning" dot="warning">OTA pending</Badge>}
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

// ─── Main page ───────────────────────────────────────────────────────────────────
export default function ECalendarPage() {
  const qc       = useQueryClient();
  const location = useLocation();
  const tab      = new URLSearchParams(location.search).get('tab') || 'overview';

  const [showContentModal, setShowContentModal] = useState(false);
  const [showScreenModal,  setShowScreenModal]  = useState(false);
  const [editingContent,   setEditingContent]   = useState(null);
  const [previewContent,   setPreviewContent]   = useState(null);
  const [otaScreen,        setOtaScreen]        = useState(null);

  const { data: stats }      = useQuery({ queryKey: ['ecal-stats'],   queryFn: api.getEcalStats, refetchInterval: 30_000 });
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

  async function handlePost(c) {
    try {
      await api.updateEcalContent(c._id, {
        isActive: true,
        schedule: { startAt: new Date().toISOString(), endAt: c.schedule?.endAt || null },
      });
      invalidateAll();
    } catch (err) { alert(err.message); }
  }

  const PAGE_META = {
    overview: { title: 'e-Calendar',      sub: 'Display network overview — screens, content, and live status.' },
    content:  { title: 'Content library', sub: 'Reusable content items scheduled to display devices.' },
    schedule: { title: 'Schedule',        sub: 'Prioritised content distribution timeline.' },
    screens:  { title: 'Screens',         sub: 'Registered display devices and real-time heartbeat status.' },
  };
  const { title, sub } = PAGE_META[tab] || PAGE_META.overview;

  return (
    <div className="page">
      <style>{`
        @keyframes ecal-scroll {
          0%   { transform: translateX(100vw); }
          100% { transform: translateX(-100%); }
        }
      `}</style>

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
            <Btn kind="primary" size="sm" icon={IcoPlus} onClick={() => setShowScreenModal(true)}>Register screen</Btn>
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
          onDelete={id => { if (confirm('Delete this content item?')) delContent.mutate(id); }}
          onPreview={c => setPreviewContent(c)}
          onPost={handlePost} />
      )}
      {tab === 'schedule' && (
        <ScheduleTab content={content}
          onPreview={c => setPreviewContent(c)}
          onPost={handlePost} />
      )}
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
      {previewContent && (
        <ContentPreviewModal
          content={previewContent}
          onClose={() => setPreviewContent(null)}
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
