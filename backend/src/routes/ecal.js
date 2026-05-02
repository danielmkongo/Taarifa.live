import { col } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';
import { generateApiKey } from '../utils/crypto.js';
import { ObjectId } from 'mongodb';
import { createHash } from 'crypto';

const PRIORITY_ORDER = { critical: 0, high: 1, normal: 2, low: 3 };

function hashApiKey(key) {
  return createHash('sha256').update(key).digest('hex');
}

async function resolveDevice(apiKey) {
  if (!apiKey) return null;
  const keyHash = hashApiKey(apiKey);
  const device = await col('ecalDevices').findOne({ apiKeyHash: keyHash });
  if (!device) return null;
  await col('ecalDevices').updateOne(
    { _id: device._id },
    { $set: { lastSeenAt: new Date(), status: 'online' } }
  );
  return device;
}

async function buildFeed(device) {
  const now = new Date();
  const groupId = device.groupId;

  const targetFilter = {
    $or: [
      { 'target.scope': 'global' },
      { 'target.scope': 'group',  'target.id': groupId },
      { 'target.scope': 'device', 'target.id': device._id },
    ],
  };

  const schedFilter = {
    'schedule.startAt': { $lte: now },
    $or: [
      { 'schedule.endAt': null },
      { 'schedule.endAt': { $gte: now } },
    ],
  };

  const content = await col('ecalContent').find({
    orgId: device.orgId,
    isActive: true,
    ...targetFilter,
    ...schedFilter,
  }).toArray();

  content.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 99;
    const pb = PRIORITY_ORDER[b.priority] ?? 99;
    return pa !== pb ? pa - pb : b.createdAt - a.createdAt;
  });

  return content;
}

