import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuthStore } from '../store/auth.js';

const glassCard = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 12, overflow: 'hidden',
};
const metricBlock = (label, value, color) => (
  <div key={label}>
    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
    <div style={{ fontSize: 16, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
  </div>
);

function LivePreviewCards() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <div style={glassCard}>
        <div style={{ display:'flex', alignItems:'center', gap:7, padding:'10px 13px 8px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontSize:11.5, color:'rgba(255,255,255,0.5)' }}>
          <span style={{ width:6,height:6,borderRadius:'50%',background:'#22c55e',boxShadow:'0 0 6px #22c55e',flexShrink:0 }} />
          <span style={{ flex:1 }}>Weather · Dar es Salaam</span>
          <span style={{ fontSize:9,fontWeight:700,letterSpacing:'0.08em',color:'#22c55e',background:'rgba(34,197,94,0.12)',border:'1px solid rgba(34,197,94,0.25)',padding:'2px 6px',borderRadius:4 }}>LIVE</span>
        </div>
        <div style={{ display:'flex', gap:16, padding:'10px 13px 12px' }}>
          {[['Temp','28.4°C','#fb923c'],['Humidity','72%','#22d3ee'],['Pressure','1013 hPa','#a78bfa']].map(([l,v,c]) => metricBlock(l,v,c))}
        </div>
      </div>
      <div style={glassCard}>
        <div style={{ display:'flex', alignItems:'center', gap:7, padding:'10px 13px 8px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontSize:11.5, color:'rgba(255,255,255,0.5)' }}>
          <span style={{ width:6,height:6,borderRadius:'50%',background:'#f59e0b',boxShadow:'0 0 6px #f59e0b80',flexShrink:0 }} />
          <span>Energy · Main Panel</span>
        </div>
        <div style={{ display:'flex', gap:16, padding:'10px 13px 12px' }}>
          {[['Load','4.2 kW','#fbbf24'],['Voltage','231 V','#67e8f9'],['PF','0.94','#86efac']].map(([l,v,c]) => metricBlock(l,v,c))}
        </div>
      </div>
      <div style={{ ...glassCard, gridColumn:'1 / -1' }}>
        <div style={{ display:'flex', alignItems:'center', gap:7, padding:'10px 13px 8px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontSize:11.5, color:'rgba(255,255,255,0.5)' }}>
          <span style={{ width:6,height:6,borderRadius:'50%',background:'#818cf8',boxShadow:'0 0 6px #818cf880',flexShrink:0 }} />
          <span style={{ flex:1 }}>e-Calendar · Main Lobby Screen</span>
          <span style={{ fontSize:9,fontWeight:700,letterSpacing:'0.08em',color:'#818cf8',background:'rgba(129,140,248,0.12)',border:'1px solid rgba(129,140,248,0.25)',padding:'2px 6px',borderRadius:4 }}>BROADCASTING</span>
        </div>
        <div style={{ padding:'9px 13px 11px', fontSize:12.5, color:'rgba(255,255,255,0.5)' }}>
          Now playing: <span style={{ color:'rgba(255,255,255,0.9)', fontWeight:600 }}>"Staff Safety Briefing"</span>
          <span style={{ marginLeft:10, fontSize:11, color:'rgba(255,255,255,0.3)' }}>Zone: Main · 30s · All screens</span>
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>
      </svg>
    ),
    title: 'Instant alerts when things go wrong',
    desc: 'Get notified the moment readings cross a threshold — before a problem becomes a crisis.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-7"/>
      </svg>
    ),
    title: 'Live data from every location',
    desc: 'See real-time conditions across all your sites on one screen. No more calling around to check.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 3L3 5v16l6-2 6 2 6-2V3l-6 2-6-2z"/><path d="M9 3v16M15 5v16"/>
      </svg>
    ),
    title: 'All your sites, one dashboard',
    desc: 'Monitor every location, building, and sensor from a single view — no matter how many you have.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10"/>
      </svg>
    ),
    title: 'Know your energy costs',
    desc: 'Track power consumption across every circuit and device. Spot waste and act before bills arrive.',
  },
];

const STATS = [
  { value: '24/7',  label: 'Live monitoring' },
  { value: '<1s',   label: 'Alert delivery'  },
  { value: '3',     label: 'Modules'         },
  { value: '100%',  label: 'Web-based'       },
];


export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.login(form);
      setAuth(data.user, data.token, data.refreshToken);
      navigate('/modules');
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-layout">

      {/* ── Left: landing panel ─────────────────────────────── */}
      <div className="login-panel">

        {/* Brand */}
        <div className="login-brand">
          <div className="login-brand__mark">
            <svg width="20" height="15" viewBox="0 0 22 16" fill="none">
              <path d="M1 8 L5 8 L7 2 L10 14 L12.5 8 L15 8 L16.5 5 L18 11 L19.5 8 L21 8"
                stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="login-brand__name">Taarifa</span>
        </div>

        {/* Headline */}
        <div className="login-headline">
          <h1>See everything.<br />Act instantly.</h1>
          <p>
            One platform for environmental monitoring, energy management, and digital signage — giving your team the visibility to act before problems escalate.
          </p>
        </div>

        {/* Live preview cards */}
        <LivePreviewCards />

        {/* Features */}
        <div className="login-features">
          {FEATURES.map((f, i) => (
            <div key={i} className="login-feature">
              <div className="login-feature__icon">{f.icon}</div>
              <div>
                <div className="login-feature__title">{f.title}</div>
                <div className="login-feature__desc">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="login-stats">
          {STATS.map(s => (
            <div key={s.label} className="login-stat">
              <div className="login-stat__value">{s.value}</div>
              <div className="login-stat__label">{s.label}</div>
            </div>
          ))}
        </div>

      </div>

      {/* ── Right: login form ────────────────────────────────── */}
      <div className="login-form-side">
        <div className="login-form-card fade-in">

          <div className="auth-logo" style={{ marginBottom: 28 }}>
            <div className="auth-logo__mark">
              <svg width="22" height="17" viewBox="0 0 22 16" fill="none">
                <path d="M1 8 L5 8 L7 2 L10 14 L12.5 8 L15 8 L16.5 5 L18 11 L19.5 8 L21 8"
                  stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="auth-logo__text">
              <div className="auth-logo__name">Taarifa</div>
              <div className="auth-logo__sub">Monitor · Manage · Act</div>
            </div>
          </div>

          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 }}>
              Welcome back
            </div>
            <div style={{ fontSize: 14, color: 'var(--fg-muted)', marginTop: 6 }}>
              Sign in to your account to continue
            </div>
          </div>

          {error && <div className="error-banner">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="field" style={{ marginBottom: 16 }}>
              <label className="field__label" style={{ fontSize: 13, fontWeight: 500 }}>Email</label>
              <input type="email" required className="input" style={{ height: 42, fontSize: 14 }}
                value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com" autoComplete="email" autoFocus />
            </div>
            <div className="field" style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <label className="field__label" style={{ fontSize: 13, fontWeight: 500, marginBottom: 0 }}>Password</label>
                <Link to="/forgot" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500 }}>Forgot password?</Link>
              </div>
              <input type="password" required className="input" style={{ height: 42, fontSize: 14 }}
                value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="••••••••" autoComplete="current-password" />
            </div>
            <button type="submit" disabled={loading}
              className="btn btn--primary btn--full"
              style={{ height: 44, fontSize: 14, fontWeight: 600, borderRadius: 'var(--radius)' }}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div style={{ marginTop: 22, textAlign: 'center', fontSize: 13, color: 'var(--fg-muted)' }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: 'var(--accent)', fontWeight: 600 }}>Create one</Link>
          </div>

        </div>
      </div>

    </div>
  );
}
