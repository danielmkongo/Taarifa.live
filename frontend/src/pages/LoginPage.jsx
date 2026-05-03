import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuthStore } from '../store/auth.js';

const FEATURES = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-7"/>
      </svg>
    ),
    title: 'Real-time sensor data',
    desc: 'Temperature, humidity, pressure, rainfall and more — live from every device.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>
      </svg>
    ),
    title: 'Instant alerts',
    desc: 'Configurable thresholds notify your team the moment something goes wrong.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 3L3 5v16l6-2 6 2 6-2V3l-6 2-6-2z"/><path d="M9 3v16M15 5v16"/>
      </svg>
    ),
    title: 'Multi-site fleet management',
    desc: 'Group, filter, and manage hundreds of devices across multiple locations.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
      </svg>
    ),
    title: 'OTA updates & data export',
    desc: 'Push firmware over the air and export historical data to CSV or Excel.',
  },
];

const STATS = [
  { value: '6+',    label: 'Sensor types' },
  { value: '30d',   label: 'Historical data' },
  { value: 'MQTT',  label: '& HTTP support' },
  { value: '100%',  label: 'Web-based' },
];

function MiniChart() {
  const pts = [38, 52, 44, 61, 55, 70, 63, 78, 68, 85, 74, 88];
  const w = 280, h = 80, pad = 4;
  const xStep = (w - pad * 2) / (pts.length - 1);
  const min = Math.min(...pts) - 4, max = Math.max(...pts) + 4;
  const y = v => pad + (1 - (v - min) / (max - min)) * (h - pad * 2);
  const pathD = pts.map((v, i) => `${i === 0 ? 'M' : 'L'} ${pad + i * xStep} ${y(v)}`).join(' ');
  const areaD = `${pathD} L ${pad + (pts.length - 1) * xStep} ${h} L ${pad} ${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(99,102,241,0.35)" />
          <stop offset="100%" stopColor="rgba(99,102,241,0)" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#cg)" />
      <path d={pathD} fill="none" stroke="rgba(129,140,248,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((v, i) => i % 3 === 0 && (
        <circle key={i} cx={pad + i * xStep} cy={y(v)} r="3" fill="#6366f1" />
      ))}
    </svg>
  );
}

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
      navigate('/');
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
          <h1>Live Data.<br />Smarter Decisions.</h1>
          <p>
            Real-time IoT monitoring for operations teams that can't afford to be offline.
            Know what's happening across every site, every sensor, every second.
          </p>
        </div>

        {/* Mini chart visual */}
        <div className="login-chart-preview">
          <div className="login-chart-preview__bar">
            <div className="login-chart-preview__dot online" />
            <span>Dar es Salaam — Station A</span>
            <span className="login-chart-preview__live">LIVE</span>
          </div>
          <div style={{ padding: '12px 16px 8px' }}>
            <MiniChart />
          </div>
          <div style={{ display: 'flex', gap: 16, padding: '0 16px 14px', fontSize: 11 }}>
            {[
              { l: 'Temp', v: '28.4°C', c: '#f97316' },
              { l: 'Humidity', v: '72%', c: '#06b6d4' },
              { l: 'Pressure', v: '1013 hPa', c: '#8b5cf6' },
            ].map(s => (
              <div key={s.l}>
                <div style={{ color: 'rgba(255,255,255,0.45)', marginBottom: 2 }}>{s.l}</div>
                <div style={{ fontWeight: 700, color: s.c, fontVariantNumeric: 'tabular-nums' }}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>

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
              <div className="auth-logo__sub">Live Data. Smarter Decisions.</div>
            </div>
          </div>

          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 }}>
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

          <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--fg-subtle)', textAlign: 'center', lineHeight: 1.6 }}>
            Taarifa is a real-time IoT monitoring platform built for environmental and industrial operations.
          </div>
        </div>
      </div>

    </div>
  );
}
