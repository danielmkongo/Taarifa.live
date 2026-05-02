/**
 * Taarifa demo seed — Tanzania National Parks Authority (TANAPA)
 * Run: node seed.mjs
 * Creates org, users, devices, 48h readings, alert rules & events.
 * Safe to re-run: skips existing records.
 */
import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const MONGO_URL = process.env.MONGO_URL;
const MONGO_DB  = process.env.MONGO_DB || 'taarifa';
if (!MONGO_URL) { console.error('MONGO_URL not set in .env'); process.exit(1); }

// ─── helpers ────────────────────────────────────────────────────────────────
function rng(seed) {
  let s = seed | 0; if (s === 0) s = 1;
  return () => { s = (s * 1664525 + 1013904223) | 0; return (s >>> 0) / 4294967296; };
}
function genSeries(n, base, noise, drift = 0, seed = 1) {
  const r = rng(seed); let v = base;
  return Array.from({ length: n }, () => { v += (r() - 0.5) * noise + drift / n; return +v.toFixed(2); });
}
function apiKey() {
  const raw = crypto.randomBytes(32).toString('hex');
  return { apiKey: raw, apiKeyPrefix: raw.slice(0, 8), apiKeyHash: crypto.createHash('sha256').update(raw).digest('hex') };
}
const now = new Date();
const hoursAgo = h => new Date(Date.now() - h * 3_600_000);

// ─── Tanzania site definitions ───────────────────────────────────────────────
const GROUPS = ['Savanna', 'Highland', 'Forest', 'Coastal', 'Wetland'];

const DEVICE_DEFS = [
  // Savanna group
  { name: 'Serengeti-North-A1', deviceId: 'TRF-001', site: 'Serengeti NP — Lobo', lat: -2.004, lon: 34.839,  group: 'Savanna',  status: 'online',      battery: 88, signal: 4, fw: '2.4.1', sensors: { temperature: [30, 1.8, 6, 1], humidity: [55, 3, 10, 2], rainfall: [0.8, 0.4, 0.5, 3], wind_speed: [4.2, 0.8, 3, 4] } },
  { name: 'Serengeti-East-A2',  deviceId: 'TRF-002', site: 'Serengeti NP — Seronera', lat: -2.458, lon: 34.823, group: 'Savanna',  status: 'online',      battery: 67, signal: 4, fw: '2.4.1', sensors: { temperature: [31, 1.6, 5, 5], humidity: [52, 4, 12, 6], wind_speed: [5.1, 1.0, 4, 7], co2: [410, 5, 20, 8] } },
  { name: 'Ruaha-River-Camp',   deviceId: 'TRF-003', site: 'Ruaha NP — Msembe', lat: -7.621, lon: 34.921,  group: 'Savanna',  status: 'alert',       battery: 19, signal: 2, fw: '2.3.0', sensors: { temperature: [38, 2.5, 9, 9], humidity: [38, 4, 15, 10], wind_speed: [3.0, 0.5, 2, 11], co2: [420, 8, 30, 12] } },
  { name: 'Mikumi-Gate',        deviceId: 'TRF-004', site: 'Mikumi NP — HQ', lat: -7.357, lon: 36.889,     group: 'Savanna',  status: 'online',      battery: 93, signal: 5, fw: '2.4.1', sensors: { temperature: [29, 1.4, 4, 13], humidity: [61, 3, 8, 14], rainfall: [1.2, 0.6, 1, 15], wind_speed: [3.8, 0.6, 2, 16] } },
  // Highland group
  { name: 'Kili-Marangu-Base',  deviceId: 'TRF-005', site: 'Kilimanjaro — Marangu Gate', lat: -3.281, lon: 37.513, group: 'Highland', status: 'online',      battery: 72, signal: 3, fw: '2.4.1', sensors: { temperature: [14, 1.2, 4, 17], humidity: [78, 5, 10, 18], pressure: [812, 2, 6, 19], wind_speed: [7.4, 1.4, 5, 20] } },
  { name: 'Ngorongoro-Rim',     deviceId: 'TRF-006', site: 'Ngorongoro — Crater Rim', lat: -3.162, lon: 35.584, group: 'Highland', status: 'online',      battery: 54, signal: 3, fw: '2.4.1', sensors: { temperature: [16, 1.0, 3, 21], humidity: [82, 4, 8, 22], pressure: [790, 1.5, 5, 23], wind_speed: [9.2, 2.0, 6, 24] } },
  { name: 'Ngorongoro-Valley',  deviceId: 'TRF-007', site: 'Ngorongoro — Crater Floor', lat: -3.222, lon: 35.536, group: 'Highland', status: 'alert',       battery: 35, signal: 2, fw: '2.4.1', sensors: { temperature: [22, 1.6, 5, 25], humidity: [68, 5, 12, 26], pressure: [760, 2, 7, 27], co2: [1820, 50, 200, 28] } },
  // Forest group
  { name: 'Gombe-Stream-F1',    deviceId: 'TRF-008', site: 'Gombe Stream NP', lat: -4.706, lon: 29.617,    group: 'Forest',   status: 'online',      battery: 81, signal: 2, fw: '2.4.1', sensors: { temperature: [24, 0.8, 3, 29], humidity: [86, 3, 8, 30], co2: [440, 6, 20, 31], rainfall: [3.1, 1.2, 2, 32] } },
  { name: 'Mahale-Ridge-F2',    deviceId: 'TRF-009', site: 'Mahale Mountains NP', lat: -6.107, lon: 29.797, group: 'Forest',   status: 'offline',     battery: 0,  signal: 0, fw: '2.3.0', sensors: { temperature: [22, 0.6, 2, 33], humidity: [89, 2, 6, 34] } },
  // Coastal group
  { name: 'Zanzibar-North-C1',  deviceId: 'TRF-010', site: 'Zanzibar — Nungwi', lat: -5.724, lon: 39.298,  group: 'Coastal',  status: 'online',      battery: 76, signal: 5, fw: '2.4.1', sensors: { temperature: [29, 0.8, 2, 35], humidity: [80, 2, 6, 36], pressure: [1012, 1, 3, 37], wind_speed: [6.5, 1.2, 4, 38] } },
  { name: 'Zanzibar-South-C2',  deviceId: 'TRF-011', site: 'Zanzibar — Jambiani', lat: -6.336, lon: 39.536, group: 'Coastal',  status: 'maintenance', battery: 100,signal: 5, fw: '2.4.2', sensors: { temperature: [28, 0.7, 2, 39], humidity: [82, 2, 5, 40] } },
  // Wetland group
  { name: 'Selous-Delta-W1',    deviceId: 'TRF-012', site: 'Nyerere NP — Rufiji Delta', lat: -8.106, lon: 37.652, group: 'Wetland',  status: 'online',      battery: 63, signal: 3, fw: '2.4.1', sensors: { temperature: [27, 1.2, 4, 41], humidity: [88, 3, 8, 42], pressure: [1008, 1.5, 4, 43], rainfall: [2.4, 0.9, 2, 44] } },
];

