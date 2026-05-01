import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export function generateApiKey() {
  const raw = crypto.randomBytes(32).toString('hex');
  const prefix = raw.slice(0, 8);
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { apiKey: raw, apiKeyPrefix: prefix, apiKeyHash: hash };
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}
