import cron from 'node-cron';
import { col } from '../config/db.js';

export async function startWorkers(fastify) {
  // Offline device detection — every minute
  cron.schedule('* * * * *', async () => {
    const threshold = new Date(Date.now() - 5 * 60 * 1000); // 5 min
    await col('devices').updateMany(
      { status: 'online', lastSeenAt: { $lt: threshold } },
      { $set: { status: 'offline', updatedAt: new Date() } }
    );
  });

  // Clean up expired export files — hourly
  cron.schedule('0 * * * *', async () => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const expiredJobs = await col('exportJobs')
      .find({ status: 'ready', completedAt: { $lt: cutoff } })
      .toArray();

    const { unlink } = await import('fs/promises');
    for (const job of expiredJobs) {
      try { await unlink(job.filePath); } catch {}
    }

    await col('exportJobs').deleteMany({ status: { $in: ['ready','failed'] }, completedAt: { $lt: cutoff } });
  });

  // Scheduled report runner — every 5 minutes (checks if any are due)
  cron.schedule('*/5 * * * *', async () => {
    const now = new Date();
    const due = await col('scheduledReports')
      .find({ isActive: true, nextRunAt: { $lte: now } })
      .toArray();

    for (const report of due) {
      try {
        await runScheduledReport(report);
      } catch (err) {
        fastify.log.error({ err }, `Scheduled report failed: ${report._id}`);
      }
    }
  });

  fastify.log.info('Background workers started');
}

async function runScheduledReport(report) {
  const { default: parser } = await import('cron-parser').catch(() => ({ default: null }));
  const nextRunAt = parser
    ? parser.parseExpression(report.schedule).next().toDate()
    : new Date(Date.now() + 24 * 60 * 60 * 1000);

  await col('scheduledReports').updateOne(
    { _id: report._id },
    { $set: { lastRunAt: new Date(), nextRunAt } }
  );
  // In production: enqueue export job for each recipient
}
