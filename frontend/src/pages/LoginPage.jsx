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
        <div className="auth-logo">
          <div className="auth-logo__mark">T</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Taarifa.live</div>
            <div className="text-xs muted">Environmental Monitoring</div>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>Sign in</div>
          <div className="text-xs muted" style={{ marginTop: 3 }}>Enter your credentials to continue</div>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field__label">Email</label>
            <input type="email" required className="input"
              value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="you@example.com" autoComplete="email" />
          </div>
          <div className="field" style={{ marginBottom: 20 }}>
            <label className="field__label">Password</label>
            <input type="password" required className="input"
              value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="••••••••" autoComplete="current-password" />
          </div>
          <button type="submit" disabled={loading}
            className="btn btn--primary btn--full btn--lg" style={{ height: 36 }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="text-xs muted" style={{ marginTop: 16, textAlign: 'center' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: 'var(--accent)', fontWeight: 500 }}>Create one</Link>
        </div>
      </div>
    </div>
  );
}
