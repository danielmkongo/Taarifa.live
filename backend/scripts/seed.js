#!/usr/bin/env node
/**
 * Full database seed — wipes everything and creates:
 *   - Org: TANESCO
 *   - User: tanesco@taarifa.live / GECOL@2026 (org_admin)
 *   - 3 device groups (Dar es Salaam, Dodoma, Arusha)
 *   - 6 IoT devices (2 per group) with realistic sensor config
 *   - 30 days of sensor readings (temperature, humidity, pressure, rainfall)
 *   - Alert rules per device
 *   - E-Calendar seed data (groups, devices, content)
 *
 * Usage: node backend/scripts/seed.js
 */
import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const MONGO_URL = process.env.MONGO_URL;
const MONGO_DB  = process.env.MONGO_DB || 'taarifa';

if (!MONGO_URL) {
  console.error('❌  MONGO_URL env var is required');
  process.exit(1);
}

const client = new MongoClient(MONGO_URL);
await client.connect();
const db = client.db(MONGO_DB);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function apiKey() {
  const raw = crypto.randomBytes(32).toString('hex');
  return {
    apiKey:       raw,
    apiKeyPrefix: raw.slice(0, 8),
    apiKeyHash:   crypto.createHash('sha256').update(raw).digest('hex'),
  };
}

function sensor(t, cfg, key) {
  const ms   = t.getTime();
  const hour = t.getUTCHours() + t.getUTCMinutes() / 60;
  const day  = Math.sin(((hour - 14) / 24) * 2 * Math.PI - Math.PI / 2); // peaks ~14:00
  const slow = Math.sin(ms / (48 * 3600 * 1000) * 2 * Math.PI);           // 2-day pattern
  const hf   = Math.sin(ms / 600_000 * 1.73) * 0.3 + Math.sin(ms / 900_000 * 2.41) * 0.2;

  switch (key) {
    case 'temperature': {
      const v = cfg.tempBase + day * cfg.tempRange * 0.5 + slow * 2 + hf * 0.8;
      return +Math.max(5, Math.min(45, v)).toFixed(2);
    }
    case 'humidity': {
      const v = cfg.humBase - day * cfg.humRange * 0.4 + slow * (-4) + hf * 2;
      return +Math.max(10, Math.min(100, v)).toFixed(1);
    }
    case 'pressure': {
      const v = cfg.pressBase + slow * 3 + hf * 0.5;
      return +Math.max(600, Math.min(1060, v)).toFixed(1);
    }
    case 'rainfall': {
      const sig = Math.sin(ms / 7_200_000 * 4.7) + Math.sin(ms / 3_600_000 * 3.1);
      return sig > 1.5 ? +((sig - 1.5) * 12 * Math.max(0, hf)).toFixed(2) : 0;
    }
    default:
      return 0;
  }
}

// ─── Wipe existing data ───────────────────────────────────────────────────────
console.log('🗑️  Wiping existing data…');
await Promise.all([
  db.collection('users').deleteMany({}),
  db.collection('organizations').deleteMany({}),
  db.collection('refreshTokens').deleteMany({}),
  db.collection('devices').deleteMany({}),
  db.collection('deviceGroups').deleteMany({}),
  db.collection('alertRules').deleteMany({}),
  db.collection('alertEvents').deleteMany({}),
  db.collection('firmware').deleteMany({}),
  db.collection('ecalDevices').deleteMany({}),
  db.collection('ecalDeviceGroups').deleteMany({}),
  db.collection('ecalContent').deleteMany({}),
  db.collection('ecalCampaigns').deleteMany({}),
  db.collection('auditLog').deleteMany({}),
  db.collection('weatherCache').deleteMany({}),
]);

try { await db.collection('sensorReadings').drop(); } catch {}
await db.createCollection('sensorReadings', {
  timeseries: { timeField: 'timestamp', metaField: 'meta', granularity: 'minutes' },
  expireAfterSeconds: 365 * 24 * 3600,
});

