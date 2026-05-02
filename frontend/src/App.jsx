import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.js';
import Layout from './components/common/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import DevicesPage from './pages/DevicesPage.jsx';
import DeviceDetailPage from './pages/DeviceDetailPage.jsx';
import DataPage from './pages/DataPage.jsx';
import MapPage from './pages/MapPage.jsx';
import AlertsPage from './pages/AlertsPage.jsx';
import ExportsPage from './pages/ExportsPage.jsx';
import ECalendarPage from './pages/ECalendarPage.jsx';
import UsersPage from './pages/UsersPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

function RequireAuth({ children }) {
  const token = useAuthStore((s) => s.token);
  return token ? children : <Navigate to="/login" replace />;
}

function PublicOnly({ children }) {
  const token = useAuthStore((s) => s.token);
  return !token ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"    element={<PublicOnly><LoginPage /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />

        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<DashboardPage />} />
          <Route path="devices"    element={<DevicesPage />} />
          <Route path="devices/:id" element={<DeviceDetailPage />} />
          <Route path="data"       element={<DataPage />} />
          <Route path="map"        element={<MapPage />} />
          <Route path="alerts"     element={<AlertsPage />} />
          <Route path="exports"    element={<ExportsPage />} />
          <Route path="ecalendar"  element={<ECalendarPage />} />
          <Route path="users"      element={<UsersPage />} />
          <Route path="settings"   element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