const ALERT_RULES_DEFS = [
  { name: 'Heat — Savanna',    sensorKey: 'temperature', operator: '>',  threshold: 37,   severity: 'critical', channels: ['email','sms','web'],    scope: 'Savanna group' },
  { name: 'CO₂ air quality',   sensorKey: 'co2',         operator: '>',  threshold: 1500, severity: 'critical', channels: ['email','web','webhook'], scope: 'All devices' },
  { name: 'Power health',      sensorKey: 'battery',     operator: '<',  threshold: 25,   severity: 'warning',  channels: ['web'],                   scope: 'All devices' },
  { name: 'Liveness check',    sensorKey: 'heartbeat',   operator: '>',  threshold: 1800, severity: 'warning',  channels: ['email','web'],           scope: 'All devices' },
  { name: 'Storm watch',       sensorKey: 'pressure',    operator: '<',  threshold: 998,  severity: 'info',     channels: ['web'],                   scope: 'Coastal group' },
  { name: 'Wind — Highland',   sensorKey: 'wind_speed',  operator: '>',  threshold: 15,   severity: 'warning',  channels: ['email','web'],           scope: 'Highland group' },
  { name: 'Humidity — Forest', sensorKey: 'humidity',    operator: '<',  threshold: 70,   severity: 'info',     channels: ['web'],                   scope: 'Forest group' },
];

// ─── main ────────────────────────────────────────────────────────────────────
const client = new MongoClient(MONGO_URL);
await client.connect();
const db = client.db(MONGO_DB);

// ── Org ──────────────────────────────────────────────────────────────────────
let org = await db.collection('organizations').findOne({ slug: 'tanapa' });
if (!org) {
  const { insertedId } = await db.collection('organizations').insertOne({
    name: 'Tanzania National Parks Authority', slug: 'tanapa',
    plan: 'pro', isActive: true, settings: {}, createdAt: now, updatedAt: now,
  });
  org = { _id: insertedId };
  console.log('✓ Created org TANAPA');
} else {
  console.log('· Using existing org:', org._id);
}
const orgId = org._id;