// ─── Organisation ─────────────────────────────────────────────────────────────
console.log('🏢 Creating organisation TANESCO…');
const now = new Date();
const { insertedId: orgId } = await db.collection('organizations').insertOne({
  name: 'TANESCO', slug: 'tanesco', plan: 'enterprise',
  isActive: true, settings: {}, createdAt: now, updatedAt: now,
});

// ─── User ─────────────────────────────────────────────────────────────────────
console.log('👤 Creating user tanesco@taarifa.live…');
const { insertedId: userId } = await db.collection('users').insertOne({
  orgId,
  email:        'tanesco@taarifa.live',
  passwordHash: await bcrypt.hash('GECOL@2026', 12),
  fullName:     'TANESCO Admin',
  role:         'org_admin',
  locale:       'en',
  isActive:     true,
  createdAt:    now,
  updatedAt:    now,
});

// ─── Device groups ────────────────────────────────────────────────────────────
console.log('📍 Creating device groups…');
const [gDSM, gDOD, gARU] = await Promise.all([
  db.collection('deviceGroups').insertOne({ orgId, name: 'Dar es Salaam', description: 'Coastal monitoring stations', timezone: 'Africa/Dar_es_Salaam', metadata: {}, createdAt: now }),
  db.collection('deviceGroups').insertOne({ orgId, name: 'Dodoma',        description: 'Central plateau stations',   timezone: 'Africa/Dar_es_Salaam', metadata: {}, createdAt: now }),
  db.collection('deviceGroups').insertOne({ orgId, name: 'Arusha',        description: 'Northern highland stations', timezone: 'Africa/Dar_es_Salaam', metadata: {}, createdAt: now }),
]).then(rs => rs.map(r => r.insertedId));

// ─── IoT devices ──────────────────────────────────────────────────────────────
console.log('📡 Creating 6 IoT devices…');
const SENSORS = [
  { key: 'temperature', unit: '°C',   label: 'Temperature' },
  { key: 'humidity',    unit: '%',    label: 'Relative Humidity' },
  { key: 'pressure',    unit: 'hPa',  label: 'Atmospheric Pressure' },
  { key: 'rainfall',    unit: 'mm/h', label: 'Rainfall' },
];

const deviceDefs = [
  { groupId: gDSM, name: 'DSM-Station-01', serialNumber: 'TRF-DSM-001', address: 'Kinondoni, Dar es Salaam',    coordinates: [39.2083, -6.7924], tempBase: 28, tempRange: 4, humBase: 78, humRange: 15, pressBase: 1013 },
  { groupId: gDSM, name: 'DSM-Station-02', serialNumber: 'TRF-DSM-002', address: 'Temeke, Dar es Salaam',       coordinates: [39.2794, -6.8160], tempBase: 27, tempRange: 4, humBase: 82, humRange: 12, pressBase: 1014 },
  { groupId: gDOD, name: 'DOD-Station-01', serialNumber: 'TRF-DOD-001', address: 'Dodoma City Centre',          coordinates: [35.7395, -6.1722], tempBase: 25, tempRange: 8, humBase: 48, humRange: 20, pressBase:  965 },
  { groupId: gDOD, name: 'DOD-Station-02', serialNumber: 'TRF-DOD-002', address: 'Ihumwa, Dodoma',              coordinates: [35.8012, -6.2100], tempBase: 26, tempRange: 9, humBase: 45, humRange: 22, pressBase:  963 },
  { groupId: gARU, name: 'ARU-Station-01', serialNumber: 'TRF-ARU-001', address: 'Arusha City Centre',          coordinates: [36.6869, -3.3869], tempBase: 20, tempRange: 6, humBase: 68, humRange: 18, pressBase:  860 },
  { groupId: gARU, name: 'ARU-Station-02', serialNumber: 'TRF-ARU-002', address: 'Njiro, Arusha',               coordinates: [36.7200, -3.4100], tempBase: 19, tempRange: 7, humBase: 72, humRange: 16, pressBase:  858 },
];

const deviceRecords = [];
const apiKeys = [];

