const BASE = '/api/v1';

function getToken()        { return localStorage.getItem('token'); }
function getRefreshToken() { return localStorage.getItem('refreshToken'); }

function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
}

let _refreshing = false;

async function tryRefresh() {
  const refreshToken = getRefreshToken();
  if (!refreshToken || _refreshing) return false;
  _refreshing = true;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const { token } = await res.json();
    localStorage.setItem('token', token);
    return true;
  } catch {
    return false;
  } finally {
    _refreshing = false;
  }
}

async function request(method, path, body, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    ...options,
  });

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      // Retry original request with new token
      const retryHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` };
      const retry = await fetch(`${BASE}${path}`, {
        method,
        headers: retryHeaders,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (retry.status === 401) {
        clearAuth();
        window.location.href = '/login';
        throw new Error('Unauthorized');
      }
      const retryData = retry.status === 204 ? null : await retry.json().catch(() => null);
      if (!retry.ok) throw new Error(retryData?.message || retryData?.error || `HTTP ${retry.status}`);
      return retryData;
    }
    clearAuth();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

export const api = {
  // Auth
  login:          (body) => request('POST', '/auth/login', body),
  register:       (body) => request('POST', '/auth/register', body),
  refresh:        (body) => request('POST', '/auth/refresh', body),
  logout:         (body) => request('POST', '/auth/logout', body),
  changePassword: (body) => request('POST', '/auth/change-password', body),
  me:             ()     => request('GET',  '/users/me'),

  // Users
  listUsers:   ()       => request('GET',   '/users'),
  createUser:  (body)   => request('POST',  '/users', body),
  updateUser:  (id, b)  => request('PATCH', `/users/${id}`, b),
  deleteUser:  (id)     => request('DELETE', `/users/${id}`),

  // Devices
  listDevices:  (params) => request('GET',   '/devices?' + new URLSearchParams(params)),
  getDevice:    (id)     => request('GET',   `/devices/${id}`),
  createDevice: (body)   => request('POST',  '/devices', body),
  updateDevice: (id, b)  => request('PATCH', `/devices/${id}`, b),
  deleteDevice: (id)     => request('DELETE', `/devices/${id}`),
  rotateKey:    (id)     => request('POST',  `/devices/${id}/rotate-key`),
  listGroups:   ()       => request('GET',   '/devices/groups'),
  createGroup:  (body)   => request('POST',  '/devices/groups', body),

  // Data
  getReadings:   (params) => request('GET', '/data/readings?' + new URLSearchParams(params)),
  getLatest:     (id)     => request('GET', `/data/latest/${id}`),
  getStats:      (id, p)  => request('GET', `/data/stats/${id}?` + new URLSearchParams(p)),
  getMapData:    ()       => request('GET', '/data/map'),
  getSparklines: (p)      => request('GET', '/data/sparklines?' + new URLSearchParams(p || {})),
  getFleet:      ()       => request('GET', '/data/fleet'),

  // Alerts
  listAlertRules:   ()       => request('GET',    '/alerts/rules'),
  createAlertRule:  (body)   => request('POST',   '/alerts/rules', body),
  updateAlertRule:  (id, b)  => request('PATCH',  `/alerts/rules/${id}`, b),
  deleteAlertRule:  (id)     => request('DELETE', `/alerts/rules/${id}`),
  listAlertEvents:  (params) => request('GET',    '/alerts/events?' + new URLSearchParams(params)),
  acknowledgeAlert: (id)     => request('POST',   `/alerts/events/${id}/acknowledge`),
  resolveAlert:     (id)     => request('POST',   `/alerts/events/${id}/resolve`),

  // Weather
  getWeather:        (params) => request('GET', '/weather?' + new URLSearchParams(params)),
  getCurrentWeather: (params) => request('GET', '/weather/current?' + new URLSearchParams(params)),

  // Exports
  createExport:   (body) => request('POST', '/exports', body),
  getExportJob:   (id)   => request('GET',  `/exports/${id}`),
  downloadExport: (id)   => `${BASE}/exports/${id}/download`,
  exportReadings: async (params) => {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE}/exports/download?` + new URLSearchParams(params), { headers });
    if (!res.ok) throw new Error(`Export failed: HTTP ${res.status}`);
    return res.blob();
  },

  // Firmware
  listFirmware:    ()      => request('GET',    '/firmware'),
  createFirmware:  (body)  => request('POST',   '/firmware', body),
  activateFirmware:(id)    => request('PATCH',  `/firmware/${id}/activate`),
  deleteFirmware:  (id)    => request('DELETE', `/firmware/${id}`),
  checkFirmware:   (deviceId, apiKey) => fetch(`/api/v1/firmware/check/${deviceId}`, { headers: { 'x-api-key': apiKey } }).then(r => r.json()),

  // Device detail
  getDeviceWithLatest: async (id) => {
    const [device, latest] = await Promise.all([
      request('GET', `/devices/${id}`),
      request('GET', `/data/latest/${id}`),
    ]);
    return { device, latest };
  },
  getDeviceReadings: (deviceId, params) => request('GET', `/data/readings?deviceId=${deviceId}&` + new URLSearchParams(params)),

  // E-Calendar — groups
  getEcalStats:       ()       => request('GET',    '/ecal/stats'),
  listEcalGroups:     ()       => request('GET',    '/ecal/groups'),
  createEcalGroup:    (body)   => request('POST',   '/ecal/groups', body),
  updateEcalGroup:    (id, b)  => request('PATCH',  `/ecal/groups/${id}`, b),
  deleteEcalGroup:    (id)     => request('DELETE', `/ecal/groups/${id}`),

  // E-Calendar — devices
  listEcalDevices:    ()       => request('GET',    '/ecal/devices'),
  createEcalDevice:   (body)   => request('POST',   '/ecal/devices', body),
  updateEcalDevice:   (id, b)  => request('PATCH',  `/ecal/devices/${id}`, b),
  deleteEcalDevice:   (id)     => request('DELETE', `/ecal/devices/${id}`),
  otaEcalDevice:      (id, b)  => request('POST',   `/ecal/devices/${id}/ota`, b),

  // E-Calendar — content
  listEcalContent:    (p)      => request('GET',    '/ecal/content?' + new URLSearchParams(p || {})),
  createEcalContent:  (body)   => request('POST',   '/ecal/content', body),
  updateEcalContent:  (id, b)  => request('PATCH',  `/ecal/content/${id}`, b),
  deleteEcalContent:  (id)     => request('DELETE', `/ecal/content/${id}`),

  // E-Calendar — campaigns
  listEcalCampaigns:  ()       => request('GET',    '/ecal/campaigns'),
  createEcalCampaign: (body)   => request('POST',   '/ecal/campaigns', body),
  deleteEcalCampaign: (id)     => request('DELETE', `/ecal/campaigns/${id}`),

  // Energy — systems
  listEnergySystems:   ()       => request('GET',    '/energy/systems'),
  createEnergySystem:  (body)   => request('POST',   '/energy/systems', body),
  updateEnergySystem:  (id, b)  => request('PATCH',  `/energy/systems/${id}`, b),
  deleteEnergySystem:  (id)     => request('DELETE', `/energy/systems/${id}`),

  // Energy — devices
  listEnergyDevices:   (p)      => request('GET',    '/energy/devices?' + new URLSearchParams(p || {})),
  getEnergyDevice:     (id)     => request('GET',    `/energy/devices/${id}`),
  createEnergyDevice:  (body)   => request('POST',   '/energy/devices', body),
  updateEnergyDevice:  (id, b)  => request('PATCH',  `/energy/devices/${id}`, b),
  deleteEnergyDevice:  (id)     => request('DELETE', `/energy/devices/${id}`),
  rotateEnergyKey:     (id)     => request('POST',   `/energy/devices/${id}/rotate-key`),

  // Energy — readings & fleet
  getEnergyFleet:      ()       => request('GET',    '/energy/fleet'),
  getEnergyReadings:   (p)      => request('GET',    '/energy/readings?' + new URLSearchParams(p)),
  getEnergyLatest:     (id)     => request('GET',    `/energy/latest/${id}`),
  getEnergyStats:      (p)      => request('GET',    '/energy/stats?' + new URLSearchParams(p)),
};
