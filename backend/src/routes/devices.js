import { col } from '../config/db.js';
import { generateApiKey } from '../utils/crypto.js';
import { audit } from '../utils/audit.js';
import { authenticate } from '../middleware/auth.js';
import { ObjectId } from 'mongodb';

export default async function deviceRoutes(fastify) {
  const preHandler = [authenticate];

  // GET /devices
  fastify.get('/', { preHandler }, async (req) => {
    const { groupId, status, page = 1, limit = 50 } = req.query;
    const filter = { orgId: req.user.orgId };
    if (groupId) filter.groupId = new ObjectId(groupId);
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [devices, total] = await Promise.all([
      col('devices').find(filter, { projection: { apiKeyHash: 0 } })
        .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).toArray(),
      col('devices').countDocuments(filter),
    ]);
    return { devices, total, page: parseInt(page), limit: parseInt(limit) };
  });

  // GET /devices/:id
  fastify.get('/:id', { preHandler }, async (req, reply) => {
    const device = await col('devices').findOne(
      { _id: new ObjectId(req.params.id), orgId: req.user.orgId },
      { projection: { apiKeyHash: 0 } }
    );
    if (!device) return reply.notFound();
    return device;
  });

  // POST /devices — register new device
  fastify.post('/', { preHandler }, async (req, reply) => {
    const { name, description, groupId, locationName, lat, lon, altitudeM, firmwareVersion, protocol } = req.body;
    if (!name) return reply.badRequest('name is required');

    const { apiKey, apiKeyPrefix, apiKeyHash } = generateApiKey();
    const now = new Date();

    const doc = {
      orgId: req.user.orgId,
      groupId: groupId ? new ObjectId(groupId) : null,
      name, description, serialNumber: null, firmwareVersion, hardwareVersion: null,
      location: lat != null && lon != null ? { type: 'Point', coordinates: [parseFloat(lon), parseFloat(lat)] } : null,
      locationName: locationName || null,
      altitudeM: altitudeM || null,
      status: 'offline',
      lastSeenAt: null,
      batteryLevel: null,
      signalStrength: null,
      config: { sampling_interval_s: 60, upload_interval_s: 300 },
      configPending: false,
      apiKeyHash, apiKeyPrefix,
      isActive: true,
      protocol: protocol || 'http',
      createdAt: now, updatedAt: now,
    };

    const result = await col('devices').insertOne(doc);
    await audit(req, 'create_device', 'device', result.insertedId, { name });

    return reply.code(201).send({ id: result.insertedId, apiKey });
  });

  // PATCH /devices/:id
  fastify.patch('/:id', { preHandler }, async (req, reply) => {
    const { name, description, groupId, locationName, lat, lon, altitudeM, config: cfg, isActive, protocol } = req.body;
    const update = { updatedAt: new Date() };

    if (name !== undefined) update.name = name;
    if (description !== undefined) update.description = description;
    if (groupId !== undefined) update.groupId = groupId ? new ObjectId(groupId) : null;
    if (locationName !== undefined) update.locationName = locationName;
    if (lat != null && lon != null) update.location = { type: 'Point', coordinates: [parseFloat(lon), parseFloat(lat)] };
    if (altitudeM !== undefined) update.altitudeM = altitudeM;
    if (cfg !== undefined) { update.config = cfg; update.configPending = true; }
    if (isActive !== undefined) update.isActive = isActive;
    if (protocol !== undefined) update.protocol = protocol;

    await col('devices').updateOne(
      { _id: new ObjectId(req.params.id), orgId: req.user.orgId },
      { $set: update }
    );
    await audit(req, 'update_device', 'device', req.params.id, update);
    return { ok: true };
  });

  // DELETE /devices/:id
  fastify.delete('/:id', { preHandler }, async (req, reply) => {
    await col('devices').updateOne(
      { _id: new ObjectId(req.params.id), orgId: req.user.orgId },
      { $set: { isActive: false, updatedAt: new Date() } }
    );
    await audit(req, 'delete_device', 'device', req.params.id);
    return { ok: true };
  });

  // POST /devices/:id/rotate-key — regenerate API key
  fastify.post('/:id/rotate-key', { preHandler }, async (req, reply) => {
    const { apiKey, apiKeyPrefix, apiKeyHash } = generateApiKey();
    await col('devices').updateOne(
      { _id: new ObjectId(req.params.id), orgId: req.user.orgId },
      { $set: { apiKeyHash, apiKeyPrefix, updatedAt: new Date() } }
    );
    await audit(req, 'rotate_device_key', 'device', req.params.id);
    return { apiKey };
  });

  // GET /devices/groups — device groups
  fastify.get('/groups', { preHandler }, async (req) => {
    return col('deviceGroups').find({ orgId: req.user.orgId }).sort({ name: 1 }).toArray();
  });

  // POST /devices/groups
  fastify.post('/groups', { preHandler }, async (req, reply) => {
    const { name, description, metadata } = req.body;
    if (!name) return reply.badRequest('name is required');
    const now = new Date();
    const result = await col('deviceGroups').insertOne({
      orgId: req.user.orgId, name, description, metadata: metadata || {},
      createdAt: now, updatedAt: now,
    });
    return reply.code(201).send({ id: result.insertedId });
  });
}
