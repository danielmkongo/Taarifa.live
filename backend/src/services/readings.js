import { col } from '../config/db.js';
import { evaluateAlerts } from './alerts.js';

const KNOWN_SENSORS = new Set([
  'temperature','humidity','pressure','rainfall','wind_speed','wind_direction',
  'uv_index','soil_moisture','soil_temp','co2','pm25','pm10',
  'battery_voltage','solar_radiation',
]);

function normalizeReading(key, value) {
  // Celsius only — reject obvious Fahrenheit (> 80°C is likely °F)
  if (key === 'temperature' && value > 80) {
    return { value: parseFloat(((value - 32) * 5 / 9).toFixed(2)), rawValue: value };
  }
  return { value: parseFloat(value), rawValue: null };
}

export async function processReadings(device, timestamp, readings, fastify) {
  const docs = [];

  for (const r of readings) {
    const { key, value } = r;
    if (!key || value == null || !KNOWN_SENSORS.has(key)) continue;
    if (typeof value !== 'number' || !isFinite(value)) continue;

    const { value: normalized, rawValue } = normalizeReading(key, value);

    docs.push({
      timestamp,
      meta: { deviceId: device._id, orgId: device.orgId, sensorKey: key },
      value: normalized,
      ...(rawValue != null ? { rawValue } : {}),
      quality: 100,
    });
  }

  if (docs.length > 0) {
    await col('sensorReadings').insertMany(docs, { ordered: false });

    // Publish to WebSocket subscribers via Redis pub/sub
    if (fastify?.redis) {
      fastify.redis.publish('readings', JSON.stringify({
        deviceId: device._id,
        orgId: device.orgId,
        timestamp,
        readings: docs.map(d => ({ key: d.meta.sensorKey, value: d.value })),
      }));
    }

    // Trigger alert evaluation (async, non-blocking)
    evaluateAlerts(device, docs).catch(() => {});
  }
}

export async function queryReadings({ deviceId, sensorKey, from, to, granularity = 'raw', limit = 1000 }) {
  const match = {
    'meta.deviceId': deviceId,
    timestamp: { $gte: new Date(from), $lte: new Date(to) },
  };
  if (sensorKey) match['meta.sensorKey'] = sensorKey;

  if (granularity === 'raw') {
    return col('sensorReadings')
      .find(match, { projection: { _id: 0, timestamp: 1, 'meta.sensorKey': 1, value: 1 } })
      .sort({ timestamp: 1 })
      .limit(limit)
      .toArray();
  }

  // Aggregate into time buckets
  const bucketMs = granularity === 'hourly' ? 3600000 : 86400000;

  return col('sensorReadings').aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          sensorKey: '$meta.sensorKey',
          bucket: {
            $subtract: [
              { $toLong: '$timestamp' },
              { $mod: [{ $toLong: '$timestamp' }, bucketMs] },
            ],
          },
        },
        avg:   { $avg: '$value' },
        min:   { $min: '$value' },
        max:   { $max: '$value' },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.bucket': 1 } },
    { $limit: limit },
  ]).toArray();
}

export async function getLatestReadings(deviceId) {
  return col('sensorReadings').aggregate([
    { $match: { 'meta.deviceId': deviceId } },
    { $sort: { timestamp: -1 } },
    {
      $group: {
        _id: '$meta.sensorKey',
        value: { $first: '$value' },
        timestamp: { $first: '$timestamp' },
      },
    },
  ]).toArray();
}
