const BASE = '/api/v1';

function getToken() {
  return localStorage.getItem('token');
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
    localStorage.removeItem('token');
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
};
