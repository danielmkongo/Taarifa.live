// MongoDB initialization script — runs once on first container start
// Creates collections, indexes, and Time Series collection for sensor readings

const db = db.getSiblingDB(process.env.MONGO_INITDB_DATABASE || 'taarifa');

// ── Time Series collection for sensor readings ─────────────────────────────
db.createCollection('sensorReadings', {
  timeseries: {
    timeField:   'timestamp',
    metaField:   'meta',
    granularity: 'minutes',
  },
  expireAfterSeconds: 365 * 24 * 3600,  // 1 year TTL on raw data
});

// ── Regular collections with validators ───────────────────────────────────
db.createCollection('organizations');
db.createCollection('users');
db.createCollection('refreshTokens');
db.createCollection('devices');
db.createCollection('deviceGroups');
db.createCollection('alertRules');
db.createCollection('alertEvents');
db.createCollection('notificationLog');
db.createCollection('auditLog');
db.createCollection('weatherCache');
db.createCollection('scheduledReports');
db.createCollection('exportJobs');
db.createCollection('ecalDeviceGroups');
db.createCollection('ecalDevices');
db.createCollection('ecalContent');
db.createCollection('ecalCampaigns');

// ── Indexes ────────────────────────────────────────────────────────────────
db.organizations.createIndex({ slug: 1 }, { unique: true });

db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ orgId: 1 });

db.refreshTokens.createIndex({ tokenHash: 1 }, { unique: true });
db.refreshTokens.createIndex({ userId: 1 });
db.refreshTokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

db.devices.createIndex({ orgId: 1 });
db.devices.createIndex({ groupId: 1 });
db.devices.createIndex({ apiKeyPrefix: 1 });
db.devices.createIndex({ apiKeyHash: 1 }, { unique: true });
db.devices.createIndex({ status: 1 });
db.devices.createIndex({ location: '2dsphere' });

db.deviceGroups.createIndex({ orgId: 1 });

db.alertRules.createIndex({ orgId: 1 });
db.alertRules.createIndex({ deviceId: 1 });

db.alertEvents.createIndex({ ruleId: 1 });
db.alertEvents.createIndex({ deviceId: 1 });
db.alertEvents.createIndex({ state: 1 });
db.alertEvents.createIndex({ createdAt: -1 });

db.auditLog.createIndex({ orgId: 1, createdAt: -1 });
db.auditLog.createIndex({ userId: 1, createdAt: -1 });
db.auditLog.createIndex({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 }); // 90 days

db.weatherCache.createIndex({ lat: 1, lon: 1 }, { unique: true });
db.weatherCache.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

db.ecalDevices.createIndex({ orgId: 1 });
db.ecalDevices.createIndex({ groupId: 1 });
db.ecalDevices.createIndex({ apiKeyHash: 1 }, { unique: true });

db.ecalCampaigns.createIndex({ groupId: 1, startsAt: 1, endsAt: 1 });

// ── Seed: default super-admin organization ─────────────────────────────────
db.organizations.insertOne({
  _id: 'taarifa-platform',
  name: 'Taarifa Platform',
  slug: 'taarifa',
  plan: 'enterprise',
  isActive: true,
  settings: {},
  createdAt: new Date(),
  updatedAt: new Date(),
});

print('Taarifa MongoDB initialization complete.');