for (const def of deviceDefs) {
  const { tempBase, tempRange, humBase, humRange, pressBase, coordinates, address, ...base } = def;
  const keys = apiKey();
  apiKeys.push({ name: base.name, key: keys.apiKey });
  const r = await db.collection('devices').insertOne({
    orgId, ...base,
    location: { type: 'Point', coordinates },
    address,
    apiKeyHash:   keys.apiKeyHash,
    apiKeyPrefix: keys.apiKeyPrefix,
    status:       'online',
    firmware:     '1.2.0',
    firmwareVersion: '1.2.0',
    protocol:     'http',
    sensors:      SENSORS,
    metadata:     {},
    isActive:     true,
    lastSeenAt:   new Date(Date.now() - Math.random() * 300_000),
    createdAt:    now,
    updatedAt:    now,
  });
  deviceRecords.push({ id: r.insertedId, tempBase, tempRange, humBase, humRange, pressBase });
}

// ─── Sensor readings (30 days × 4 sensors × 6 devices @ 15-min intervals) ───
const DAYS         = 30;
const INTERVAL_MIN = 15;
const START        = new Date(Date.now() - DAYS * 24 * 3600 * 1000);
const STEPS        = (DAYS * 24 * 60) / INTERVAL_MIN;
const TOTAL        = deviceRecords.length * SENSORS.length * STEPS;

console.log(`📊 Generating ${TOTAL.toLocaleString()} sensor readings (${DAYS} days @ ${INTERVAL_MIN}-min intervals)…`);

const BATCH = 5000;
let buf = [], inserted = 0;

for (const dev of deviceRecords) {
  for (let step = 0; step < STEPS; step++) {
    const ts = new Date(START.getTime() + step * INTERVAL_MIN * 60_000);
    for (const { key } of SENSORS) {
      buf.push({ timestamp: ts, meta: { deviceId: dev.id, sensorKey: key }, value: sensor(ts, dev, key) });
      if (buf.length >= BATCH) {
        await db.collection('sensorReadings').insertMany(buf, { ordered: false });
        inserted += buf.length;
        buf = [];
        process.stdout.write(`\r   ${inserted.toLocaleString()} / ${TOTAL.toLocaleString()}`);
      }
    }
  }
}
if (buf.length) {
  await db.collection('sensorReadings').insertMany(buf, { ordered: false });
  inserted += buf.length;
}
console.log(`\r   ${inserted.toLocaleString()} readings inserted ✓           `);

// ─── Alert rules ──────────────────────────────────────────────────────────────
console.log('🔔 Creating alert rules…');
for (const { id: deviceId } of deviceRecords) {
  await db.collection('alertRules').insertMany([
    { orgId, deviceId, name: 'High Temperature Alert', sensorKey: 'temperature', condition: 'gt', threshold: 35, severity: 'warning',  isActive: true, createdAt: now },
    { orgId, deviceId, name: 'Low Humidity Alert',     sensorKey: 'humidity',    condition: 'lt', threshold: 20, severity: 'warning',  isActive: true, createdAt: now },
    { orgId, deviceId, name: 'Heavy Rainfall Alert',   sensorKey: 'rainfall',    condition: 'gt', threshold: 10, severity: 'info',     isActive: true, createdAt: now },
  ]);
}

// ─── E-Calendar ───────────────────────────────────────────────────────────────
console.log('📺 Seeding E-Calendar data…');

const { insertedId: ecalGroupId } = await db.collection('ecalDeviceGroups').insertOne({
  orgId, name: 'TANESCO HQ Displays',
  description: 'Office lobby, corridor, and meeting room displays',
  timezone: 'Africa/Dar_es_Salaam', metadata: {}, createdAt: now,
});

for (const def of [
  { name: 'Lobby Display A',    location: 'Main Lobby — Dar es Salaam HQ' },
  { name: 'Corridor Display B', location: 'Level 3 Corridor' },
  { name: 'Boardroom Display',  location: 'Boardroom C' },
]) {
  const k = apiKey();
  await db.collection('ecalDevices').insertOne({
    orgId, groupId: ecalGroupId, ...def,
    apiKeyHash: k.apiKeyHash, apiKeyPrefix: k.apiKeyPrefix,
    status: 'offline', config: {}, createdAt: now,
  });
}

