import { col } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';
import { audit } from '../utils/audit.js';
import { ObjectId } from 'mongodb';

export default async function alertRoutes(fastify) {
  const preHandler = [authenticate];

  // GET /alerts/rules
  fastify.get('/rules', { preHandler }, async (req) => {
    return col('alertRules').find({ orgId: req.user.orgId }).sort({ createdAt: -1 }).toArray();
  });

  // POST /alerts/rules
  fastify.post('/rules', { preHandler }, async (req, reply) => {
    const { name, description, deviceId, groupId, sensorKey, operator, threshold, severity, channels, webhookUrl, cooldownS, durationS } = req.body;
    if (!name || !sensorKey || !operator || threshold == null) return reply.badRequest();

    const now = new Date();
    const rule = {
      orgId: req.user.orgId,
      name, description,
      deviceId: deviceId ? new ObjectId(deviceId) : undefined,
      groupId: groupId ? new ObjectId(groupId) : undefined,
      sensorKey, operator,
      threshold: parseFloat(threshold),
      durationS: durationS || 0,
      severity: severity || 'warning',
      channels: channels || ['web'],
      webhookUrl: webhookUrl || null,
      isActive: true,
      cooldownS: cooldownS || 300,
      lastTriggeredAt: null,
      createdBy: req.user._id,
      createdAt: now, updatedAt: now,
    };

    const result = await col('alertRules').insertOne(rule);
    await audit(req, 'create_alert_rule', 'alertRule', result.insertedId);
    return reply.code(201).send({ id: result.insertedId });
  });

  // PATCH /alerts/rules/:id
  fastify.patch('/rules/:id', { preHandler }, async (req, reply) => {
    const update = { ...req.body, updatedAt: new Date() };
    delete update._id;
    await col('alertRules').updateOne(
      { _id: new ObjectId(req.params.id), orgId: req.user.orgId },
      { $set: update }
    );
    return { ok: true };
  });

  // DELETE /alerts/rules/:id
  fastify.delete('/rules/:id', { preHandler }, async (req) => {
    await col('alertRules').deleteOne({ _id: new ObjectId(req.params.id), orgId: req.user.orgId });
    return { ok: true };
  });

  // GET /alerts/events
  fastify.get('/events', { preHandler }, async (req) => {
    const { state, severity, deviceId, page = 1, limit = 50 } = req.query;
    const filter = {};

    // scope to org via devices
    const orgDeviceIds = await col('devices')
      .distinct('_id', { orgId: req.user.orgId });
    filter.deviceId = { $in: orgDeviceIds };

    if (state) filter.state = state;
    if (severity) filter.severity = severity;
    if (deviceId) filter.deviceId = new ObjectId(deviceId);

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [events, total] = await Promise.all([
      col('alertEvents').find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).toArray(),
      col('alertEvents').countDocuments(filter),
    ]);
    return { events, total };
  });

  // POST /alerts/events/:id/acknowledge
  fastify.post('/events/:id/acknowledge', { preHandler }, async (req) => {
    await col('alertEvents').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { state: 'acknowledged', acknowledgedBy: req.user._id, acknowledgedAt: new Date() } }
    );
    return { ok: true };
  });

  // POST /alerts/events/:id/resolve
  fastify.post('/events/:id/resolve', { preHandler }, async (req) => {
    await col('alertEvents').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { state: 'resolved', resolvedAt: new Date() } }
    );
    return { ok: true };
  });
}
