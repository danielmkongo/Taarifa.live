import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api.js';
import { subDays, format } from 'date-fns';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const SENSORS = [
  { key: 'temperature', label: 'Temperature (°C)', color: '#ef4444' },
  { key: 'humidity',    label: 'Humidity (%)',       color: '#3b82f6' },
  { key: 'pressure',    label: 'Pressure (hPa)',     color: '#8b5cf6' },
  { key: 'rainfall',    label: 'Rainfall (mm)',      color: '#0ea5e9' },
  { key: 'wind_speed',  label: 'Wind Speed (m/s)',   color: '#10b981' },
  { key: 'co2',         label: 'CO₂ (ppm)',          color: '#f59e0b' },
];

const GRANULARITIES = ['raw', 'hourly', 'daily'];

export default function DataPage() {
  const { t } = useTranslation();
  const [deviceId, setDeviceId] = useState('');
  const [sensorKey, setSensorKey] = useState('temperature');
  const [granularity, setGranularity] = useState('hourly');
  const [chartType, setChartType] = useState('line');
  const [dateRange, setDateRange] = useState({
    from: format(subDays(new Date(), 7), "yyyy-MM-dd'T'HH:mm"),
    to:   format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  });

  const { data: devicesData } = useQuery({ queryKey: ['devices'], queryFn: () => api.listDevices({ limit: 100 }) });
  const devices = devicesData?.devices || [];

  const { data: readings, isLoading, error } = useQuery({
    queryKey: ['readings', deviceId, sensorKey, dateRange, granularity],
    queryFn: () => api.getReadings({ deviceId, sensorKey, from: dateRange.from, to: dateRange.to, granularity }),
    enabled: !!deviceId,
  });

  const { data: stats } = useQuery({
    queryKey: ['stats', deviceId, sensorKey, dateRange],
    queryFn: () => api.getStats(deviceId, { sensorKey, from: dateRange.from, to: dateRange.to }),
    enabled: !!deviceId,
  });

  const sensor = SENSORS.find(s => s.key === sensorKey);
  const statForSensor = stats?.find(s => s._id === sensorKey);

  // Format chart data
  const chartData = (readings || []).map(r => ({
    time: r.time ? format(new Date(r.time), 'MM/dd HH:mm') :
          r._id?.bucket ? format(new Date(r._id.bucket), 'MM/dd HH:mm') : '',
    value: granularity === 'raw' ? r.value : r.avg,
    min: r.min, max: r.max,
  }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Data Explorer</h1>
        <p className="text-gray-500 mt-1">Query and visualize sensor time-series data</p>
      </div>

      {/* Controls */}
      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="label">Device</label>
            <select className="input" value={deviceId} onChange={e => setDeviceId(e.target.value)}>
              <option value="">Select device...</option>
              {devices.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Sensor</label>
            <select className="input" value={sensorKey} onChange={e => setSensorKey(e.target.value)}>
              {SENSORS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">From</label>
            <input type="datetime-local" className="input" value={dateRange.from}
              onChange={e => setDateRange(r => ({ ...r, from: e.target.value }))} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="datetime-local" className="input" value={dateRange.to}
              onChange={e => setDateRange(r => ({ ...r, to: e.target.value }))} />
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {GRANULARITIES.map(g => (
              <button key={g} onClick={() => setGranularity(g)}
                className={`px-3 py-1.5 capitalize transition-colors ${granularity === g ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                {g}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {['line', 'bar'].map(ct => (
              <button key={ct} onClick={() => setChartType(ct)}
                className={`px-3 py-1.5 capitalize transition-colors ${chartType === ct ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                {ct}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      {statForSensor && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Average', value: statForSensor.avg?.toFixed(2) },
            { label: 'Minimum', value: statForSensor.min?.toFixed(2) },
            { label: 'Maximum', value: statForSensor.max?.toFixed(2) },
            { label: 'Samples', value: statForSensor.count?.toLocaleString() },
          ].map(({ label, value }) => (
            <div key={label} className="card text-center">
              <div className="text-xl font-bold text-gray-900">{value ?? '—'}</div>
              <div className="text-sm text-gray-500 mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">{sensor?.label}</h2>
        {!deviceId
          ? <div className="h-64 flex items-center justify-center text-gray-400">Select a device to view data</div>
          : isLoading
          ? <div className="h-64 flex items-center justify-center text-gray-400">{t('common.loading')}</div>
          : error
          ? <div className="h-64 flex items-center justify-center text-red-500">{error.message}</div>
          : chartData.length === 0
          ? <div className="h-64 flex items-center justify-center text-gray-400">{t('common.noData')}</div>
          : (
            <ResponsiveContainer width="100%" height={320}>
              {chartType === 'line' ? (
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="value" stroke={sensor?.color} strokeWidth={2} dot={false} name={sensor?.label} />
                  {granularity !== 'raw' && <>
                    <Line type="monotone" dataKey="min" stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" dot={false} name="Min" />
                    <Line type="monotone" dataKey="max" stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" dot={false} name="Max" />
                  </>}
                </LineChart>
              ) : (
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill={sensor?.color} name={sensor?.label} />
                </BarChart>
              )}
            </ResponsiveContainer>
          )
        }
      </div>
    </div>
  );
}
