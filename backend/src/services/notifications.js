import nodemailer from 'nodemailer';
import { col } from '../config/db.js';
import { config } from '../config/index.js';

let transporter;
function getTransporter() {
  if (!transporter && config.smtp.host) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host, port: config.smtp.port, secure: false,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
  }
  return transporter;
}

export async function sendNotification(rule, event, device) {
  const channels = rule.channels || ['web'];
  const promises = [];

  for (const channel of channels) {
    promises.push(
      dispatch(channel, rule, event, device).catch((err) => {
        col('notificationLog').insertOne({
          eventId: event._id, channel, recipient: '',
          status: 'failed', error: err.message, createdAt: new Date(),
        });
      })
    );
  }
  await Promise.allSettled(promises);
}

async function dispatch(channel, rule, event, device) {
  switch (channel) {
    case 'email':
      return sendEmail(rule, event, device);
    case 'webhook':
      return sendWebhook(rule, event, device);
    case 'web':
      // Web notifications are delivered via WebSocket — no server-side action needed
      return;
    default:
      return;
  }
}

async function sendEmail(rule, event, device) {
  const smtp = getTransporter();
  if (!smtp) return;

  // Find org admin emails
  const recipients = await col('users')
    .find({ orgId: device.orgId, role: { $in: ['org_admin', 'manager'] }, isActive: true })
    .project({ email: 1 })
    .toArray();

  const to = recipients.map(u => u.email).join(', ');
  if (!to) return;

  await smtp.sendMail({
    from: config.smtp.from,
    to,
    subject: `[${event.severity.toUpperCase()}] Taarifa Alert: ${rule.name}`,
    text: [
      `Alert: ${rule.name}`,
      `Device: ${device.name}`,
      `Sensor: ${event.sensorKey}`,
      `Value: ${event.triggerValue}`,
      `Message: ${event.message}`,
      `Time: ${event.createdAt.toISOString()}`,
      '',
      `View on Taarifa: ${config.appUrl}/alerts/${event._id}`,
    ].join('\n'),
  });

  await col('notificationLog').insertOne({
    eventId: event._id, channel: 'email', recipient: to,
    status: 'sent', sentAt: new Date(), createdAt: new Date(),
  });
}

async function sendWebhook(rule, event, device) {
  if (!rule.webhookUrl) return;

  const payload = {
    eventId: event._id,
    ruleName: rule.name,
    deviceId: device._id,
    deviceName: device.name,
    sensorKey: event.sensorKey,
    value: event.triggerValue,
    severity: event.severity,
    message: event.message,
    timestamp: event.createdAt.toISOString(),
  };

  const res = await fetch(rule.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });

  await col('notificationLog').insertOne({
    eventId: event._id, channel: 'webhook', recipient: rule.webhookUrl,
    status: res.ok ? 'sent' : 'failed',
    error: res.ok ? null : `HTTP ${res.status}`,
    sentAt: new Date(), createdAt: new Date(),
  });
}
