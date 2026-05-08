import { col } from '../config/db.js';
import { requireRole } from '../middleware/auth.js';
import { ObjectId } from 'mongodb';

const superOnly = [requireRole('super_admin')];

export default async function adminRoutes(fastify) {

  // GET /admin/orgs — all organizations with aggregate stats
  fastify.get('/orgs', { preHandler: superOnly }, async () => {
    const orgs = await col('organizations')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    const orgIds = orgs.map(o => o._id);

    const [deviceCounts, userCounts, screenCounts] = await Promise.all([
      col('devices').aggregate([
        { $match: { orgId: { $in: orgIds }, isActive: { $ne: false } } },
        { $group: { _id: '$orgId', total: { $sum: 1 }, online: { $sum: { $cond: [{ $eq: ['$status', 'online'] }, 1, 0] } }, alert: { $sum: { $cond: [{ $eq: ['$status', 'alert'] }, 1, 0] } } } },
      ]).toArray(),
      col('users').aggregate([
        { $match: { orgId: { $in: orgIds }, isActive: true } },
        { $group: { _id: '$orgId', count: { $sum: 1 } } },
      ]).toArray(),
      col('ecalDevices').aggregate([
        { $match: { orgId: { $in: orgIds } } },
        { $group: { _id: '$orgId', total: { $sum: 1 }, online: { $sum: { $cond: [{ $eq: ['$status', 'online'] }, 1, 0] } } } },
      ]).toArray(),
    ]);

    const devMap    = Object.fromEntries(deviceCounts.map(r => [r._id.toString(), r]));
    const userMap   = Object.fromEntries(userCounts.map(r => [r._id.toString(), r.count]));
    const screenMap = Object.fromEntries(screenCounts.map(r => [r._id.toString(), r]));

    return orgs.map(o => {
      const id  = o._id.toString();
      const dev = devMap[id]    || { total: 0, online: 0, alert: 0 };
      const scr = screenMap[id] || { total: 0, online: 0 };
      return {
        ...o,
        stats: {
          devices:       dev.total,
          devicesOnline: dev.online,
          devicesAlert:  dev.alert,
          users:         userMap[id] || 0,
          screens:       scr.total,
          screensOnline: scr.online,
        },
      };
    });
  });

  // GET /admin/fleet — all weather/IoT devices across all orgs
  fastify.get('/fleet', { preHandler: superOnly }, async (req) => {
    const { status, search, limit = 200 } = req.query;
    const filter = { isActive: { $ne: false } };
    if (status) filter.status = status;

    const devices = await col('devices')
      .find(filter, { projection: { apiKeyHash: 0 } })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .toArray();

    const orgIds = [...new Set(devices.map(d => d.orgId?.toString()).filter(Boolean))];
    const orgs   = orgIds.length
      ? await col('organizations').find({ _id: { $in: orgIds.map(id => new ObjectId(id)) } }, { projection: { name: 1 } }).toArray()
      : [];
    const orgMap = Object.fromEntries(orgs.map(o => [o._id.toString(), o.name]));

    const result = devices.map(d => ({
      ...d,
      orgName: d.orgId ? (orgMap[d.orgId.toString()] || '—') : '—',
    }));

    const q = search?.toLowerCase();
    return q
      ? result.filter(d => [d.name, d.serialNumber, d.locationName, d.orgName].some(v => v?.toLowerCase().includes(q)))
      : result;
  });

  // GET /admin/screens — all e-Calendar screens across all orgs
  fastify.get('/screens', { preHandler: superOnly }, async () => {
    const devices = await col('ecalDevices')
      .find({}, { projection: { apiKeyHash: 0 } })
      .sort({ createdAt: -1 })
      .toArray();

    const orgIds = [...new Set(devices.map(d => d.orgId?.toString()).filter(Boolean))];
    const orgs   = orgIds.length
      ? await col('organizations').find({ _id: { $in: orgIds.map(id => new ObjectId(id)) } }, { projection: { name: 1 } }).toArray()
      : [];
    const orgMap = Object.fromEntries(orgs.map(o => [o._id.toString(), o.name]));

    return devices.map(d => ({ ...d, orgName: d.orgId ? (orgMap[d.orgId.toString()] || '—') : '—' }));
  });

  // GET /admin/broadcasts — list platform-wide broadcasts
  fastify.get('/broadcasts', { preHandler: superOnly }, async () => {
    return col('ecalContent')
      .find({ isPlatformGlobal: true })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
  });

  // POST /admin/broadcast — send content to every screen on the platform
  fastify.post('/broadcast', { preHandler: superOnly }, async (req, reply) => {
    const {
      title, type, mediaUrl, body,
      priority  = 'normal',
      zone      = 'main',
      durationS = 30,
      schedule  = {},
    } = req.body;
    if (!type || !title) return reply.badRequest('type and title required');

    const now = new Date();
    const r = await col('ecalContent').insertOne({
      orgId: null,
      createdBy: req.user._id,
      isPlatformGlobal: true,
      type, title, body, mediaUrl,
      priority, zone,
      target: { scope: 'global' },
      schedule: {
        startAt: schedule.startAt ? new Date(schedule.startAt) : now,
        endAt:   schedule.endAt   ? new Date(schedule.endAt)   : null,
      },
      durationS, isActive: true, createdAt: now, updatedAt: now,
    });
    return reply.code(201).send({ id: r.insertedId });
  });

  // DELETE /admin/broadcast/:id — deactivate a platform broadcast
  fastify.delete('/broadcast/:id', { preHandler: superOnly }, async (req) => {
    await col('ecalContent').updateOne(
      { _id: new ObjectId(req.params.id), isPlatformGlobal: true },
      { $set: { isActive: false, updatedAt: new Date() } }
    );
    return { ok: true };
  });

  // GET /admin/alerts — all open alerts across all orgs
  fastify.get('/alerts', { preHandler: superOnly }, async (req) => {
    const { limit = 50, state = 'open' } = req.query;
    const events = await col('alertEvents')
      .find({ state })
      .sort({ triggeredAt: -1 })
      .limit(parseInt(limit))
      .toArray();

    const deviceIds = [...new Set(events.map(e => e.deviceId?.toString()).filter(Boolean))];
    const devices   = deviceIds.length
      ? await col('devices').find({ _id: { $in: deviceIds.map(id => new ObjectId(id)) } }, { projection: { name: 1, orgId: 1 } }).toArray()
      : [];
    const deviceMap = Object.fromEntries(devices.map(d => [d._id.toString(), d]));

    const orgIds = [...new Set(devices.map(d => d.orgId?.toString()).filter(Boolean))];
    const orgs   = orgIds.length
      ? await col('organizations').find({ _id: { $in: orgIds.map(id => new ObjectId(id)) } }, { projection: { name: 1 } }).toArray()
      : [];
    const orgMap = Object.fromEntries(orgs.map(o => [o._id.toString(), o.name]));

    return events.map(e => {
      const dev = deviceMap[e.deviceId?.toString()];
      return {
        ...e,
        deviceName: dev?.name || e.deviceName || '—',
        orgName: dev?.orgId ? (orgMap[dev.orgId.toString()] || '—') : '—',
      };
    });
  });

  // GET /admin/stats — platform-wide summary
  fastify.get('/stats', { preHandler: superOnly }, async () => {
    const [totalOrgs, totalDevices, onlineDevices, alertDevices, totalScreens, onlineScreens, activeBroadcasts] = await Promise.all([
      col('organizations').countDocuments({ isActive: { $ne: false } }),
      col('devices').countDocuments({ isActive: { $ne: false } }),
      col('devices').countDocuments({ isActive: { $ne: false }, status: 'online' }),
      col('devices').countDocuments({ isActive: { $ne: false }, status: 'alert' }),
      col('ecalDevices').countDocuments({}),
      col('ecalDevices').countDocuments({ status: 'online' }),
      col('ecalContent').countDocuments({ isPlatformGlobal: true, isActive: true }),
    ]);
    return { totalOrgs, totalDevices, onlineDevices, alertDevices, totalScreens, onlineScreens, activeBroadcasts };
  });
}
