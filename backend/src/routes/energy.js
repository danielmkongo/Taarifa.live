import { col } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';
import { generateApiKey } from '../utils/crypto.js';
import { ObjectId } from 'mongodb';
import { createHash } from 'crypto';

export default async function energyRoutes(fastify) {
  const preHandler = [authenticate];

  // ─── Systems (groups of devices, e.g. a building or plant) ──────────────────

  fastify.get('/systems', { preHandler }, async (req) => {
    return col('energySystems').find({ orgId: req.user.orgId }).sort({ name: 1 }).toArray();
  });

  fastify.post('/systems', { preHandler }, async (req, reply) => {
    const { name, description, location } = req.body;
    if (!name) return reply.badRequest('name required');
    const now = new Date();
    const result = await col('energySystems').insertOne({
      orgId: req.user.orgId, name,
      description: description || '',
      location:    location    || '',
      createdAt: now, updatedAt: now,
    });
    return reply.code(201).send({ id: result.insertedId });
  });

  fastify.patch('/systems/:id', { preHandler }, async (req) => {
    const allowed = ['name', 'description', 'location'];
    const update  = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    update.updatedAt = new Date();
    await col('energySystems').updateOne({ _id: new ObjectId(req.params.id), orgId: req.user.orgId }, { $set: update });
    return { ok: true };
  });

  fastify.delete('/systems/:id', { preHandler }, async (req) => {
    await col('energySystems').deleteOne({ _id: new ObjectId(req.params.id), orgId: req.user.orgId });
    return { ok: true };
  });

  // ─── Devices ─────────────────────────────────────────────────────────────────

  fastify.get('/devices', { preHandler }, async (req) => {
    const { systemId, status, limit = 100 } = req.query;
    const query = { orgId: req.user.orgId, isActive: { $ne: false } };
    if (systemId) query.systemId = new ObjectId(systemId);
    if (status)   query.status   = status;
    const devices = await col('energyDevices')
      .find(query, { projection: { apiKeyHash: 0 } })
      .sort({ name: 1 }).limit(+limit).toArray();
    return { devices, total: devices.length };
  });

  fastify.get('/devices/:id', { preHandler }, async (req, reply) => {
    const device = await col('energyDevices').findOne(
      { _id: new ObjectId(req.params.id), orgId: req.user.orgId },
      { projection: { apiKeyHash: 0 } }
    );
    if (!device) return reply.notFound();
    return device;
  });

  fastify.post('/devices', { preHandler }, async (req, reply) => {
    const { name, description, systemId, location, protocol = 'mqtt' } = req.body;
    if (!name) return reply.badRequest('name required');
    const { apiKey, prefix, hash } = generateApiKey();
    const now = new Date();
    const result = await col('energyDevices').insertOne({
      orgId:        req.user.orgId,
      name,
      description:  description || '',
      systemId:     systemId ? new ObjectId(systemId) : null,
      location:     location    || '',
      protocol,
      apiKeyPrefix: prefix,
      apiKeyHash:   hash,
      isActive:     true,
      status:       'offline',
      lastSeenAt:   null,
      latestReading: null,
      createdAt: now, updatedAt: now,
    });
    return reply.code(201).send({ id: result.insertedId, apiKey });
  });

  fastify.patch('/devices/:id', { preHandler }, async (req) => {
    const id      = new ObjectId(req.params.id);
    const allowed = ['name', 'description', 'location', 'isActive'];
    const update  = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) update[k] = req.body[k];
    }
    if (req.body.systemId !== undefined) {
      update.systemId = req.body.systemId ? new ObjectId(req.body.systemId) : null;
    }
    update.updatedAt = new Date();
    await col('energyDevices').updateOne({ _id: id, orgId: req.user.orgId }, { $set: update });
    return { ok: true };
  });

  fastify.delete('/devices/:id', { preHandler }, async (req) => {
    await col('energyDevices').updateOne(
      { _id: new ObjectId(req.params.id), orgId: req.user.orgId },
      { $set: { isActive: false, updatedAt: new Date() } }
    );
    return { ok: true };
  });

  fastify.post('/devices/:id/rotate-key', { preHandler }, async (req) => {
    const { apiKey, prefix, hash } = generateApiKey();
    await col('energyDevices').updateOne(
      { _id: new ObjectId(req.params.id), orgId: req.user.orgId },
      { $set: { apiKeyPrefix: prefix, apiKeyHash: hash, updatedAt: new Date() } }
    );
    return { apiKey };
  });

  // ─── Ingest (device pushes readings) ─────────────────────────────────────────

  fastify.post('/ingest/:deviceId', {
    config: { rateLimit: { max: 300, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) return reply.unauthorized('Missing API key');

    const prefix = apiKey.slice(0, 8);
    const device = await col('energyDevices').findOne({ apiKeyPrefix: prefix, isActive: true });
    if (!device) return reply.unauthorized('Invalid API key');
    if (createHash('sha256').update(apiKey).digest('hex') !== device.apiKeyHash) {
      return reply.unauthorized('Invalid API key');
    }

    const { voltage, current, power, powerFactor, energy, timestamp } = req.body;
    const ts = timestamp ? new Date(timestamp) : new Date();
    const reading = {
      voltage:     voltage     != null ? +voltage     : null,
      current:     current     != null ? +current     : null,
      power:       power       != null ? +power       : null,
      powerFactor: powerFactor != null ? +powerFactor : null,
      energy:      energy      != null ? +energy      : null,
    };

    await Promise.all([
      col('energyReadings').insertOne({
        meta: { deviceId: device._id, orgId: device.orgId },
        timestamp: ts,
        ...reading,
      }),
      col('energyDevices').updateOne({ _id: device._id }, {
        $set: { status: 'online', lastSeenAt: new Date(), latestReading: { ...reading, timestamp: ts } },
      }),
    ]);

    return { ok: true };
  });

  // ─── Readings ─────────────────────────────────────────────────────────────────

  fastify.get('/readings', { preHandler }, async (req) => {
    const { deviceId, from, to, granularity = 'raw', limit = 500 } = req.query;
    if (!deviceId) return { readings: [] };

    const fromDate = from ? new Date(from) : new Date(Date.now() - 24 * 3_600_000);
    const toDate   = to   ? new Date(to)   : new Date();
    const match    = {
      'meta.deviceId': new ObjectId(deviceId),
      'meta.orgId':    req.user.orgId,
      timestamp:       { $gte: fromDate, $lte: toDate },
    };

    if (granularity === 'raw') {
      const readings = await col('energyReadings').find(match).sort({ timestamp: 1 }).limit(+limit).toArray();
      return { readings };
    }

    const bucketMs = granularity === 'daily' ? 86_400_000 : 3_600_000;
    const readings = await col('energyReadings').aggregate([
      { $match: match },
      { $group: {
        _id:         { $subtract: [{ $toLong: '$timestamp' }, { $mod: [{ $toLong: '$timestamp' }, bucketMs] }] },
        timestamp:   { $first: '$timestamp' },
        voltage:     { $avg: '$voltage' },
        current:     { $avg: '$current' },
        power:       { $avg: '$power' },
        powerFactor: { $avg: '$powerFactor' },
        energy:      { $sum: '$energy' },
        count:       { $sum: 1 },
      }},
      { $sort: { timestamp: 1 } },
      { $limit: +limit },
    ]).toArray();
    return { readings };
  });

  // ─── Latest reading for a device ─────────────────────────────────────────────

  fastify.get('/latest/:deviceId', { preHandler }, async (req, reply) => {
    const device = await col('energyDevices').findOne(
      { _id: new ObjectId(req.params.deviceId), orgId: req.user.orgId },
      { projection: { latestReading: 1, status: 1, lastSeenAt: 1, name: 1 } }
    );
    if (!device) return reply.notFound();
    return device;
  });

  // ─── Aggregated stats ─────────────────────────────────────────────────────────

  fastify.get('/stats', { preHandler }, async (req) => {
    const { deviceId, period = 'daily', days = 30 } = req.query;
    if (!deviceId) return [];

    const fromDate = new Date(Date.now() - +days * 86_400_000);
    const bucketMs = { hourly: 3_600_000, daily: 86_400_000, monthly: 30 * 86_400_000 }[period] ?? 86_400_000;

    return col('energyReadings').aggregate([
      { $match: { 'meta.deviceId': new ObjectId(deviceId), 'meta.orgId': req.user.orgId, timestamp: { $gte: fromDate } } },
      { $group: {
        _id:         { $subtract: [{ $toLong: '$timestamp' }, { $mod: [{ $toLong: '$timestamp' }, bucketMs] }] },
        timestamp:   { $first: '$timestamp' },
        avgPower:    { $avg: '$power' },
        avgVoltage:  { $avg: '$voltage' },
        avgCurrent:  { $avg: '$current' },
        avgPF:       { $avg: '$powerFactor' },
        peakPower:   { $max: '$power' },
        minVoltage:  { $min: '$voltage' },
        totalEnergy: { $sum: '$energy' },
        count:       { $sum: 1 },
      }},
      { $sort: { timestamp: 1 } },
    ]).toArray();
  });

  // ─── Fleet summary ────────────────────────────────────────────────────────────

  fastify.get('/fleet', { preHandler }, async (req) => {
    const [devices, systems] = await Promise.all([
      col('energyDevices')
        .find({ orgId: req.user.orgId, isActive: { $ne: false } }, { projection: { apiKeyHash: 0 } })
        .toArray(),
      col('energySystems').find({ orgId: req.user.orgId }).toArray(),
    ]);

    const online  = devices.filter(d => d.status === 'online').length;
    const alert   = devices.filter(d => d.status === 'alert').length;
    const offline = devices.filter(d => d.status === 'offline').length;

    const totalPower = devices.reduce((s, d) => s + (d.latestReading?.power ?? 0), 0);
    const pfDevices  = devices.filter(d => d.latestReading?.powerFactor != null);
    const avgPF      = pfDevices.length
      ? pfDevices.reduce((s, d) => s + d.latestReading.powerFactor, 0) / pfDevices.length
      : null;

    const totalEnergy = devices.reduce((s, d) => s + (d.latestReading?.energy ?? 0), 0);

    return {
      devices,
      systems,
      summary: {
        total: devices.length,
        online,
        alert,
        offline,
        totalPower:  +totalPower.toFixed(2),
        avgPF:       avgPF != null ? +avgPF.toFixed(3) : null,
        totalEnergy: +totalEnergy.toFixed(2),
      },
    };
  });
}
