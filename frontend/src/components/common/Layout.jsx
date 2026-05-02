import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.js';
import { api } from '../../services/api.js';
import { useQuery } from '@tanstack/react-query';
import {
  IcoHome, IcoCpu, IcoData, IcoMap, IcoBell, IcoFileChart,
  IcoMonitor, IcoCalendar, IcoUsers, IcoSettings,
  IcoSearch, IcoSun, IcoMoon, IcoBell2, IcoExt, IcoZap,
  IcoLayers, IcoChevDown, IcoMenu, IcoX,
} from '../ui/Icons.jsx';
import { Btn, Seg } from '../ui/index.jsx';

const PAGE_TITLES = {
  '/':             ['Monitoring',   'Overview'],
  '/devices':      ['Monitoring',   'Devices'],
  '/data':         ['Monitoring',   'Data Explorer'],
  '/map':          ['Monitoring',   'Map'],
  '/alerts':       ['Monitoring',   'Alerts'],
  '/exports':      ['Monitoring',   'Reports'],
  '/ecalendar':    ['e-Calendar',   'Dashboard'],
  '/users':        ['Organisation', 'Members'],
  '/settings':     ['Organisation', 'Settings'],
};

function isSignagePath(pathname) {
  return pathname.startsWith('/ecalendar');
}

function ecalTab(search) {
  return new URLSearchParams(search).get('tab') || 'overview';
}

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme]           = useState(() => localStorage.getItem('taarifa-theme') || 'light');
  const [workspace, setWorkspace]   = useState(() => isSignagePath(location.pathname) ? 'signage' : 'monitoring');
  const [sidebarOpen, setSidebar]   = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('taarifa-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (isSignagePath(location.pathname)) setWorkspace('signage');
    setSidebar(false); // close drawer on navigation
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
  const signageNav = [
    { to: '/ecalendar',                  label: 'Dashboard',  Icon: IcoHome,       tab: 'overview' },
    { to: '/ecalendar?tab=content',      label: 'Content',    Icon: IcoLayers,     tab: 'content' },
    { to: '/ecalendar?tab=schedule',     label: 'Schedule',   Icon: IcoCalendar,   tab: 'schedule' },
    { to: '/ecalendar?tab=screens',      label: 'Screens',    Icon: IcoMonitor,    tab: 'screens' },
  ];

  const adminNav = [
    { to: '/users',    label: 'Members',  Icon: IcoUsers },
    { to: '/settings', label: 'Settings', Icon: IcoSettings },
  ];

  const nav = workspace === 'monitoring' ? monitoringNav : signageNav;

  // Topbar breadcrumb
  let crumbs = PAGE_TITLES[location.pathname] || ['Monitoring', 'Overview'];
  if (isSignagePath(location.pathname)) {
    const tabLabels = { overview: 'Dashboard', content: 'Content', schedule: 'Schedule', screens: 'Screens' };
    crumbs = ['e-Calendar', tabLabels[currentTab] || 'Dashboard'];
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
    if (!isSignagePath(location.pathname)) {
      return location.pathname === n.to;
    }
    // signage: match by tab
    return n.tab === currentTab;
  }

  return (
    <div className="app">
      {/* Mobile backdrop */}
      <div className={`mob-backdrop${sidebarOpen ? '' : ' mob-backdrop--hidden'}`}
        onClick={() => setSidebar(false)} />

      {/* Sidebar */}
      <aside className={`app__sidebar${sidebarOpen ? ' app__sidebar--open' : ''}`}>
        <div className="brand">
          <div className="brand__mark">
            <svg width="18" height="14" viewBox="0 0 22 16" fill="none">
              <path d="M1 8 L5 8 L7 2 L10 14 L12.5 8 L15 8 L16.5 5 L18 11 L19.5 8 L21 8"
                stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="brand__text">
            <div className="brand__name">Taarifa</div>
            <div className="brand__sub">Environmental</div>
          </div>
        </div>

        <div className="ws-toggle">
          <div className="ws-toggle__track">
            {[
              { key: 'monitoring', label: 'Monitoring', Icon: IcoZap },
              { key: 'signage',    label: 'e-Calendar', Icon: IcoMonitor },
            ].map(({ key, label, Icon }) => (
              <button key={key}
                className={`ws-toggle__btn ${workspace === key ? 'active' : ''}`}
                onClick={() => { setWorkspace(key); navigate(key === 'signage' ? '/ecalendar' : '/'); }}>
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>
        </div>

        <nav className="nav">
          <div className="nav__section">
            <div className="nav__heading">{workspace === 'monitoring' ? 'Monitoring' : 'e-Calendar'}</div>
            {nav.map(n => (
              <a key={n.label}
                className={`nav__item ${isNavActive(n) ? 'active' : ''}`}
                href={n.to}
                onClick={e => { e.preventDefault(); navigate(n.to); }}>
                <n.Icon className="nav__icon" size={16} />
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
                  href={n.to}
                  onClick={e => { e.preventDefault(); navigate(n.to); }}>
                  <n.Icon className="nav__icon" size={16} />
                  <span>{n.label}</span>
                </a>
              ))}
            </div>
          )}
        </nav>

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
          <div className="search">
            <IcoSearch size={13} />
            <input placeholder="Search devices, alerts, sites…" />
            <span className="kbd">⌘K</span>
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
