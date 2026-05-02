import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuthStore } from '../store/auth.js';

const LogoMark = () => (
  <div className="auth-logo__mark">
    <svg width="22" height="17" viewBox="0 0 22 16" fill="none">
      <path d="M1 8 L5 8 L7 2 L10 14 L12.5 8 L15 8 L16.5 5 L18 11 L19.5 8 L21 8"
        stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>
);

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

  function Field({ name, label, type = 'text', placeholder = '' }) {
    return (
      <div className="field" style={{ marginBottom: 16 }}>
        <label className="field__label" style={{ fontSize: 13, fontWeight: 500 }}>{label}</label>
        <input type={type} required className="input" style={{ height: 40, fontSize: 14 }}
          value={form[name]} onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
          placeholder={placeholder} />
      </div>
    );
  }

  return (
    <div className="auth-bg">
      <div className="auth-card fade-in">
        <div className="auth-logo">
          <LogoMark />
          <div className="auth-logo__text">
            <div className="auth-logo__name">Taarifa</div>
            <div className="auth-logo__sub">Environmental Monitoring</div>
          </div>
        </div>

        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 }}>
            Create account
          </div>
          <div style={{ fontSize: 14, color: 'var(--fg-muted)', marginTop: 6 }}>
            Set up your organisation to get started
          </div>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          <Field name="fullName" label="Full name"          placeholder="Your name" />
          <Field name="orgName"  label="Organisation"       placeholder="e.g. Kenya Wildlife Service" />
          <Field name="email"    label="Email"    type="email"    placeholder="you@example.com" />
          <Field name="password" label="Password" type="password" placeholder="Min. 8 characters" />
          <button type="submit" disabled={loading}
            className="btn btn--primary btn--full"
            style={{ height: 42, fontSize: 14, fontWeight: 600, borderRadius: 'var(--radius)', marginTop: 4 }}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'var(--fg-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Sign in</Link>
        </div>
      </div>
    </div>
  );
}
