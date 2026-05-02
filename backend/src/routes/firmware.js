import { col } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';

/**
 * Compare two semver strings.
 * Returns -1 if a < b, 0 if a === b, 1 if a > b.
 * Non-numeric pre-release suffixes are ignored; only major.minor.patch integers
 * are compared so that e.g. "1.2.3-rc1" is treated as "1.2.3".
 */
function compareVersion(a, b) {
  const parse = (v) =>
    String(v)
      .replace(/[^0-9.]/g, '')   // strip non-numeric/non-dot chars
      .split('.')
      .slice(0, 3)
      .map((n) => parseInt(n, 10) || 0);

  const [aMaj, aMin, aPat] = parse(a);
  const [bMaj, bMin, bPat] = parse(b);

  if (aMaj !== bMaj) return aMaj < bMaj ? -1 : 1;
  if (aMin !== bMin) return aMin < bMin ? -1 : 1;
  if (aPat !== bPat) return aPat < bPat ? -1 : 1;
  return 0;
}

export default async function firmwareRoutes(fastify) {
  const preHandler = [authenticate];

  // ── GET /firmware — list all firmware versions with device counts ─────────
  fastify.get('/', { preHandler }, async (req) => {
    const orgId = req.user.orgId;

    const [versions, devices] = await Promise.all([
      col('firmwareVersions').find({ orgId }).sort({ createdAt: -1 }).toArray(),
      col('devices').find({ orgId }, { projection: { firmwareVersion: 1 } }).toArray(),
    ]);

    const active = versions.find((v) => v.isActive);

    const enriched = versions.map((v) => {
      const upToDateCount = devices.filter(
        (d) => d.firmwareVersion === v.version
      ).length;

      let needsUpdateCount = 0;
      if (v.isActive && active) {
        needsUpdateCount = devices.filter(
          (d) =>
            d.firmwareVersion &&
            compareVersion(d.firmwareVersion, active.version) < 0
        ).length;
      }

      return { ...v, upToDateCount, needsUpdateCount };
    });

    return enriched;
  });

  // ── POST /firmware — create a new firmware version ────────────────────────
  fastify.post('/', { preHandler }, async (req, reply) => {
    const { version, fileUrl, releaseNotes, protocol } = req.body;

    if (!version) return reply.badRequest('version is required');
    if (!fileUrl) return reply.badRequest('fileUrl is required');

    const validProtocols = ['http', 'mqtt'];
    const resolvedProtocol = protocol || 'http';
    if (!validProtocols.includes(resolvedProtocol)) {
      return reply.badRequest(`protocol must be one of: ${validProtocols.join(', ')}`);
    }

    const now = new Date();
    const doc = {
      orgId: req.user.orgId,
      version,
      fileUrl,
      releaseNotes: releaseNotes || null,
      protocol: resolvedProtocol,
      isActive: false,
      createdAt: now,
      updatedAt: now,
      activatedAt: null,
      createdBy: req.user._id,
    };

    const result = await col('firmwareVersions').insertOne(doc);
    return reply.code(201).send({ id: result.insertedId });
  });

  // ── PATCH /firmware/:id/activate — deactivate all, activate this one ─────
  fastify.patch('/:id/activate', { preHandler }, async (req, reply) => {
    const orgId = req.user.orgId;
    const targetId = new ObjectId(req.params.id);

    const target = await col('firmwareVersions').findOne({ _id: targetId, orgId });
    if (!target) return reply.notFound('Firmware version not found');

    const now = new Date();

    // Deactivate all versions for this org
    await col('firmwareVersions').updateMany(
      { orgId },
      { $set: { isActive: false, updatedAt: now } }
    );

    // Activate the requested version
    await col('firmwareVersions').updateOne(
      { _id: targetId },
      { $set: { isActive: true, activatedAt: now, updatedAt: now } }
    );

    return { ok: true };
  });

  // ── DELETE /firmware/:id — refuse if currently active ────────────────────
  fastify.delete('/:id', { preHandler }, async (req, reply) => {
    const orgId = req.user.orgId;
    const targetId = new ObjectId(req.params.id);

    const target = await col('firmwareVersions').findOne({ _id: targetId, orgId });
    if (!target) return reply.notFound('Firmware version not found');

    if (target.isActive) {
      return reply.badRequest('Cannot delete the active firmware version. Activate another version first.');
    }

    await col('firmwareVersions').deleteOne({ _id: targetId, orgId });
    return { ok: true };
  });

  // ── GET /firmware/check/:deviceId — public OTA check endpoint ────────────
  // Device authenticates via x-api-key header (sha256-hashed to apiKeyHash).
  fastify.get('/check/:deviceId', async (req, reply) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) return reply.unauthorized('Missing x-api-key header');

    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const device = await col('devices').findOne({
      _id: new ObjectId(req.params.deviceId),
      apiKeyHash,
      isActive: true,
    });

    if (!device) return reply.unauthorized('Invalid API key or device not found');

    // Find the currently active firmware for this device's org
    const activeFirmware = await col('firmwareVersions').findOne({
      orgId: device.orgId,
      isActive: true,
    });

    if (!activeFirmware) {
      return { updateAvailable: false };
    }

    const deviceVersion = device.firmwareVersion || null;

    // Update available when device version is behind active version
    const updateAvailable =
      !deviceVersion || compareVersion(deviceVersion, activeFirmware.version) < 0;

    if (!updateAvailable) {
      return { updateAvailable: false };
    }

    return {
      updateAvailable: true,
      version: activeFirmware.version,
      fileUrl: activeFirmware.fileUrl,
      protocol: activeFirmware.protocol,
    };
  });
}