// ── Users ────────────────────────────────────────────────────────────────────
const USERS = [
  { email: 'admin@tanapa.go.tz',   fullName: 'Daniel Mkongo',    role: 'org_admin', pw: 'Taarifa2024!' },
  { email: 'manager@tanapa.go.tz', fullName: 'Aisha Mwamba',     role: 'manager',   pw: 'Taarifa2024!' },
  { email: 'viewer@tanapa.go.tz',  fullName: 'Joseph Ndambuki',  role: 'viewer',    pw: 'Taarifa2024!' },
];
for (const u of USERS) {
  const exists = await db.collection('users').findOne({ email: u.email });
  if (!exists) {
    await db.collection('users').insertOne({
      orgId, email: u.email, passwordHash: await bcrypt.hash(u.pw, 12),
      fullName: u.fullName, role: u.role,
      locale: 'en', isActive: true, createdAt: now, updatedAt: now,
    });
    console.log(`✓ Created user ${u.email} (pw: ${u.pw})`);
  } else {
    console.log(`· User ${u.email} already exists`);
  }
}

// ── Device groups ─────────────────────────────────────────────────────────────
const groupMap = {};
for (const name of GROUPS) {
  let g = await db.collection('deviceGroups').findOne({ orgId, name });
  if (!g) {
    const { insertedId } = await db.collection('deviceGroups').insertOne({ orgId, name, description: `${name} monitoring stations`, createdAt: now });
    g = { _id: insertedId };
    console.log(`✓ Created group "${name}"`);
  }
  groupMap[name] = g._id;
}

// ── Devices ───────────────────────────────────────────────────────────────────
const deviceMap = {}; // deviceId string → ObjectId
for (const def of DEVICE_DEFS) {
  let device = await db.collection('devices').findOne({ orgId, name: def.name });
  if (!device) {
    const k = apiKey();
    const lastSeen = def.status === 'offline' ? new Date(Date.now() - 3 * 3_600_000) : new Date(Date.now() - Math.random() * 120_000);
    const { insertedId } = await db.collection('devices').insertOne({
      orgId,
      groupId: groupMap[def.group],
      name: def.name,
      description: `${def.site} environmental station`,
      serialNumber: def.deviceId,
      firmwareVersion: def.fw,
      hardwareVersion: 'v2',
      location: { type: 'Point', coordinates: [def.lon, def.lat] },
      locationName: def.site,
      altitudeM: null,
      status: def.status,
      lastSeenAt: def.status === 'offline' ? lastSeen : new Date(),
      batteryLevel: def.battery,
      signalStrength: def.signal,
      config: { sampling_interval_s: 300, upload_interval_s: 900 },
      configPending: false,
      apiKeyHash: k.apiKeyHash,
      apiKeyPrefix: k.apiKeyPrefix,
      isActive: true,
      createdAt: now, updatedAt: now,
    });
    device = { _id: insertedId };
    console.log(`✓ Created device ${def.deviceId} — ${def.name}`);
  } else {
    console.log(`· Device ${def.name} already exists`);
  }
  deviceMap[def.deviceId] = { _id: device._id, def };
}

// ── Sensor readings (48h, every 15 min) ──────────────────────────────────────
const INTERVAL_MS = 15 * 60_000; // 15 min
const HOURS = 48;
const STEPS = (HOURS * 60) / 15; // 192 steps

console.log(`\nGenerating ${STEPS} time steps × sensors (this may take a moment)…`);

for (const [devId, { _id: deviceId, def }] of Object.entries(deviceMap)) {
  if (def.status === 'offline') continue; // no readings for offline device

  const existing = await db.collection('sensorReadings').countDocuments({ 'meta.deviceId': deviceId });
  if (existing > 100) { console.log(`· Readings for ${devId} already exist (${existing}), skipping`); continue; }

  const docs = [];
  for (let step = 0; step < STEPS; step++) {
    const ts = new Date(Date.now() - (STEPS - step) * INTERVAL_MS);
    for (const [sensorKey, [base, noise, amplitude, seed]] of Object.entries(def.sensors)) {
      // Diurnal variation: temp peaks at step ~60 (15h into 48h, ~3pm)
      const hour = ts.getUTCHours();
      const diurnal = sensorKey === 'temperature' ? Math.sin((hour - 6) * Math.PI / 12) * amplitude * 0.5 : 0;
      const series = genSeries(1, base + diurnal, noise, 0, seed + step);
      let value = series[0];
      // Rainfall is 0 most of the time, spikes occasionally
      if (sensorKey === 'rainfall') value = step % 18 === 0 ? value + Math.abs(genSeries(1, 0, amplitude, 0, seed + step * 3)[0]) : Math.max(0, value * 0.1);
      // Alert device: push temperature high in last 6h
      if (def.status === 'alert' && sensorKey === 'temperature' && step > STEPS - 24) value = Math.max(value, 37.5 + (step - (STEPS - 24)) * 0.1);
      if (def.status === 'alert' && sensorKey === 'co2' && step > STEPS - 24) value = Math.max(value, 1500 + (step - (STEPS - 24)) * 20);

      docs.push({ timestamp: ts, meta: { deviceId, orgId, sensorKey }, value: +value.toFixed(2), quality: 100 });
    }
  }
  await db.collection('sensorReadings').insertMany(docs, { ordered: false });
  console.log(`✓ Inserted ${docs.length} readings for ${devId}`);
}

