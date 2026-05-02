import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.js';
import { api } from '../../services/api.js';
import { useQuery } from '@tanstack/react-query';
import {
  IcoHome, IcoCpu, IcoData, IcoMap, IcoBell, IcoFileChart,
  IcoMonitor, IcoCalendar, IcoUsers, IcoSettings,
  IcoSearch, IcoSun, IcoMoon, IcoBell2, IcoExt, IcoZap,
  IcoLayers, IcoChevDown,
} from '../ui/Icons.jsx';
import { Btn, Seg } from '../ui/index.jsx';

const PAGE_TITLES = {
  '/':             ['Monitoring',     'Overview'],
  '/devices':      ['Monitoring',     'Devices'],
  '/data':         ['Monitoring',     'Data Explorer'],
  '/map':          ['Monitoring',     'Map'],
  '/alerts':       ['Monitoring',     'Alerts'],
  '/exports':      ['Monitoring',     'Reports'],
  '/ecalendar':    ['Signage',        'Overview'],
  '/users':        ['Organisation',   'Members'],
  '/settings':     ['Organisation',   'Settings'],
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
  const [theme, setTheme] = useState(() => localStorage.getItem('taarifa-theme') || 'light');
  const [workspace, setWorkspace] = useState(() =>
    isSignagePath(location.pathname) ? 'signage' : 'monitoring'
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('taarifa-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (isSignagePath(location.pathname)) setWorkspace('signage');
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
    { to: '/ecalendar',                  label: 'Overview',   Icon: IcoHome,       tab: 'overview' },
    { to: '/ecalendar?tab=content',      label: 'Content',    Icon: IcoLayers,     tab: 'content' },
    { to: '/ecalendar?tab=campaigns',    label: 'Campaigns',  Icon: IcoCalendar,   tab: 'campaigns' },
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
    const tabLabels = { overview: 'Overview', content: 'Content', campaigns: 'Campaigns', screens: 'Screens' };
    crumbs = ['Signage', tabLabels[currentTab] || 'Overview'];
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
      {/* Sidebar */}
      <aside className="app__sidebar">
        <div className="brand">
          <div className="brand__mark">T</div>
          <div className="brand__name">Taarifa</div>
          <div className="brand__sub">v3.0</div>
        </div>

        <div className="workspace">
          <button className="workspace__btn"
            onClick={() => {
              const next = workspace === 'monitoring' ? 'signage' : 'monitoring';
              setWorkspace(next);
              navigate(next === 'signage' ? '/ecalendar' : '/');
            }}>
            <div className={`workspace__icon workspace__icon--${workspace === 'monitoring' ? 'mon' : 'sig'}`}>
              {workspace === 'monitoring' ? <IcoZap size={14} /> : <IcoMonitor size={14} />}
            </div>
            <div className="workspace__label">
              <div>{workspace === 'monitoring' ? 'Monitoring' : 'Signage'}</div>
              <small>{orgName}</small>
            </div>
            <IcoChevDown size={14} style={{ color: 'var(--fg-subtle)' }} />
          </button>
        </div>

        <nav className="nav">
          <div className="nav__section">
            <div className="nav__heading">{workspace === 'monitoring' ? 'Monitoring' : 'Digital signage'}</div>
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
