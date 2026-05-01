import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api.js';
import { useEffect, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { format, subHours } from 'date-fns';

function StatCard({ label, value, icon, color = 'blue', sub }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-700',
    green:  'bg-green-50 text-green-700',
    red:    'bg-red-50 text-red-700',
    yellow: 'bg-yellow-50 text-yellow-700',
  };
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value ?? '—'}</div>
        <div className="text-sm text-gray-500">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const wsRef = useRef(null);

  const { data: mapData, refetch } = useQuery({
    queryKey: ['map-data'],
    queryFn: api.getMapData,
    refetchInterval: 30_000,
  });

  const { data: alertEvents } = useQuery({
    queryKey: ['alert-events', { state: 'open' }],
    queryFn: () => api.listAlertEvents({ state: 'open', limit: 5 }),
    refetchInterval: 30_000,
  });

  // WebSocket for real-time updates
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?token=${token}`);
    wsRef.current = ws;

    ws.onmessage = () => refetch();
    ws.onerror = () => {};

    return () => ws.close();
  }, [refetch]);

  const devices = mapData || [];
  const total = devices.length;
  const online = devices.filter(d => d.status === 'online').length;
  const openAlerts = alertEvents?.total ?? 0;

  // Build a simple chart from latest reading times
  const recentDevices = devices.slice(0, 5);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('dashboard.title')}</h1>
        <p className="text-gray-500 mt-1">Real-time environmental intelligence</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('dashboard.totalDevices')}  value={total}      icon="📡" color="blue" />
        <StatCard label={t('dashboard.onlineDevices')} value={online}     icon="✅" color="green"
                  sub={`${total - online} offline`} />
        <StatCard label={t('dashboard.activeAlerts')}  value={openAlerts} icon="🔔" color={openAlerts > 0 ? 'red' : 'blue'} />
        <StatCard label="Data Points (24h)" value="—" icon="📈" color="yellow" />
      </div>

      {/* Recent devices list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Device Status</h2>
          {devices.length === 0
            ? <p className="text-sm text-gray-500">{t('common.noData')}</p>
            : (
              <div className="space-y-2">
                {devices.slice(0, 8).map(d => (
                  <div key={d._id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        d.status === 'online' ? 'bg-green-500' :
                        d.status === 'alert' ? 'bg-red-500' : 'bg-gray-400'
                      }`} />
                      <span className="text-sm font-medium text-gray-800">{d.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {d.batteryLevel != null && (
                        <span className="text-xs text-gray-500">🔋 {d.batteryLevel}%</span>
                      )}
                      <span className={`badge ${
                        d.status === 'online' ? 'badge-green' :
                        d.status === 'alert' ? 'badge-red' : 'badge-gray'
                      }`}>
                        {t(`common.${d.status}`)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </div>

        {/* Open alerts */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Open Alerts</h2>
          {!alertEvents?.events?.length
            ? <p className="text-sm text-gray-500 text-center py-8">✅ No open alerts</p>
            : (
              <div className="space-y-2">
                {alertEvents.events.map(e => (
                  <div key={e._id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                    <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                      e.severity === 'critical' ? 'bg-red-500' :
                      e.severity === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{e.message}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {format(new Date(e.createdAt), 'MMM d, HH:mm')}
                      </div>
                    </div>
                    <span className={`badge flex-shrink-0 ${
                      e.severity === 'critical' ? 'badge-red' :
                      e.severity === 'warning' ? 'badge-yellow' : 'badge-blue'
                    }`}>
                      {e.severity}
                    </span>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      </div>
    </div>
  );
}