// ── Alert rules ───────────────────────────────────────────────────────────────
const existingRules = await db.collection('alertRules').countDocuments({ orgId });
let ruleMap = {};
if (existingRules === 0) {
  for (const def of ALERT_RULES_DEFS) {
    const { insertedId } = await db.collection('alertRules').insertOne({
      orgId, name: def.name, sensorKey: def.sensorKey, operator: def.operator,
      threshold: def.threshold, severity: def.severity, channels: def.channels,
      scope: def.scope, deviceId: null, isActive: true,
      cooldownS: 300, createdAt: now, updatedAt: now,
    });
    ruleMap[def.name] = insertedId;
    console.log(`✓ Created rule "${def.name}"`);
  }
} else {
  console.log(`· Alert rules already exist (${existingRules})`);
  const rules = await db.collection('alertRules').find({ orgId }).toArray();
  rules.forEach(r => { ruleMap[r.name] = r._id; });
}

// ── Alert events ──────────────────────────────────────────────────────────────
const existingEvents = await db.collection('alertEvents').countDocuments({ orgId });
if (existingEvents === 0) {
  const ruaha  = deviceMap['TRF-003']?._id;
  const ngoro  = deviceMap['TRF-007']?._id;
  const mahale = deviceMap['TRF-009']?._id;
  const kili   = deviceMap['TRF-005']?._id;
  const seren  = deviceMap['TRF-001']?._id;
  const miku   = deviceMap['TRF-002']?._id;

  const events = [
    { deviceId: ruaha,  ruleId: ruleMap['Heat — Savanna'],    message: 'Temperature exceeds 37°C', severity: 'critical', state: 'open',         triggerValue: 39.4, createdAt: hoursAgo(0.07) },
    { deviceId: ngoro,  ruleId: ruleMap['CO₂ air quality'],   message: 'CO₂ above safe range',     severity: 'critical', state: 'open',         triggerValue: 1842, createdAt: hoursAgo(0.18) },
    { deviceId: ruaha,  ruleId: ruleMap['Power health'],       message: 'Battery critically low',   severity: 'warning',  state: 'open',         triggerValue: 19,   createdAt: hoursAgo(0.64) },
    { deviceId: mahale, ruleId: ruleMap['Liveness check'],     message: 'Device offline — no data', severity: 'warning',  state: 'open',         triggerValue: 3600, createdAt: hoursAgo(2.2) },
    { deviceId: kili,   ruleId: ruleMap['Storm watch'],        message: 'Pressure dropping fast',   severity: 'info',     state: 'open',         triggerValue: 808,  createdAt: hoursAgo(3.1) },
    { deviceId: seren,  ruleId: ruleMap['Wind — Highland'],    message: 'High wind speed detected', severity: 'warning',  state: 'acknowledged', triggerValue: 15.8, createdAt: hoursAgo(5), acknowledgedAt: hoursAgo(4.5), acknowledgedBy: 'Aisha Mwamba' },
    { deviceId: miku,   ruleId: ruleMap['Humidity — Forest'],  message: 'Humidity below threshold', severity: 'info',     state: 'resolved',     triggerValue: 48,   createdAt: hoursAgo(8), resolvedAt: hoursAgo(7), resolvedBy: 'Daniel Mkongo' },
    { deviceId: ruaha,  ruleId: ruleMap['Heat — Savanna'],    message: 'Temperature exceeds 37°C', severity: 'critical', state: 'resolved',     triggerValue: 38.1, createdAt: hoursAgo(26), resolvedAt: hoursAgo(25) },
    { deviceId: ngoro,  ruleId: ruleMap['CO₂ air quality'],   message: 'CO₂ above safe range',     severity: 'critical', state: 'resolved',     triggerValue: 1670, createdAt: hoursAgo(30), resolvedAt: hoursAgo(29.5) },
  ];

  await db.collection('alertEvents').insertMany(
    events.filter(e => e.deviceId && e.ruleId).map(e => ({ ...e, orgId, updatedAt: e.resolvedAt || e.acknowledgedAt || e.createdAt })),
    { ordered: false },
  );
  console.log(`✓ Created ${events.length} alert events`);
} else {
  console.log(`· Alert events already exist (${existingEvents})`);
}

