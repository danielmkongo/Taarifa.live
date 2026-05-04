import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth.js';
import { api } from '../services/api.js';
import { IcoZap, IcoPower, IcoMonitor, IcoArrowRight } from '../components/ui/Icons.jsx';

// ── Workspace definitions ──────────────────────────────────────────────────────

const WORKSPACES = [
  {
    key: 'weather',
    label: 'Weather',
    sub: 'Monitoring',
    desc: 'Real-time environmental sensors, alert rules, and multi-site fleet management.',
    Icon: IcoZap,
    route: '/',
    gradient: 'linear-gradient(140deg, oklch(0.52 0.26 272) 0%, oklch(0.42 0.28 295) 100%)',
    glow: 'oklch(0.58 0.26 272 / 0.35)',
    iconBg: 'rgba(255,255,255,0.15)',
  },
  {
    key: 'energy',
    label: 'Energy',
    sub: 'Monitoring',
    desc: 'Power consumption, voltage, current, load analytics, and device health.',
    Icon: IcoPower,
    route: '/energy',
    gradient: 'linear-gradient(140deg, oklch(0.62 0.20 52) 0%, oklch(0.50 0.22 38) 100%)',
    glow: 'oklch(0.68 0.18 55 / 0.35)',
    iconBg: 'rgba(255,255,255,0.15)',
  },
  {
    key: 'ecalendar',
    label: 'e-Calendar',
    sub: 'Digital Signage',
    desc: 'Content scheduling, campaign management, and screen distribution.',
    Icon: IcoMonitor,
    route: '/ecalendar',
    gradient: 'linear-gradient(140deg, oklch(0.52 0.16 155) 0%, oklch(0.42 0.18 175) 100%)',
    glow: 'oklch(0.55 0.15 155 / 0.35)',
    iconBg: 'rgba(255,255,255,0.15)',
  },
];

// ── Live stat fetchers per workspace ──────────────────────────────────────────

function WeatherStats() {
  const { data: devicesData } = useQuery({
    queryKey: ['map-data'],
    queryFn: api.getMapData,
    staleTime: 30_000,
  });
  const { data: alertData } = useQuery({
    queryKey: ['alert-count'],
    queryFn: () => api.listAlertEvents({ state: 'open', limit: 1 }),
    staleTime: 30_000,
  });
  const devices = devicesData || [];
  const total  = devices.length;
  const online = devices.filter(d => d.status === 'online').length;
  const alerts = alertData?.total ?? 0;
  return (
    <div style={{ display: 'flex', gap: 16, marginTop: 'auto' }}>
      {[
        { v: total,  l: 'Devices' },
        { v: online, l: 'Online'  },
        { v: alerts, l: 'Alerts', danger: alerts > 0 },
      ].map((s, i) => (
        <div key={i}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {s.v}
          </div>
          <div style={{ fontSize: 11, color: s.danger && s.v > 0 ? '#fca5a5' : 'rgba(255,255,255,0.55)', marginTop: 2 }}>{s.l}</div>
        </div>
      ))}
    </div>
  );
}

function EnergyStats() {
  const { data } = useQuery({
    queryKey: ['energy-fleet'],
    queryFn: api.getEnergyFleet,
    staleTime: 30_000,
  });
  const totalPower = data?.summary?.totalPower ?? 0;
  const total  = data?.summary?.total  ?? 0;
  const online = data?.summary?.online ?? 0;
  const kw = totalPower >= 1000 ? `${(totalPower / 1000).toFixed(1)}` : `${totalPower.toFixed(0)}`;
  const kwUnit = totalPower >= 1000 ? 'kW' : 'W';
  return (
    <div style={{ display: 'flex', gap: 16, marginTop: 'auto' }}>
      {[
        { v: kw,    l: kwUnit   },
        { v: total, l: 'Devices' },
        { v: online, l: 'Online'  },
      ].map((s, i) => (
        <div key={i}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {s.v}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{s.l}</div>
        </div>
      ))}
    </div>
  );
}

function EcalStats() {
  const { data } = useQuery({
    queryKey: ['ecal-stats'],
    queryFn: api.getEcalStats,
    staleTime: 30_000,
  });
  const screens = data?.totalScreens ?? 0;
  const online  = data?.onlineScreens ?? 0;
  const content = data?.activeContent ?? 0;
  return (
    <div style={{ display: 'flex', gap: 16, marginTop: 'auto' }}>
      {[
        { v: screens, l: 'Screens' },
        { v: online,  l: 'Online'  },
        { v: content, l: 'Live'    },
      ].map((s, i) => (
        <div key={i}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {s.v}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{s.l}</div>
        </div>
      ))}
    </div>
  );
}

const STAT_COMPONENTS = { weather: WeatherStats, energy: EnergyStats, ecalendar: EcalStats };

// ── Workspace tile ─────────────────────────────────────────────────────────────

