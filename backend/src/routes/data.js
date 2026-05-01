import { col } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';
import { queryReadings, getLatestReadings } from '../services/readings.js';
import { ObjectId } from 'mongodb';

export default async function dataRoutes(fastify) {
  const preHandler = [authenticate];

  // GET /data/readings?deviceId=&sensorKey=&from=&to=&granularity=raw|hourly|daily
  fastify.get('/readings', { preHandler }, async (req, reply) => {
    const { deviceId, sensorKey, from, to, granularity = 'raw', limit = 1000 } = req.query;
    if (!deviceId || !from || !to) return reply.badRequest('deviceId, from, to required');

    // Verify device belongs to org
    const device = await col('devices').findOne({ _id: new ObjectId(deviceId), orgId: req.user.orgId });
    if (!device) return reply.notFound('Device not found');

    const readings = await queryReadings({
      deviceId: device._id, sensorKey, from, to,
      granularity, limit: Math.min(parseInt(limit), 10000),
    });
    return readings;
  });

  // GET /data/latest/:deviceId
  fastify.get('/latest/:deviceId', { preHandler }, async (req, reply) => {
    const device = await col('devices').findOne({
      _id: new ObjectId(req.params.deviceId), orgId: req.user.orgId
    });
    if (!device) return reply.notFound();
    return getLatestReadings(device._id);
  });

  // GET /data/stats/:deviceId — summary stats for a time range
  fastify.get('/stats/:deviceId', { preHandler }, async (req, reply) => {
    const { from, to, sensorKey } = req.query;
    if (!from || !to) return reply.badRequest('from and to required');

    const device = await col('devices').findOne({
      _id: new ObjectId(req.params.deviceId), orgId: req.user.orgId
    });
    if (!device) return reply.notFound();

    const match = {
      'meta.deviceId': device._id,
      timestamp: { $gte: new Date(from), $lte: new Date(to) },
    };
    if (sensorKey) match['meta.sensorKey'] = sensorKey;

    return col('sensorReadings').aggregate([
      { $match: match },
      {
        $group: {
          _id: '$meta.sensorKey',
          avg:   { $avg: '$value' },
          min:   { $min: '$value' },
          max:   { $max: '$value' },
          count: { $sum: 1 },
          first: { $first: { timestamp: '$timestamp', value: '$value' } },
          last:  { $last: { timestamp: '$timestamp', value: '$value' } },
        },
      },
    ]).toArray();
  });

  // GET /data/map — all devices with latest readings for map view
  fastify.get('/map', { preHandler }, async (req) => {
    const devices = await col('devices')
      .find({ orgId: req.user.orgId, isActive: true, location: { $ne: null } }, {
        projection: { apiKeyHash: 0 },
      })
      .toArray();

    const results = await Promise.all(
      devices.map(async (d) => {
        const latest = await getLatestReadings(d._id);
        return { ...d, latestReadings: latest };
      })
    );
    return results;
  });
}
