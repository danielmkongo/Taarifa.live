import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuthStore } from '../store/auth.js';

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
      setAuth(data.user, data.token);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-bg">
      <div className="auth-card fade-in">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo__mark">
            <svg width="22" height="17" viewBox="0 0 22 16" fill="none">
              <path d="M1 8 L5 8 L7 2 L10 14 L12.5 8 L15 8 L16.5 5 L18 11 L19.5 8 L21 8"
                stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="auth-logo__text">
            <div className="auth-logo__name">Taarifa</div>
            <div className="auth-logo__sub">Environmental Monitoring</div>
          </div>
        </div>

        {/* Heading */}
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
            <input type="email" required className="input" style={{ height: 40, fontSize: 14 }}
              value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="you@example.com" autoComplete="email" />
          </div>
          <div className="field" style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <label className="field__label" style={{ fontSize: 13, fontWeight: 500, marginBottom: 0 }}>Password</label>
              <Link to="/forgot" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500 }}>Forgot password?</Link>
            </div>
            <input type="password" required className="input" style={{ height: 40, fontSize: 14 }}
              value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="••••••••" autoComplete="current-password" />
          </div>
          <button type="submit" disabled={loading}
            className="btn btn--primary btn--full"
            style={{ height: 42, fontSize: 14, fontWeight: 600, borderRadius: 'var(--radius)' }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'var(--fg-muted)' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: 'var(--accent)', fontWeight: 600 }}>Create one</Link>
        </div>
      </div>
    </div>
  );
}
