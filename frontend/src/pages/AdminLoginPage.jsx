import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuthStore } from '../store/auth.js';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const setAuth  = useAuthStore(s => s.setAuth);
  const [form, setForm]     = useState({ email: '', password: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.login(form);
      if (data.user?.role !== 'super_admin') {
        setError('Access denied.');
        return;
      }
      setAuth(data.user, data.token, data.refreshToken);
      navigate('/super-admin');
    } catch (err) {
      setError('Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0f',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-sans)',
    }}>
      <div style={{ width: '100%', maxWidth: 380, padding: '0 20px' }}>

        {/* Mark */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(139,92,246,0.12)',
            border: '1px solid rgba(139,92,246,0.25)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.9)', letterSpacing: '-0.01em' }}>
            Taarifa Platform Admin
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
            Restricted access
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Email
            </label>
            <input
              type="email" required autoComplete="username"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              style={{
                width: '100%', boxSizing: 'border-box',
                height: 42, padding: '0 14px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, outline: 'none',
                fontSize: 14, color: '#fff',
                fontFamily: 'var(--font-sans)',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(139,92,246,0.6)'}
              onBlur={e => e.target.style.borderColor  = 'rgba(255,255,255,0.1)'}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Password
            </label>
            <input
              type="password" required autoComplete="current-password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              style={{
                width: '100%', boxSizing: 'border-box',
                height: 42, padding: '0 14px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, outline: 'none',
                fontSize: 14, color: '#fff',
                fontFamily: 'var(--font-sans)',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(139,92,246,0.6)'}
              onBlur={e => e.target.style.borderColor  = 'rgba(255,255,255,0.1)'}
            />
          </div>

          {error && (
            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', fontSize: 13, color: '#fca5a5', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', height: 42, borderRadius: 8, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
            background: loading ? 'rgba(139,92,246,0.4)' : 'rgba(139,92,246,0.8)',
            color: '#fff', fontSize: 14, fontWeight: 700,
            fontFamily: 'var(--font-sans)',
            transition: 'background 0.15s',
          }}>
            {loading ? 'Verifying…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