export default async function ecalRoutes(fastify) {
  const auth = [authenticate];

  // ── Stats ──────────────────────────────────────────────────────────────────
  fastify.get('/stats', { preHandler: auth }, async (req) => {
    const orgId = req.user.orgId;
    const now   = new Date();

    const [totalScreens, onlineScreens, activeContent, criticalContent] = await Promise.all([
      col('ecalDevices').countDocuments({ orgId }),
      col('ecalDevices').countDocuments({ orgId, status: 'online' }),
      col('ecalContent').countDocuments({
        orgId, isActive: true,
        'schedule.startAt': { $lte: now },
        $or: [{ 'schedule.endAt': null }, { 'schedule.endAt': { $gte: now } }],
      }),
      col('ecalContent').countDocuments({
        orgId, isActive: true, priority: 'critical',
        'schedule.startAt': { $lte: now },
        $or: [{ 'schedule.endAt': null }, { 'schedule.endAt': { $gte: now } }],
      }),
    ]);

    return { totalScreens, onlineScreens, activeContent, criticalContent };
  });

  // ── Device Groups ──────────────────────────────────────────────────────────
  fastify.get('/groups', { preHandler: auth }, async (req) =>
    col('ecalDeviceGroups').find({ orgId: req.user.orgId }).sort({ name: 1 }).toArray()
  );

  fastify.post('/groups', { preHandler: auth }, async (req, reply) => {
    const { name, description, timezone = 'UTC' } = req.body;
    if (!name) return reply.badRequest('name required');
    const r = await col('ecalDeviceGroups').insertOne({
      orgId: req.user.orgId, name, description, timezone,
      metadata: {}, createdAt: new Date(),
    });
    return reply.code(201).send({ id: r.insertedId });
  });

  fastify.patch('/groups/:id', { preHandler: auth }, async (req) => {
    const update = { ...req.body, updatedAt: new Date() };
    delete update._id;
    await col('ecalDeviceGroups').updateOne(
      { _id: new ObjectId(req.params.id), orgId: req.user.orgId },
      { $set: update }
    );
    return { ok: true };
  });

  fastify.delete('/groups/:id', { preHandler: auth }, async (req) => {
    await col('ecalDeviceGroups').deleteOne({ _id: new ObjectId(req.params.id), orgId: req.user.orgId });
    return { ok: true };
  });

  // ── Devices ────────────────────────────────────────────────────────────────
  fastify.get('/devices', { preHandler: auth }, async (req) => {
    const devices = await col('ecalDevices')
      .find({ orgId: req.user.orgId }, { projection: { apiKeyHash: 0 } })
      .sort({ createdAt: -1 })
      .toArray();

    const groupIds = [...new Set(devices.map(d => d.groupId?.toString()).filter(Boolean))];
    const groups   = groupIds.length
      ? await col('ecalDeviceGroups').find({ _id: { $in: groupIds.map(id => new ObjectId(id)) } }).toArray()
      : [];
    const groupMap = Object.fromEntries(groups.map(g => [g._id.toString(), g.name]));

    return devices.map(d => ({
      ...d,
      groupName: d.groupId ? (groupMap[d.groupId.toString()] || null) : null,
    }));
  });

  fastify.post('/devices', { preHandler: auth }, async (req, reply) => {
    const { name, location, groupId } = req.body;
    if (!name) return reply.badRequest('name required');
    const { apiKey, apiKeyPrefix, apiKeyHash } = generateApiKey();
    const r = await col('ecalDevices').insertOne({
      orgId: req.user.orgId,
      groupId: groupId ? new ObjectId(groupId) : null,
      name, location, apiKeyHash, apiKeyPrefix,
      status: 'offline', config: {}, createdAt: new Date(),
    });
    return reply.code(201).send({ id: r.insertedId, apiKey });
  });

  fastify.patch('/devices/:id', { preHandler: auth }, async (req) => {
    const update = { ...req.body, updatedAt: new Date() };
    delete update._id;
    if (update.groupId) update.groupId = new ObjectId(update.groupId);
    await col('ecalDevices').updateOne(
      { _id: new ObjectId(req.params.id), orgId: req.user.orgId },
      { $set: update }
    );
    return { ok: true };
  });

  fastify.delete('/devices/:id', { preHandler: auth }, async (req) => {
    await col('ecalDevices').deleteOne({ _id: new ObjectId(req.params.id), orgId: req.user.orgId });
    return { ok: true };
  });

  // ── Content ────────────────────────────────────────────────────────────────
  fastify.get('/content', { preHandler: auth }, async (req) => {
    const { type, priority, zone, active } = req.query;
    const filter = { orgId: req.user.orgId };
    if (type)     filter.type     = type;
    if (priority) filter.priority = priority;
    if (zone)     filter.zone     = zone;
    if (active !== undefined) filter.isActive = active === 'true';
    return col('ecalContent').find(filter).sort({ createdAt: -1 }).toArray();
  });

  fastify.post('/content', { preHandler: auth }, async (req, reply) => {
    const {
      type, title, body, mediaUrl,
      priority = 'normal',
      zone     = 'main',
      target   = { scope: 'global' },
      schedule = {},
      durationS = 30,
    } = req.body;
    if (!type || !title) return reply.badRequest('type and title required');

    const now = new Date();
    const targetObj = { scope: target.scope || 'global' };
    if (target.id) targetObj.id = new ObjectId(target.id);

    const r = await col('ecalContent').insertOne({
      orgId: req.user.orgId, createdBy: req.user._id,
      type, title, body, mediaUrl,
      priority, zone,
      target: targetObj,
      schedule: {
        startAt: schedule.startAt ? new Date(schedule.startAt) : now,
        endAt:   schedule.endAt   ? new Date(schedule.endAt)   : null,
      },
      durationS, isActive: true, createdAt: now, updatedAt: now,
    });
    return reply.code(201).send({ id: r.insertedId });
  });

  fastify.patch('/content/:id', { preHandler: auth }, async (req) => {
    const update = { ...req.body, updatedAt: new Date() };
    delete update._id;
    if (update.target?.id) update.target.id = new ObjectId(update.target.id);
    if (update.schedule?.startAt) update.schedule.startAt = new Date(update.schedule.startAt);
    if (update.schedule?.endAt)   update.schedule.endAt   = new Date(update.schedule.endAt);
    await col('ecalContent').updateOne(
      { _id: new ObjectId(req.params.id), orgId: req.user.orgId },
      { $set: update }
    );
    return { ok: true };
  });

  fastify.delete('/content/:id', { preHandler: auth }, async (req) => {
    await col('ecalContent').deleteOne({ _id: new ObjectId(req.params.id), orgId: req.user.orgId });
    return { ok: true };
  });

  // ── Campaigns (legacy schedule layer) ─────────────────────────────────────
  fastify.get('/campaigns', { preHandler: auth }, async (req) =>
    col('ecalCampaigns').find({ orgId: req.user.orgId }).sort({ startsAt: -1 }).toArray()
  );

  fastify.post('/campaigns', { preHandler: auth }, async (req, reply) => {
    const { contentId, groupId, startsAt, endsAt, displayDurationS = 30 } = req.body;
    if (!contentId || !startsAt || !endsAt) return reply.badRequest('contentId, startsAt, endsAt required');
    if (new Date(endsAt) <= new Date(startsAt)) return reply.badRequest('endsAt must be after startsAt');
    const r = await col('ecalCampaigns').insertOne({
      orgId: req.user.orgId,
      contentId: new ObjectId(contentId),
      groupId: groupId ? new ObjectId(groupId) : null,
      startsAt: new Date(startsAt), endsAt: new Date(endsAt),
      displayDurationS, createdBy: req.user._id, createdAt: new Date(),
    });
    return reply.code(201).send({ id: r.insertedId });
  });

  fastify.delete('/campaigns/:id', { preHandler: auth }, async (req) => {
    await col('ecalCampaigns').deleteOne({ _id: new ObjectId(req.params.id), orgId: req.user.orgId });
    return { ok: true };
  });

  // ── Device feed (called by display hardware, API key auth) ─────────────────
  fastify.get('/device/:id/feed', async (req, reply) => {
    const apiKey = req.headers['x-api-key'];
    const device = await resolveDevice(apiKey);
    if (!device || device._id.toString() !== req.params.id) return reply.unauthorized();

    const feed = await buildFeed(device);
    return { feed, syncedAt: new Date().toISOString(), deviceId: device._id };
  });

  // ── Device heartbeat (called by display hardware) ─────────────────────────
  fastify.post('/device/:id/heartbeat', async (req, reply) => {
    const apiKey = req.headers['x-api-key'];
    const device = await resolveDevice(apiKey);
    if (!device || device._id.toString() !== req.params.id) return reply.unauthorized();

    const { resolution, firmware, nowPlaying } = req.body || {};
    const update = { lastSeenAt: new Date(), status: 'online' };
    if (resolution) update.resolution = resolution;
    if (firmware)   update.firmware   = firmware;
    if (nowPlaying !== undefined) update.nowPlaying = nowPlaying;

    await col('ecalDevices').updateOne({ _id: device._id }, { $set: update });
    const feed = await buildFeed(device);
    return { ok: true, feed, syncedAt: new Date().toISOString() };
  });

  // ── Legacy sync endpoint ───────────────────────────────────────────────────
  fastify.get('/sync/:deviceId', async (req, reply) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) return reply.unauthorized();
    const device = await resolveDevice(apiKey);
    if (!device) return reply.unauthorized();

    const feed = await buildFeed(device);
    return { schedule: feed.map(c => ({ campaign: null, content: c })), syncedAt: new Date().toISOString() };
  });
}
