import { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.js';
import { api } from '../../services/api.js';
import { useQuery } from '@tanstack/react-query';
import {
  IcoHome, IcoCpu, IcoData, IcoMap, IcoBell, IcoFileChart,
  IcoMonitor, IcoCalendar, IcoUsers, IcoSettings,
  IcoSearch, IcoSun, IcoMoon, IcoBell2, IcoExt, IcoZap,
  IcoLayers, IcoChevDown, IcoMenu, IcoX, IcoArrowRight, IcoPin,
  IcoPower, IcoActivity, IcoGauge, IcoShield,
} from '../ui/Icons.jsx';
import { Btn, Seg } from '../ui/index.jsx';

const PAGE_TITLES = {
  '/':             ['Weather',      'Overview'],
  '/devices':      ['Weather',      'Devices'],
  '/data':         ['Weather',      'Data Explorer'],
  '/map':          ['Weather',      'Map'],
  '/alerts':       ['Weather',      'Alerts'],
  '/exports':      ['Weather',      'Reports'],
  '/energy':       ['Energy',       'Overview'],
  '/ecalendar':    ['e-Calendar',   'Dashboard'],
  '/users':        ['Organisation', 'Members'],
  '/settings':     ['Organisation', 'Settings'],
  '/super-admin':  ['Platform',     'Super Admin'],
};

function isSignagePath(pathname) {
  return pathname.startsWith('/ecalendar');
}

function isEnergyPath(pathname) {
  return pathname.startsWith('/energy');
}

function ecalTab(search) {
  return new URLSearchParams(search).get('tab') || 'overview';
}

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme]           = useState(() => localStorage.getItem('taarifa-theme') || 'light');
  const isAdminPath = location.pathname === '/users' || location.pathname === '/settings' || location.pathname === '/super-admin';
  const derivedWorkspace = isSignagePath(location.pathname) ? 'signage' : isEnergyPath(location.pathname) ? 'energy' : 'monitoring';
  const [lastWorkspace, setLastWorkspace] = useState(
    () => localStorage.getItem('taarifa-last-workspace') || 'monitoring'
  );
  useEffect(() => {
    if (!isAdminPath) {
      setLastWorkspace(derivedWorkspace);
      localStorage.setItem('taarifa-last-workspace', derivedWorkspace);
    }
  }, [derivedWorkspace, isAdminPath]);
  const workspace = isAdminPath ? lastWorkspace : derivedWorkspace;
  const [sidebarOpen, setSidebar]   = useState(false);
  const [searchQ, setSearchQ]       = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('taarifa-theme', theme);
  }, [theme]);

  useEffect(() => {
    setSidebar(false);
  }, [location.pathname]);

  const { data: alertData } = useQuery({
    queryKey: ['alert-count'],
    queryFn: () => api.listAlertEvents({ state: 'open', limit: 1 }),
    refetchInterval: 60_000,
  });
  const { data: deviceData } = useQuery({
    queryKey: ['device-count'],
    queryFn: () => api.listDevices({ limit: 1 }),
    refetchInterval: 120_000,
  });
  const { data: allDevicesData } = useQuery({
    queryKey: ['devices'],
    queryFn: () => api.listDevices({ limit: 100 }),
    staleTime: 60_000,
  });
  const allDevices = allDevicesData?.devices || [];

  const searchResults = searchQ.length > 1
    ? allDevices.filter(d =>
        [d.name, d.serialNumber, d.locationName].some(v => v?.toLowerCase().includes(searchQ.toLowerCase()))
      ).slice(0, 7)
    : [];

  const alertCount  = alertData?.total ?? 0;
  const deviceCount = deviceData?.total ?? 0;

  const monitoringNav = [
    { to: '/',        label: 'Overview',      Icon: IcoHome },
    { to: '/devices', label: 'Devices',       Icon: IcoCpu,       count: deviceCount || null },
    { to: '/data',    label: 'Data Explorer', Icon: IcoData },
    { to: '/map',     label: 'Map',           Icon: IcoMap },
    { to: '/alerts',  label: 'Alerts',        Icon: IcoBell,      count: alertCount || null, alert: true },
    { to: '/exports', label: 'Reports',       Icon: IcoFileChart },
  ];

  const currentTab = ecalTab(location.search);
  const currentEnergyTab = new URLSearchParams(location.search).get('tab') || 'overview';

  const signageNav = [
    { to: '/ecalendar',                  label: 'Dashboard',  Icon: IcoHome,       tab: 'overview' },
    { to: '/ecalendar?tab=content',      label: 'Content',    Icon: IcoLayers,     tab: 'content' },
    { to: '/ecalendar?tab=schedule',     label: 'Schedule',   Icon: IcoCalendar,   tab: 'schedule' },
    { to: '/ecalendar?tab=screens',      label: 'Screens',    Icon: IcoMonitor,    tab: 'screens' },
  ];

  const energyNav = [
    { to: '/energy',              label: 'Overview', Icon: IcoHome,     tab: 'overview' },
    { to: '/energy?tab=devices',  label: 'Devices',  Icon: IcoCpu,      tab: 'devices'  },
    { to: '/energy?tab=systems',  label: 'Systems',  Icon: IcoLayers,   tab: 'systems'  },
    { to: '/energy?tab=data',     label: 'Data',     Icon: IcoActivity, tab: 'data'     },
  ];

  const adminNav = [
    { to: '/users',    label: 'Members',  Icon: IcoUsers },
    { to: '/settings', label: 'Settings', Icon: IcoSettings },
  ];

  const nav = workspace === 'monitoring' ? monitoringNav : workspace === 'energy' ? energyNav : signageNav;
  const workspaceLabel = { monitoring: 'Weather', energy: 'Energy', signage: 'e-Calendar' }[workspace];

  // Topbar breadcrumb
  let crumbs = PAGE_TITLES[location.pathname] || ['Weather', 'Overview'];
  if (location.pathname === '/modules') {
    crumbs = ['', 'Workspaces'];
  } else if (isSignagePath(location.pathname)) {
    const tabLabels = { overview: 'Dashboard', content: 'Content', schedule: 'Schedule', screens: 'Screens' };
    crumbs = ['e-Calendar', tabLabels[currentTab] || 'Dashboard'];
  } else if (isEnergyPath(location.pathname)) {
    const tabLabels = { overview: 'Overview', devices: 'Devices', systems: 'Systems', data: 'Data' };
    crumbs = ['Energy', tabLabels[currentEnergyTab] || 'Overview'];
  }

  const initials = user?.fullName?.split(' ').map(s => s[0]).join('').slice(0, 2) || 'U';
  const role = user?.role || 'viewer';
  const orgName = 'TANAPA'; // shown below workspace label

  async function handleLogout() {
    await api.logout({}).catch(() => {});
    logout();
    navigate('/login');
  }

  function isNavActive(n) {
    if (isSignagePath(location.pathname)) return n.tab === currentTab;
    if (isEnergyPath(location.pathname))  return n.tab === currentEnergyTab;
    return location.pathname === n.to;
  }

  return (
    <div className="app">
      {/* Mobile backdrop */}
      <div className={`mob-backdrop${sidebarOpen ? '' : ' mob-backdrop--hidden'}`}
        onClick={() => setSidebar(false)} />

      {/* Sidebar */}
      <aside className={`app__sidebar${sidebarOpen ? ' app__sidebar--open' : ''}`}>
        <button className="brand" onClick={() => navigate('/modules')} style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
          <div className="brand__mark">
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.05em', lineHeight: 1, userSelect: 'none' }}>T</span>
          </div>
          <div className="brand__text">
            <div className="brand__name">Taarifa<span className="brand__live"> Live</span></div>
          </div>
        </button>

        <nav className="nav">
          <div className="nav__section">
            <div className="nav__heading nav__heading--ws">
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, opacity: 0.7 }} />
              {workspaceLabel}
            </div>
            {nav.map(n => (
              <a key={n.label}
                className={`nav__item ${isNavActive(n) ? 'active' : ''}`}
                style={{ position: 'relative' }}
                href={n.to}
                onClick={e => { e.preventDefault(); navigate(n.to); }}>
                <n.Icon className="nav__icon" size={15} />
                <span>{n.label}</span>
                {n.count != null && n.count > 0 && (
                  <span className={`nav__count ${n.alert ? 'nav__count--alert' : ''}`}>{n.count}</span>
                )}
              </a>
            ))}
          </div>

          {(role === 'admin' || role === 'org_admin' || role === 'super_admin' || role === 'manager') && (
            <div className="nav__section">
              <div className="nav__heading">Organisation</div>
              {adminNav.map(n => (
                <a key={n.to}
                  className={`nav__item ${location.pathname === n.to ? 'active' : ''}`}
                  style={{ position: 'relative' }}
                  href={n.to}
                  onClick={e => { e.preventDefault(); navigate(n.to); }}>
                  <n.Icon className="nav__icon" size={15} />
                  <span>{n.label}</span>
                </a>
              ))}
            </div>
          )}

          {role === 'super_admin' && (
            <div className="nav__section">
              <div className="nav__heading">Platform</div>
              <a className={`nav__item ${location.pathname === '/super-admin' ? 'active' : ''}`}
                href="/super-admin"
                onClick={e => { e.preventDefault(); navigate('/super-admin'); }}>
                <IcoShield className="nav__icon" size={15} />
                <span>Super Admin</span>
              </a>
            </div>
          )}
        </nav>

        {/* Workspace switcher — styled as a distinct chip */}
        <div style={{ padding: '8px 10px 10px' }}>
          <button className="nav__ws-btn" onClick={() => navigate('/modules')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            <span>Switch workspace</span>
            <svg className="nav__ws-chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        </div>

        <div className="user">
          <div className="avatar">{initials}</div>
          <div className="user__info">
            <div className="user__name">{user?.fullName || 'User'}</div>
            <div className="user__role">{role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} · {orgName}</div>
          </div>
          <button className="btn btn--ghost btn--icon btn--sm" onClick={handleLogout} title="Sign out">
            <IcoExt size={13} />
          </button>
        </div>
      </aside>

      {/* Topbar */}
      <header className="app__topbar">
        <div className="topbar">
          <button className="btn btn--ghost btn--icon btn--sm mob-menu-btn"
            onClick={() => setSidebar(o => !o)} title="Menu">
            {sidebarOpen ? <IcoX size={16} /> : <IcoMenu size={16} />}
          </button>
          <div className="topbar__crumbs">
            {crumbs.map((c, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {i > 0 && <span className="topbar__crumb-sep">/</span>}
                {i === crumbs.length - 1 ? <strong>{c}</strong> : <span>{c}</span>}
              </span>
            ))}
          </div>
          <div className="search" ref={searchRef} style={{ position: 'relative' }}
            onFocus={() => setSearchOpen(true)}
            onBlur={e => { if (!searchRef.current?.contains(e.relatedTarget)) setSearchOpen(false); }}>
            <IcoSearch size={13} />
            <input
              placeholder="Search devices, sites…"
              value={searchQ}
              onChange={e => { setSearchQ(e.target.value); setSearchOpen(true); }}
              onKeyDown={e => { if (e.key === 'Escape') { setSearchQ(''); setSearchOpen(false); e.target.blur(); } }}
            />
            {searchQ && (
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)', display: 'flex', padding: 0 }}
                onMouseDown={e => { e.preventDefault(); setSearchQ(''); setSearchOpen(false); }}>
                <IcoX size={12} />
              </button>
            )}
            {searchOpen && searchQ.length > 1 && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
                background: 'var(--bg-elev)', border: '1px solid var(--border)',
                borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                zIndex: 200, overflow: 'hidden',
              }}>
                {searchResults.length === 0 ? (
                  <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--fg-muted)' }}>No devices match "{searchQ}"</div>
                ) : searchResults.map(d => (
                  <button key={d._id}
                    onMouseDown={e => { e.preventDefault(); setSearchQ(''); setSearchOpen(false); navigate(`/devices/${d._id}`); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer',
                      textAlign: 'left', borderBottom: '1px solid var(--border)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: d.status === 'online' ? 'var(--ok)' : d.status === 'alert' ? 'var(--danger)' : 'var(--fg-subtle)' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{d.name}</div>
                      {d.locationName && <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{d.locationName}</div>}
                    </div>
                    <IcoArrowRight size={12} style={{ color: 'var(--fg-subtle)', flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="topbar__actions">
            <Btn kind="ghost" size="sm"
              icon={theme === 'dark' ? IcoSun : IcoMoon}
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              title="Toggle theme" />
            <Btn kind="ghost" size="sm" icon={IcoBell2} title="Notifications" />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="app__main">
        <Outlet />
      </main>
    </div>
  );
}
