import { col } from '../config/db.js';
import { hashPassword, verifyPassword, hashToken, randomToken } from '../utils/crypto.js';
import { audit } from '../utils/audit.js';
import { config } from '../config/index.js';
import { addDays } from 'date-fns';

export default async function authRoutes(fastify) {
  const RATE_AUTH = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

  // POST /auth/register
  fastify.post('/register', RATE_AUTH, async (req, reply) => {
    const { email, password, fullName, orgName } = req.body;
    if (!email || !password || !fullName || !orgName) {
      return reply.badRequest('email, password, fullName, orgName are required');
    }

    const existing = await col('users').findOne({ email: email.toLowerCase() });
    if (existing) return reply.conflict('Email already registered');

    // Create org + user atomically (best effort with MongoDB)
    const now = new Date();
    const slug = orgName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const orgResult = await col('organizations').insertOne({
      name: orgName, slug, plan: 'free', isActive: true,
      settings: {}, createdAt: now, updatedAt: now,
    });

    const passwordHash = await hashPassword(password);
    const userResult = await col('users').insertOne({
      orgId: orgResult.insertedId, email: email.toLowerCase(),
      passwordHash, fullName, role: 'org_admin',
      locale: 'en', isActive: true, createdAt: now, updatedAt: now,
    });

    const token = fastify.jwt.sign(
      { sub: userResult.insertedId.toString(), orgId: orgResult.insertedId.toString(), role: 'org_admin' },
      { expiresIn: config.jwt.expiresIn }
    );

    return reply.code(201).send({ token });
  });

  // POST /auth/login
  fastify.post('/login', RATE_AUTH, async (req, reply) => {
    const { email, password } = req.body;
    if (!email || !password) return reply.badRequest('email and password required');

    const user = await col('users').findOne({ email: email.toLowerCase() });
    if (!user || !user.isActive) return reply.unauthorized('Invalid credentials');

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return reply.unauthorized('Invalid credentials');

    await col('users').updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

    const token = fastify.jwt.sign(
      { sub: user._id.toString(), orgId: user.orgId.toString(), role: user.role },
      { expiresIn: config.jwt.expiresIn }
    );

    const refreshRaw = randomToken();
    const refreshHash = hashToken(refreshRaw);
    await col('refreshTokens').insertOne({
      userId: user._id,
      tokenHash: refreshHash,
      expiresAt: addDays(new Date(), 30),
      createdAt: new Date(),
    });

    await audit(req, 'login', 'user', user._id);

    return {
      token,
      refreshToken: refreshRaw,
      user: { id: user._id, email: user.email, fullName: user.fullName, role: user.role, orgId: user.orgId },
    };
  });

  // POST /auth/refresh
  fastify.post('/refresh', async (req, reply) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return reply.badRequest('refreshToken required');

    const tokenHash = hashToken(refreshToken);
    const stored = await col('refreshTokens').findOne({ tokenHash });
    if (!stored || stored.expiresAt < new Date()) return reply.unauthorized('Invalid or expired refresh token');

    const user = await col('users').findOne({ _id: stored.userId });
    if (!user || !user.isActive) return reply.unauthorized();

    const token = fastify.jwt.sign(
      { sub: user._id.toString(), orgId: user.orgId.toString(), role: user.role },
      { expiresIn: config.jwt.expiresIn }
    );

    return { token };
  });

  // POST /auth/logout
  fastify.post('/logout', async (req, reply) => {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await col('refreshTokens').deleteOne({ tokenHash: hashToken(refreshToken) });
    }
    return { ok: true };
  });

  // POST /auth/change-password
  fastify.post('/change-password', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return reply.badRequest();

    const user = await col('users').findOne({ _id: req.user._id });
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) return reply.badRequest('Current password incorrect');

    const passwordHash = await hashPassword(newPassword);
    await col('users').updateOne({ _id: user._id }, { $set: { passwordHash, updatedAt: new Date() } });
    await col('refreshTokens').deleteMany({ userId: user._id });

    return { ok: true };
  });
}
