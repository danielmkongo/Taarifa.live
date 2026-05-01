import { col } from '../config/db.js';
import { ObjectId } from 'mongodb';

export async function authenticate(req, reply) {
  try {
    await req.jwtVerify();
    const user = await col('users').findOne(
      { _id: new ObjectId(req.user.sub) },
      { projection: { passwordHash: 0 } }
    );
    if (!user || !user.isActive) return reply.unauthorized();
    req.user = user;
  } catch {
    return reply.unauthorized('Invalid or expired token');
  }
}

export function requireRole(...roles) {
  return async (req, reply) => {
    await authenticate(req, reply);
    if (!roles.includes(req.user.role)) {
      return reply.forbidden('Insufficient permissions');
    }
  };
}

export async function authenticateDevice(req, reply) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  if (!apiKey) return reply.unauthorized('Missing device API key');

  const prefix = apiKey.slice(0, 8);
  const device = await col('devices').findOne({ apiKeyPrefix: prefix, isActive: true });
  if (!device) return reply.unauthorized('Invalid device API key');

  const { createHash } = await import('crypto');
  const keyHash = createHash('sha256').update(apiKey).digest('hex');
  if (keyHash !== device.apiKeyHash) return reply.unauthorized('Invalid device API key');

  req.device = device;
}
