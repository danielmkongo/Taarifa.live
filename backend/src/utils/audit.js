import { col } from '../config/db.js';

export async function audit(req, action, entityType, entityId, diff) {
  try {
    await col('auditLog').insertOne({
      orgId: req.user?.orgId,
      userId: req.user?._id,
      action,
      entityType,
      entityId,
      diff: diff || null,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      createdAt: new Date(),
    });
  } catch {
    // Never throw from audit — log silently
  }
}
