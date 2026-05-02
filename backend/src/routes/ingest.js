import { col } from '../config/db.js';
import { authenticateDevice } from '../middleware/auth.js';
import { ObjectId } from 'mongodb';
import { processReadings } from '../services/readings.js';

function compareVersion(a, b) {
  const parse = (v) => String(v).replace(/[^0-9.]/g, '').split('.').slice(0, 3).map(n => parseInt(n, 10) || 0);
  const [aMaj, aMin, aPat] = parse(a);
  const [bMaj, bMin, bPat] = parse(b);
  if (aMaj !== bMaj) return aMaj < bMaj ? -1 : 1;
  if (aMin !== bMin) return aMin < bMin ? -1 : 1;
  if (aPat !== bPat) return aPat < bPat ? -1 : 1;
  return 0;
}

async function getFirmwareUpdate(device) {
  const active = await col('firmwareVersions').findOne({ orgId: device.orgId, isActive: true });
  if (!active) return null;
  const dv = device.firmwareVersion || null;
  if (!dv || compareVersion(dv, active.version) < 0) {
    return { version: active.version, fileUrl: active.fileUrl, protocol: active.protocol };
  }
  return null;
}

export default async function ingestRoutes(fastify) {
  const RATE_INGEST = {
    config: { rateLimit: { max: 600, timeWindow: '1 minute' } },
    preHandler: [authenticateDevice],
  };

  // POST /ingest — primary HTTP ingestion endpoint
  fastify.post('/', RATE_INGEST, async (req, reply) => {
    const { readings, timestamp, dedupId } = req.body;
    if (!readings || !Array.isArray(readings) || readings.length === 0) {
      return reply.badRequest('readings array required');
    }

    // Deduplication via Redis (skipped if Redis unavailable)
    if (dedupId && fastify.redis?.set) {
      const key = `dedup:${req.device._id}:${dedupId}`;
      const seen = await fastify.redis.set(key, 1, 'NX', 'EX', 300);
      if (!seen) return reply.code(200).send({ ok: true, duplicate: true });
    }

    const ts = timestamp ? new Date(timestamp) : new Date();
    const now = new Date();

    // Update device heartbeat
    await col('devices').updateOne(
      { _id: req.device._id },
      { $set: { lastSeenAt: now, status: 'online', updatedAt: now } }
    );

    await processReadings(req.device, ts, readings, fastify);

    const firmwareUpdate = await getFirmwareUpdate(req.device);
    const res = { ok: true, accepted: readings.length };
    if (firmwareUpdate) res.firmwareUpdate = firmwareUpdate;
    return res;
  });

  // POST /ingest/batch — store-and-forward batch
  fastify.post('/batch', RATE_INGEST, async (req, reply) => {
    const { batches } = req.body;
    if (!batches || !Array.isArray(batches)) return reply.badRequest();

    let total = 0;
    for (const batch of batches) {
      const { readings, timestamp } = batch;
      if (!readings?.length) continue;
      const ts = timestamp ? new Date(timestamp) : new Date();
      await processReadings(req.device, ts, readings, fastify);
      total += readings.length;
    }

    await col('devices').updateOne(
      { _id: req.device._id },
      { $set: { lastSeenAt: new Date(), status: 'online', updatedAt: new Date() } }
    );

    const firmwareUpdate = await getFirmwareUpdate(req.device);
    const res = { ok: true, accepted: total };
    if (firmwareUpdate) res.firmwareUpdate = firmwareUpdate;
    return res;
  });

  // GET /ingest/config — device fetches its config
  fastify.get('/config', RATE_INGEST, async (req) => {
    const device = await col('devices').findOne(
      { _id: req.device._id },
      { projection: { config: 1, configPending: 1 } }
    );
    if (device.configPending) {
      await col('devices').updateOne({ _id: device._id }, { $set: { configPending: false } });
    }
    return device.config;
  });
}
