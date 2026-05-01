import { col } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';
import { generateApiKey } from '../utils/crypto.js';
import { ObjectId } from 'mongodb';

export default async function ecalRoutes(fastify) {
  const preHandler = [authenticate];

  // ── Device Groups ──────────────────────────────────────────────────────────

  fastify.get('/groups', { preHandler }, async (req) =>
    col('ecalDeviceGroups').find({ orgId: req.user.orgId }).sort({ name: 1 }).toArray()
  );

  fastify.post('/groups', { preHandler }, async (req, reply) => {
    const { name, description, timezone = 'UTC' } = req.body;
    if (!name) return reply.badRequest('name required');
    const result = await col('ecalDeviceGroups').insertOne({
      orgId: req.user.orgId, name, description, timezone, metadata: {},
      createdAt: new Date(),
    });
    return reply.code(201).send({ id: result.insertedId });
  });

  // ── Devices ────────────────────────────────────────────────────────────────

  fastify.get('/devices', { preHandler }, async (req) =>
    col('ecalDevices').find({ orgId: req.user.orgId }, { projection: { apiKeyHash: 0 } })
      .sort({ createdAt: -1 }).toArray()
  );

  fastify.post('/devices', { preHandler }, async (req, reply) => {
    const { name, location, groupId } = req.body;
    if (!name) return reply.badRequest('name required');
    const { apiKey, apiKeyPrefix, apiKeyHash } = generateApiKey();
    const result = await col('ecalDevices').insertOne({
      orgId: req.user.orgId,
      groupId: groupId ? new ObjectId(groupId) : null,
      name, location, apiKeyHash, apiKeyPrefix,
      status: 'offline', config: {}, createdAt: new Date(),
    });
    return reply.code(201).send({ id: result.insertedId, apiKey });
  });

  // ── Content ────────────────────────────────────────────────────────────────

  fastify.get('/content', { preHandler }, async (req) => {
    const { type } = req.query;
    const filter = { orgId: req.user.orgId };
    if (type) filter.type = type;
    return col('ecalContent').find(filter).sort({ createdAt: -1 }).toArray();
  });

  fastify.post('/content', { preHandler }, async (req, reply) => {
    const { type, title, body, mediaUrl, priority = 5 } = req.body;
    if (!type || !title) return reply.badRequest('type and title required');
    const now = new Date();
    const result = await col('ecalContent').insertOne({
      orgId: req.user.orgId, createdBy: req.user._id,
      type, title, body, mediaUrl, priority, isActive: true,
      createdAt: now, updatedAt: now,
    });
    return reply.code(201).send({ id: result.insertedId });
  });

  fastify.patch('/content/:id', { preHandler }, async (req, reply) => {
    const update = { ...req.body, updatedAt: new Date() };
    delete update._id;
    await col('ecalContent').updateOne(
      { _id: new ObjectId(req.params.id), orgId: req.user.orgId },
      { $set: update }
    );
    return { ok: true };
  });

  fastify.delete('/content/:id', { preHandler }, async (req) => {
    await col('ecalContent').deleteOne({ _id: new ObjectId(req.params.id), orgId: req.user.orgId });
    return { ok: true };
  });

  // ── Campaigns ──────────────────────────────────────────────────────────────

  fastify.get('/campaigns', { preHandler }, async (req) =>
    col('ecalCampaigns').find({ orgId: req.user.orgId }).sort({ startsAt: -1 }).toArray()
  );

  fastify.post('/campaigns', { preHandler }, async (req, reply) => {
    const { contentId, groupId, startsAt, endsAt, displayDurationS = 30 } = req.body;
    if (!contentId || !groupId || !startsAt || !endsAt) return reply.badRequest();
    if (new Date(endsAt) <= new Date(startsAt)) return reply.badRequest('endsAt must be after startsAt');

    const result = await col('ecalCampaigns').insertOne({
      orgId: req.user.orgId,
      contentId: new ObjectId(contentId),
      groupId: new ObjectId(groupId),
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      displayDurationS,
      createdBy: req.user._id,
      createdAt: new Date(),
    });
    return reply.code(201).send({ id: result.insertedId });
  });

  fastify.delete('/campaigns/:id', { preHandler }, async (req) => {
    await col('ecalCampaigns').deleteOne({ _id: new ObjectId(req.params.id), orgId: req.user.orgId });
    return { ok: true };
  });

  // ── Device sync endpoint (called by display devices) ──────────────────────
  fastify.get('/sync/:deviceId', async (req, reply) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) return reply.unauthorized();

    const { createHash } = await import('crypto');
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    const device = await col('ecalDevices').findOne({ apiKeyHash: keyHash });
    if (!device) return reply.unauthorized();

    await col('ecalDevices').updateOne({ _id: device._id }, { $set: { lastSeenAt: new Date(), status: 'online' } });

    const now = new Date();
    const campaigns = await col('ecalCampaigns').find({
      groupId: device.groupId,
      startsAt: { $lte: now },
      endsAt: { $gte: now },
    }).toArray();

    const contentIds = campaigns.map(c => c.contentId);
    const content = await col('ecalContent').find({
      _id: { $in: contentIds }, isActive: true
    }).toArray();

    const contentMap = Object.fromEntries(content.map(c => [c._id.toString(), c]));

    const schedule = campaigns
      .map(c => ({ campaign: c, content: contentMap[c.contentId.toString()] }))
      .filter(s => s.content)
      .sort((a, b) => a.content.priority - b.content.priority);

    return { schedule, syncedAt: now.toISOString() };
  });
}
