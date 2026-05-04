import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.js';
import { IcoZap, IcoPower, IcoMonitor } from '../components/ui/Icons.jsx';

const ALL_MODULES = [
  {
    key: 'weather',
    label: 'Weather Monitoring',
    desc: 'Real-time environmental sensor data, alert rules, and multi-site fleet management.',
    Icon: IcoZap,
    route: '/',
    color: 'var(--accent)',
    soft: 'var(--accent-soft)',
  },
  {
    key: 'energy',
    label: 'Energy Monitoring',
    desc: 'Power consumption, voltage, current, load factor, and energy analytics.',
    Icon: IcoPower,
    route: '/energy',
    color: 'var(--energy)',
    soft: 'var(--energy-soft)',
  },
  {
    key: 'ecalendar',
    label: 'e-Calendar',
    desc: 'Digital signage scheduling, content distribution, and screen management.',
    Icon: IcoMonitor,
    route: '/ecalendar',
    color: 'var(--ok)',
    soft: 'var(--ok-soft)',
  },
];

export default function ModuleSelectPage() {
  const user = useAuthStore(s => s.user);
  const navigate = useNavigate();

  const userModules = user?.modules || ['weather', 'energy', 'ecalendar'];
  const available = ALL_MODULES.filter(m => userModules.includes(m.key));

  useEffect(() => {
    if (available.length === 1) {
      navigate(available[0].route, { replace: true });
    }
  }, [available.length]);

  if (available.length <= 1) return null;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '40px 24px',
    }}>
      <div style={{ maxWidth: 760, width: '100%' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, var(--accent), oklch(0.48 0.28 295))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="14" viewBox="0 0 22 16" fill="none">
              <path d="M1 8 L5 8 L7 2 L10 14 L12.5 8 L15 8 L16.5 5 L18 11 L19.5 8 L21 8"
                stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--fg)' }}>Taarifa</div>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>Live Data. Smarter Decisions.</div>
          </div>
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--fg)', marginBottom: 6 }}>
          Choose a workspace
        </h1>
        <p style={{ fontSize: 14, color: 'var(--fg-muted)', marginBottom: 32, lineHeight: 1.6 }}>
          Select a module to continue to your dashboard.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}>
          {available.map(({ key, label, desc, Icon, route, color, soft }) => (
            <button
              key={key}
              onClick={() => navigate(route)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 16,
                padding: '24px 20px',
                background: 'var(--bg-elev)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'box-shadow 0.15s, border-color 0.15s, transform 0.12s',
                boxShadow: 'var(--shadow-sm)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = color;
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: soft,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color,
                flexShrink: 0,
              }}>
                <Icon size={22} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg)', marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.55 }}>{desc}</div>
              </div>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 48, fontSize: 12, color: 'var(--fg-subtle)', textAlign: 'center' }}>
          Signed in as {user?.email} &middot; {user?.fullName}
        </div>
      </div>
    </div>
  );
}