// ── Signage (ecal) data ───────────────────────────────────────────────────────
const existingEcalDevices = await db.collection('ecalDevices').countDocuments({ orgId });
if (existingEcalDevices === 0) {
  const ecalGroupRes = await db.collection('ecalGroups').insertMany([
    { orgId, name: 'Visitor Centres', description: 'Public-facing park entrance screens', createdAt: now },
    { orgId, name: 'HQ Displays',     description: 'Internal TANAPA headquarters screens',  createdAt: now },
  ]);
  const [vcGroupId, hqGroupId] = Object.values(ecalGroupRes.insertedIds);

  const ecalDevices = [
    { name: 'Serengeti VC — Main Hall', groupId: vcGroupId, resolution: '1920×1080', status: 'online', lastSeenAt: new Date() },
    { name: 'Ngorongoro VC — Entrance', groupId: vcGroupId, resolution: '1920×1080', status: 'online', lastSeenAt: new Date() },
    { name: 'HQ Lobby Display',         groupId: hqGroupId, resolution: '3840×2160', status: 'online', lastSeenAt: new Date() },
    { name: 'HQ Reception Board',       groupId: hqGroupId, resolution: '1920×1080', status: 'online', lastSeenAt: new Date() },
    { name: 'Ruaha VC — Kiosk',         groupId: vcGroupId, resolution: '1920×1080', status: 'offline', lastSeenAt: hoursAgo(2) },
  ];
  for (const d of ecalDevices) {
    const k = apiKey();
    await db.collection('ecalDevices').insertOne({ orgId, ...d, apiKeyHash: k.apiKeyHash, apiKeyPrefix: k.apiKeyPrefix, isActive: true, createdAt: now });
  }

  await db.collection('ecalContent').insertMany([
    { orgId, title: 'World Environment Day 2026',  contentType: 'announcement', body: 'Join TANAPA for conservation events June 5–11 across all parks.', durationS: 30, createdAt: now },
    { orgId, title: 'Wildebeest Migration — June', contentType: 'event',        body: 'The annual Serengeti migration arrives. Book your safari now.',   durationS: 25, createdAt: now },
    { orgId, title: 'New Camera Trap Programme',   contentType: 'news',         body: '500 new camera traps deployed across Serengeti and Ruaha.', durationS: 20, createdAt: now },
    { orgId, title: 'Park Entry — June 2026',      contentType: 'advertisement',body: 'Resident discount 20% valid through June 30. Bring your ID.', durationS: 30, createdAt: now },
    { orgId, title: 'Ranger Graduation Ceremony',  contentType: 'event',        body: 'May 28 · 14:00 · TANAPA Training Institute, Moshi.', durationS: 20, createdAt: now },
    { orgId, title: 'Q1 Wildlife Census Results',  contentType: 'news',         body: 'Elephant population up 6% vs Q4 2025.', durationS: 20, createdAt: now },
  ]);

  await db.collection('ecalCampaigns').insertMany([
    { orgId, title: 'World Environment Day 2026', type: 'announcement', status: 'live',      groupId: vcGroupId, startsAt: hoursAgo(48 * 3), endsAt: new Date(Date.now() + 14 * 86400_000), contentCount: 3, createdAt: now },
    { orgId, title: 'Migration Season 2026',      type: 'advertisement', status: 'scheduled', groupId: vcGroupId, startsAt: new Date(Date.now() + 10 * 86400_000), endsAt: new Date(Date.now() + 90 * 86400_000), contentCount: 2, createdAt: now },
    { orgId, title: 'Internal Notices — May',     type: 'news',         status: 'live',      groupId: hqGroupId, startsAt: hoursAgo(48), endsAt: new Date(Date.now() + 30 * 86400_000), contentCount: 2, createdAt: now },
    { orgId, title: 'Q2 Ranger Recruitment',      type: 'event',        status: 'draft',     groupId: hqGroupId, startsAt: null, endsAt: null, contentCount: 1, createdAt: now },
  ]);
  console.log('✓ Created signage data');
} else {
  console.log(`· Signage data already exists`);
}

console.log('\n✅ Seed complete.');
console.log('   Login: admin@tanapa.go.tz  /  Taarifa2024!');
console.log('   Also:  manager@tanapa.go.tz / viewer@tanapa.go.tz  (same password)');
await client.close();
