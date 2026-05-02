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

  // GET /data/sparklines — 24h hourly per-device temperature sparklines (batch)
  fastify.get('/sparklines', { preHandler }, async (req) => {
    const sensorKey = req.query.sensorKey || 'temperature';
    const from = new Date(Date.now() - 24 * 3600_000);
    const to = new Date();
    const devices = await col('devices').find({ orgId: req.user.orgId, isActive: true }).toArray();
    if (!devices.length) return {};
    const rows = await col('sensorReadings').aggregate([
      { $match: { 'meta.deviceId': { $in: devices.map(d => d._id) }, 'meta.sensorKey': sensorKey, timestamp: { $gte: from, $lte: to } } },
      { $group: { _id: { deviceId: '$meta.deviceId', bucket: { $subtract: [{ $toLong: '$timestamp' }, { $mod: [{ $toLong: '$timestamp' }, 3_600_000] }] } }, avg: { $avg: '$value' } } },
      { $sort: { '_id.bucket': 1 } },
    ]).toArray();
    const result = {};
    rows.forEach(r => {
      const id = r._id.deviceId.toString();
      if (!result[id]) result[id] = [];
      result[id].push({ t: r._id.bucket, v: +r.avg.toFixed(2) });
    });
    return result;
  });

  // GET /data/fleet — dashboard summary: hourly activity + group temp series
  fastify.get('/fleet', { preHandler }, async (req) => {
    const from = new Date(Date.now() - 24 * 3600_000);
    const to = new Date();
    const BKT = 3_600_000;
    const devices = await col('devices').find({ orgId: req.user.orgId, isActive: true }).toArray();
    if (!devices.length) return { totalReadings: 0, hourlyActivity: [], groupSeries: [], deviceCount: 0 };
    const ids = devices.map(d => d._id);

    const [activity, tempRows] = await Promise.all([
      col('sensorReadings').aggregate([
        { $match: { 'meta.deviceId': { $in: ids }, timestamp: { $gte: from, $lte: to } } },
        { $group: { _id: { $subtract: [{ $toLong: '$timestamp' }, { $mod: [{ $toLong: '$timestamp' }, BKT] }] }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]).toArray(),
      col('sensorReadings').aggregate([
        { $match: { 'meta.deviceId': { $in: ids }, 'meta.sensorKey': 'temperature', timestamp: { $gte: from, $lte: to } } },
        { $group: { _id: { deviceId: '$meta.deviceId', bucket: { $subtract: [{ $toLong: '$timestamp' }, { $mod: [{ $toLong: '$timestamp' }, BKT] }] } }, avg: { $avg: '$value' } } },
        { $sort: { '_id.bucket': 1 } },
      ]).toArray(),
    ]);

    const groupIds = [...new Set(devices.filter(d => d.groupId).map(d => d.groupId))];
    const groupDocs = groupIds.length ? await col('deviceGroups').find({ _id: { $in: groupIds } }).toArray() : [];
    const groupNameMap = Object.fromEntries(groupDocs.map(g => [g._id.toString(), g.name]));
    const devMap = Object.fromEntries(devices.map(d => [d._id.toString(), { groupId: d.groupId?.toString() || 'unk', groupName: d.groupId ? (groupNameMap[d.groupId.toString()] || 'Other') : 'Ungrouped' }]));

    const groupBuckets = {};
    tempRows.forEach(r => {
      const { groupId, groupName } = devMap[r._id.deviceId.toString()] || { groupId: 'unk', groupName: 'Other' };
      if (!groupBuckets[groupId]) groupBuckets[groupId] = { name: groupName, b: {} };
      const b = r._id.bucket;
      if (!groupBuckets[groupId].b[b]) groupBuckets[groupId].b[b] = { s: 0, n: 0 };
      groupBuckets[groupId].b[b].s += r.avg;
      groupBuckets[groupId].b[b].n += 1;
    });

    const allBuckets = [...new Set([...activity.map(a => a._id), ...tempRows.map(r => r._id.bucket)])].sort((a, b) => a - b);
    const bIdx = Object.fromEntries(allBuckets.map((b, i) => [b, i]));
    const COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c5)', 'var(--c4)', 'var(--c6)'];
    let ci = 0;
    const groupSeries = Object.values(groupBuckets).map(({ name, b }) => ({
      name,
      color: COLORS[ci++ % COLORS.length],
      data: Object.entries(b).sort((x, y) => parseInt(x[0]) - parseInt(y[0])).map(([bk, { s, n }]) => ({
        t: bIdx[parseInt(bk)] ?? 0,
        v: +(s / n).toFixed(2),
        label: new Date(parseInt(bk)).getUTCHours() + ':00',
      })),
    }));

    const hourlyActivity = allBuckets.map((bk, i) => {
      const row = activity.find(a => a._id === bk);
      return { t: i, v: row?.count || 0, muted: i < 4 };
    });

    return { totalReadings: activity.reduce((s, a) => s + a.count, 0), hourlyActivity, groupSeries, deviceCount: devices.length };
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
