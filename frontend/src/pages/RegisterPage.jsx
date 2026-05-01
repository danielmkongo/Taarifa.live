import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuthStore } from '../store/auth.js';

export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({ email: '', password: '', fullName: '', orgName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.register(form);
      setAuth({ email: form.email, fullName: form.fullName, role: 'org_admin' }, data.token);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  const field = (key, label, type = 'text', placeholder = '') => (
    <div className="field" style={{ marginBottom: 12 }}>
      <label className="field__label">{label}</label>
      <input type={type} required className="input"
        value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder} />
    </div>
  );

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
          <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>Create account</div>
          <div className="text-xs muted" style={{ marginTop: 3 }}>Set up your organisation</div>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          {field('fullName', 'Full name', 'text', 'Your name')}
          {field('orgName', 'Organisation name', 'text', 'e.g. Kenya Wildlife Service')}
          {field('email', 'Email', 'email', 'you@example.com')}
          {field('password', 'Password', 'password', '••••••••')}
          <div style={{ marginTop: 8 }}>
            <button type="submit" disabled={loading}
              className="btn btn--primary btn--full" style={{ height: 36, fontSize: 14 }}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </div>
        </form>

        <div className="text-xs muted" style={{ marginTop: 16, textAlign: 'center' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 500 }}>Sign in</Link>
        </div>
      </div>
    </div>
  );
}