const sched = (start, end = null) => ({ startAt: new Date(start), endAt: end ? new Date(end) : null });

await db.collection('ecalContent').insertMany([
  {
    orgId, createdBy: userId,
    type: 'emergency', priority: 'critical',
    title: 'CRITICAL: Grid Overload — Zone 4',
    body: 'Emergency load shedding is in effect for Zone 4 (Kinondoni). Estimated restoration: 4 hours. Crews are on site.',
    zone: 'main', target: { scope: 'global' },
    schedule: sched('2026-05-02', '2026-05-02T23:59:00'),
    durationS: 15, isActive: true, createdAt: now, updatedAt: now,
  },
  {
    orgId, createdBy: userId,
    type: 'announcement', priority: 'high',
    title: 'Scheduled Maintenance — Sunday 4 May',
    body: 'Planned maintenance from 02:00–06:00 EAT. Affected areas: Dodoma North, Arusha East. Customers are advised to plan accordingly.',
    zone: 'main', target: { scope: 'global' },
    schedule: sched('2026-05-01', '2026-05-04T06:00:00'),
    durationS: 30, isActive: true, createdAt: now, updatedAt: now,
  },
  {
    orgId, createdBy: userId,
    type: 'news', priority: 'normal',
    title: 'TANESCO Reaches 3 Million Connected Customers',
    body: 'Tanzania\'s national utility celebrates a milestone as electrification reaches 45% of households nationally.',
    zone: 'main', target: { scope: 'global' },
    schedule: sched('2026-04-15', '2026-05-31'),
    durationS: 25, isActive: true, createdAt: now, updatedAt: now,
  },
  {
    orgId, createdBy: userId,
    type: 'event', priority: 'normal',
    title: 'World Environment Day — 5 June 2026',
    body: 'TANESCO commits to 60% renewable energy by 2030. Solar, wind, and hydro investments are transforming Tanzania\'s energy future.',
    zone: 'main', target: { scope: 'global' },
    schedule: sched('2026-05-20', '2026-06-07'),
    durationS: 25, isActive: true, createdAt: now, updatedAt: now,
  },
  {
    orgId, createdBy: userId,
    type: 'advertisement', priority: 'low',
    title: 'Pay Your Bill Online — Fast & Easy',
    body: 'Pay via M-Pesa, Tigo Pesa, Airtel Money, or the TANESCO self-service portal. Available 24/7.',
    zone: 'footer', target: { scope: 'global' },
    schedule: sched('2026-01-01'),
    durationS: 20, isActive: true, createdAt: now, updatedAt: now,
  },
  {
    orgId, createdBy: userId,
    type: 'announcement', priority: 'normal',
    title: 'New Customer Care Centre Opens in Arusha',
    body: 'A new fully-equipped customer service centre is now open at Njiro Road, Arusha. Hours: Mon–Fri 08:00–17:00.',
    zone: 'main', target: { scope: 'group', id: ecalGroupId },
    schedule: sched('2026-05-01', '2026-06-01'),
    durationS: 20, isActive: true, createdAt: now, updatedAt: now,
  },
]);

// ─── Done ─────────────────────────────────────────────────────────────────────
console.log('\n✅ Seed complete!\n');
console.log(`   Org:       TANESCO (${orgId})`);
console.log(`   Email:     tanesco@taarifa.live`);
console.log(`   Password:  GECOL@2026`);
console.log(`   Devices:   ${deviceRecords.length} IoT stations`);
console.log(`   Readings:  ${inserted.toLocaleString()}`);
console.log('\n   IoT device API keys (store securely):');
for (const { name, key } of apiKeys) {
  console.log(`     ${name.padEnd(20)} ${key}`);
}
console.log('');

await client.close();
