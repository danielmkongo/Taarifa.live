import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/auth.js';
import { api } from '../../services/api.js';

const navItems = [
  { to: '/',          icon: '⊞',  key: 'dashboard' },
  { to: '/devices',   icon: '📡', key: 'devices' },
  { to: '/data',      icon: '📊', key: 'data' },
  { to: '/map',       icon: '🗺', key: 'map' },
  { to: '/alerts',    icon: '🔔', key: 'alerts' },
  { to: '/exports',   icon: '📥', key: 'reports' },
  { to: '/ecalendar', icon: '🖥', key: 'ecalendar' },
  { to: '/users',     icon: '👥', key: 'users' },
];

export default function Layout() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  async function handleLogout() {
    await api.logout({}).catch(() => {});
    logout();
    navigate('/login');
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-gray-900 text-white flex flex-col">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌍</span>
            <div>
              <div className="font-bold text-lg leading-tight">Taarifa</div>
              <div className="text-xs text-gray-400">.live</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon, key }) => (
            <NavLink
              key={key}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <span className="text-base">{icon}</span>
              {t(`nav.${key}`)}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-gray-800 space-y-3">
          {/* Language toggle */}
          <div className="flex gap-2">
            {['en', 'sw'].map(lang => (
              <button
                key={lang}
                onClick={() => i18n.changeLanguage(lang)}
                className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${
                  i18n.language === lang
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {lang === 'en' ? 'EN' : 'SW'}
              </button>
            ))}
          </div>

          {/* User info */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-sm font-bold">
              {user?.fullName?.[0] || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{user?.fullName}</div>
              <div className="text-xs text-gray-400 truncate capitalize">{user?.role}</div>
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-white text-sm transition-colors"
              title="Sign out"
            >
              ⇥
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