function WorkspaceTile({ ws, onClick }) {
  const StatComp = STAT_COMPONENTS[ws.key];

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        padding: '28px 28px 24px',
        background: ws.gradient,
        border: 'none', borderRadius: 20, cursor: 'pointer', textAlign: 'left',
        boxShadow: `0 8px 32px -8px ${ws.glow}, 0 2px 8px rgba(0,0,0,0.15)`,
        transition: 'transform 0.18s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.18s',
        minHeight: 230,
        position: 'relative', overflow: 'hidden',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-4px) scale(1.01)';
        e.currentTarget.style.boxShadow = `0 20px 48px -10px ${ws.glow}, 0 4px 16px rgba(0,0,0,0.2)`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = `0 8px 32px -8px ${ws.glow}, 0 2px 8px rgba(0,0,0,0.15)`;
      }}
    >
      {/* Decorative circles */}
      <div style={{ position: 'absolute', right: -30, top: -30, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', right: 20, bottom: -50, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

      {/* Icon */}
      <div style={{
        width: 48, height: 48, borderRadius: 14, background: ws.iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20, backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.2)',
      }}>
        <ws.Icon size={22} style={{ color: '#fff' }} />
      </div>

      {/* Label */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1 }}>{ws.label}</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 3 }}>{ws.sub}</div>
      </div>

      {/* Description */}
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.55, marginBottom: 20, flex: 1 }}>
        {ws.desc}
      </div>

      {/* Live stats */}
      <StatComp />

      {/* Arrow */}
      <div style={{
        position: 'absolute', bottom: 24, right: 24,
        width: 32, height: 32, borderRadius: '50%',
        background: 'rgba(255,255,255,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <IcoArrowRight size={14} style={{ color: '#fff' }} />
      </div>
    </button>
  );
}

// ── Recent alerts strip ───────────────────────────────────────────────────────

function RecentAlerts() {
  const { data } = useQuery({
    queryKey: ['alert-events', 'open'],
    queryFn: () => api.listAlertEvents({ state: 'open', limit: 4 }),
    staleTime: 30_000,
  });
  const events = data?.events || [];
  if (!events.length) return null;

  return (
    <div style={{ maxWidth: 860, width: '100%', margin: '0 auto' }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--fg-subtle)', marginBottom: 10 }}>
        Open alerts
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {events.map(ev => (
          <div key={ev._id} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 14px', background: 'var(--bg-elev)',
            border: '1px solid var(--border)', borderRadius: 10,
            fontSize: 13,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: ev.severity === 'critical' ? 'var(--danger)' : 'var(--warn)', flexShrink: 0 }} />
            <div style={{ flex: 1, fontWeight: 500, color: 'var(--fg)' }}>{ev.ruleName || 'Alert'}</div>
            <div style={{ color: 'var(--fg-muted)', fontSize: 12 }}>{ev.deviceName || '—'}</div>
            <div style={{ padding: '2px 7px', borderRadius: 5, fontSize: 11, fontWeight: 600,
              background: ev.severity === 'critical' ? 'var(--danger-soft)' : 'var(--warn-soft)',
              color: ev.severity === 'critical' ? 'var(--danger-soft-fg)' : 'var(--warn-soft-fg)',
            }}>{ev.severity}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ModuleSelectPage() {
  const user = useAuthStore(s => s.user);
  const navigate = useNavigate();
  const userModules = user?.modules || ['weather', 'energy', 'ecalendar'];
  const available = WORKSPACES.filter(w => userModules.includes(w.key));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* Minimal top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 32px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-elev)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'linear-gradient(135deg, var(--accent), oklch(0.48 0.28 295))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px oklch(0.58 0.26 272 / 0.35)',
          }}>
            <svg width="15" height="11" viewBox="0 0 22 16" fill="none">
              <path d="M1 8 L5 8 L7 2 L10 14 L12.5 8 L15 8 L16.5 5 L18 11 L19.5 8 L21 8"
                stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--fg)' }}>Taarifa</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--fg-muted)' }}>{user?.fullName}</span>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'var(--accent-soft)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 11.5, fontWeight: 700, color: 'var(--accent)',
          }}>
            {user?.fullName?.split(' ').map(s => s[0]).join('').slice(0, 2) || 'U'}
          </div>
        </div>
      </div>

      {/* Centered content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px 60px' }}>

        <div style={{ textAlign: 'center', marginBottom: 48, maxWidth: 520 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-subtle)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Welcome back{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.035em', color: 'var(--fg)', margin: 0, lineHeight: 1.15 }}>
            Choose your workspace
          </h1>
          <p style={{ fontSize: 14.5, color: 'var(--fg-muted)', marginTop: 10, lineHeight: 1.65, margin: '10px 0 0' }}>
            Select a module to continue. You can switch at any time.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 300px))',
          gap: 16,
          maxWidth: 980,
          width: '100%',
          justifyContent: 'center',
          marginBottom: 48,
        }}>
          {available.map(ws => (
            <WorkspaceTile key={ws.key} ws={ws} onClick={() => navigate(ws.route)} />
          ))}
        </div>

        <RecentAlerts />
      </div>
    </div>
  );
}
