import { col } from '../config/db.js';
import { sendNotification } from './notifications.js';

const OPS = {
  '>': (a, b) => a > b,
  '<': (a, b) => a < b,
  '>=': (a, b) => a >= b,
  '<=': (a, b) => a <= b,
  '=': (a, b) => a === b,
  '!=': (a, b) => a !== b,
};

export async function evaluateAlerts(device, docs) {
  const rules = await col('alertRules').find({
    orgId: device.orgId,
    isActive: true,
    $or: [
      { deviceId: device._id },
      { groupId: device.groupId },
      { deviceId: { $exists: false }, groupId: { $exists: false } },
    ],
  }).toArray();

  for (const rule of rules) {
    const reading = docs.find(d => d.meta.sensorKey === rule.sensorKey);
    if (!reading) continue;

    const op = OPS[rule.operator];
    if (!op || !op(reading.value, rule.threshold)) continue;

    // Cooldown check
    if (rule.lastTriggeredAt) {
      const cooldownMs = (rule.cooldownS || 300) * 1000;
      if (Date.now() - rule.lastTriggeredAt.getTime() < cooldownMs) continue;
    }

    const event = {
      ruleId: rule._id,
      deviceId: device._id,
      sensorKey: rule.sensorKey,
      triggerValue: reading.value,
      severity: rule.severity,
      state: 'open',
      message: `${rule.sensorKey} is ${rule.operator} ${rule.threshold} (actual: ${reading.value})`,
      createdAt: new Date(),
    };

    const { insertedId } = await col('alertEvents').insertOne(event);
    await col('alertRules').updateOne({ _id: rule._id }, { $set: { lastTriggeredAt: new Date() } });

    await sendNotification(rule, { ...event, _id: insertedId }, device);
  }
}
