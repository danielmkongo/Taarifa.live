import { Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.js';
import { api } from '../../services/api.js';

export default function AdminLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  async function handleLogout() {
    await api.logout({}).catch(() => {});
    logout();
    navigate('/admin');
  }

  const initials = user?.fullName?.split(' ').map(s => s[0]).join('').slice(0, 2) || 'A';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-elev)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: 'color-mix(in oklch, var(--accent) 12%, transparent)',
            border: '1px solid color-mix(in oklch, var(--accent) 22%, var(--border))',
            display: 'grid', placeItems: 'center',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--fg)', letterSpacing: '-0.02em' }}>Taarifa</span>
            <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--fg-muted)', marginLeft: 5 }}>Platform Admin</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>{user?.fullName || 'Admin'}</div>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{user?.email}</div>
          </div>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'color-mix(in oklch, var(--accent) 15%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: 'var(--accent)',
          }}>
            {initials}
          </div>
          <button onClick={handleLogout} style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 7,
            padding: '5px 12px', fontSize: 12, fontWeight: 600,
            color: 'var(--fg-muted)', cursor: 'pointer',
            transition: 'all 0.12s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--fg-muted)'; e.currentTarget.style.color = 'var(--fg)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--fg-muted)'; }}>
            Sign out
          </button>
        </div>
      </header>

      <main style={{ flex: 1, overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
