import { MongoClient } from 'mongodb';
import { config } from './index.js';

let client;
let db;

export async function connectDB() {
  client = new MongoClient(config.mongo.url, {
    maxPoolSize: 20,
    minPoolSize: 2,
    connectTimeoutMS: 15000,
    serverSelectionTimeoutMS: 15000,
    // Atlas requires TLS — the mongodb+srv scheme enables it automatically
  });
  await client.connect();
  db = client.db(config.mongo.db);
  await ensureIndexes(db);
  return db;
}

export function getDB() {
  if (!db) throw new Error('Database not initialized — call connectDB() first');
  return db;
}

export function col(name) {
  return getDB().collection(name);
}

export async function closeDB() {
  if (client) await client.close();
}

// Creates indexes idempotently — safe to run on every startup (Atlas or local)
async function ensureIndexes(db) {
  await Promise.all([
    db.collection('organizations').createIndex({ slug: 1 }, { unique: true }),

    db.collection('users').createIndex({ email: 1 }, { unique: true }),
    db.collection('users').createIndex({ orgId: 1 }),

    db.collection('refreshTokens').createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection('refreshTokens').createIndex({ userId: 1 }),
    db.collection('refreshTokens').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),

    db.collection('devices').createIndex({ orgId: 1 }),
    db.collection('devices').createIndex({ apiKeyPrefix: 1 }),
    db.collection('devices').createIndex({ apiKeyHash: 1 }, { unique: true }),
    db.collection('devices').createIndex({ status: 1 }),
    db.collection('devices').createIndex({ location: '2dsphere' }, { sparse: true }),

    db.collection('deviceGroups').createIndex({ orgId: 1 }),

    db.collection('alertRules').createIndex({ orgId: 1 }),
    db.collection('alertRules').createIndex({ deviceId: 1 }),

    db.collection('alertEvents').createIndex({ ruleId: 1 }),
    db.collection('alertEvents').createIndex({ deviceId: 1 }),
    db.collection('alertEvents').createIndex({ state: 1 }),
    db.collection('alertEvents').createIndex({ createdAt: -1 }),

    db.collection('auditLog').createIndex({ orgId: 1, createdAt: -1 }),
    db.collection('auditLog').createIndex({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 }),

    db.collection('weatherCache').createIndex({ lat: 1, lon: 1 }, { unique: true }),
    db.collection('weatherCache').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),

    db.collection('ecalDevices').createIndex({ orgId: 1 }),
    db.collection('ecalDevices').createIndex({ apiKeyHash: 1 }, { unique: true }),
    db.collection('ecalCampaigns').createIndex({ groupId: 1, startsAt: 1, endsAt: 1 }),

    db.collection('energySystems').createIndex({ orgId: 1 }),
    db.collection('energyDevices').createIndex({ orgId: 1 }),
    db.collection('energyDevices').createIndex({ apiKeyPrefix: 1 }),
    db.collection('energyDevices').createIndex({ apiKeyHash: 1 }, { unique: true }),
    db.collection('energyDevices').createIndex({ status: 1 }),
  ]);

  // Time Series collections — create only if they don't exist
  const [sensorCols, energyCols] = await Promise.all([
    db.listCollections({ name: 'sensorReadings' }).toArray(),
    db.listCollections({ name: 'energyReadings' }).toArray(),
  ]);

  const tsOps = [];
  if (sensorCols.length === 0) {
    tsOps.push(db.createCollection('sensorReadings', {
      timeseries: { timeField: 'timestamp', metaField: 'meta', granularity: 'minutes' },
      expireAfterSeconds: 365 * 24 * 3600,
    }));
  }
  if (energyCols.length === 0) {
    tsOps.push(db.createCollection('energyReadings', {
      timeseries: { timeField: 'timestamp', metaField: 'meta', granularity: 'minutes' },
      expireAfterSeconds: 365 * 24 * 3600,
    }));
  }
  if (tsOps.length) await Promise.all(tsOps);
}
