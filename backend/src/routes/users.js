import { col } from '../config/db.js';
import { hashPassword } from '../utils/crypto.js';
import { audit } from '../utils/audit.js';
import { authenticate } from '../middleware/auth.js';
import { ObjectId } from 'mongodb';

export default async function userRoutes(fastify) {
  const preHandler = [authenticate];
  const adminOnly = [
    async (req, reply) => { await authenticate(req, reply); },
    async (req, reply) => { if (!['super_admin','org_admin'].includes(req.user.role)) reply.forbidden(); },
  ];

  // GET /users — list users in org
  fastify.get('/', { preHandler }, async (req) => {
    const users = await col('users')
      .find({ orgId: req.user.orgId }, { projection: { passwordHash: 0 } })
      .sort({ createdAt: -1 })
      .toArray();
    return users;
  });

  // POST /users — invite/create user
  fastify.post('/', { preHandler: adminOnly }, async (req, reply) => {
    const { email, fullName, role = 'viewer', password } = req.body;
    if (!email || !fullName || !password) return reply.badRequest();

    const existing = await col('users').findOne({ email: email.toLowerCase() });
    if (existing) return reply.conflict('Email already exists');

    const now = new Date();
    const result = await col('users').insertOne({
      orgId: req.user.orgId, email: email.toLowerCase(),
      passwordHash: await hashPassword(password),
      fullName, role, locale: 'en', isActive: true,
      createdAt: now, updatedAt: now,
    });

    await audit(req, 'create_user', 'user', result.insertedId, { email, role });
    return reply.code(201).send({ id: result.insertedId });
  });

  // PATCH /users/:id
  fastify.patch('/:id', { preHandler: adminOnly }, async (req, reply) => {
    const id = new ObjectId(req.params.id);
    const { fullName, role, isActive, locale } = req.body;
    const update = {};
    if (fullName !== undefined) update.fullName = fullName;
    if (role !== undefined) update.role = role;
    if (isActive !== undefined) update.isActive = isActive;
    if (locale !== undefined) update.locale = locale;
    update.updatedAt = new Date();

    await col('users').updateOne({ _id: id, orgId: req.user.orgId }, { $set: update });
    await audit(req, 'update_user', 'user', id, update);
    return { ok: true };
  });

  // DELETE /users/:id
  fastify.delete('/:id', { preHandler: adminOnly }, async (req, reply) => {
    const id = new ObjectId(req.params.id);
    if (id.toString() === req.user._id.toString()) return reply.badRequest('Cannot delete yourself');
    await col('users').updateOne({ _id: id, orgId: req.user.orgId }, { $set: { isActive: false } });
    await audit(req, 'deactivate_user', 'user', id);
    return { ok: true };
  });

  // GET /users/me
  fastify.get('/me', { preHandler }, async (req) => {
    return { id: req.user._id, email: req.user.email, fullName: req.user.fullName, role: req.user.role, locale: req.user.locale };
  });
}
