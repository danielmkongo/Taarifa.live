import path from 'path';
import fs from 'fs/promises';
import { col } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';
import { config } from '../config/index.js';
import { ObjectId } from 'mongodb';
import { stringify } from 'csv-stringify/sync';
import ExcelJS from 'exceljs';

export default async function exportRoutes(fastify) {
  const preHandler = [authenticate];

  // GET /exports/download — direct synchronous download (no job queue)
  fastify.get('/download', { preHandler }, async (req, reply) => {
    const { sensorKey, from, to, format: fmt = 'csv', deviceId } = req.query;
    if (!from || !to) return reply.badRequest('from and to required');

    const match = {
      'meta.orgId': req.user.orgId,
      timestamp: { $gte: new Date(from), $lte: new Date(to) },
    };
    if (sensorKey) match['meta.sensorKey'] = sensorKey;
    if (deviceId) {
      const device = await col('devices').findOne({ _id: new ObjectId(deviceId), orgId: req.user.orgId });
      if (!device) return reply.notFound();
      match['meta.deviceId'] = device._id;
    }

    const rows = await col('sensorReadings')
      .find(match, { projection: { timestamp: 1, 'meta.sensorKey': 1, 'meta.deviceId': 1, value: 1, quality: 1 } })
      .sort({ timestamp: 1 })
      .limit(50000)
      .toArray();

    if (fmt === 'xlsx') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Readings');
      ws.columns = [
        { header: 'Timestamp', key: 'ts' },
        { header: 'Device', key: 'device' },
        { header: 'Sensor', key: 'sensor' },
        { header: 'Value', key: 'value' },
        { header: 'Quality', key: 'quality' },
      ];
      rows.forEach(r => ws.addRow({ ts: r.timestamp, device: r.meta.deviceId.toString(), sensor: r.meta.sensorKey, value: r.value, quality: r.quality }));
      const buf = await wb.xlsx.writeBuffer();
      reply.header('Content-Disposition', 'attachment; filename="export.xlsx"');
      reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return reply.send(buf);
    } else {
      const csv = stringify(
        rows.map(r => [r.timestamp.toISOString(), r.meta.deviceId.toString(), r.meta.sensorKey, r.value, r.quality]),
        { header: true, columns: ['timestamp', 'deviceId', 'sensor', 'value', 'quality'] }
      );
      reply.header('Content-Disposition', 'attachment; filename="export.csv"');
      reply.header('Content-Type', 'text/csv');
      return reply.send(csv);
    }
  });

  // POST /exports — request export job
  fastify.post('/', { preHandler }, async (req, reply) => {
    const { format = 'csv', deviceId, sensorKey, from, to } = req.body;
    if (!deviceId || !from || !to) return reply.badRequest('deviceId, from, to required');

    const device = await col('devices').findOne({ _id: new ObjectId(deviceId), orgId: req.user.orgId });
    if (!device) return reply.notFound();

    const job = {
      orgId: req.user.orgId,
      requestedBy: req.user._id,
      format,
      filters: { deviceId: device._id, sensorKey, from, to },
      status: 'pending',
      createdAt: new Date(),
    };

    const { insertedId } = await col('exportJobs').insertOne(job);

    // Process synchronously for smaller ranges; queue for large ones
    processExport(insertedId, device, { sensorKey, from, to, format }).catch(() => {});

    return reply.code(202).send({ jobId: insertedId });
  });

  // GET /exports/:jobId
  fastify.get('/:jobId', { preHandler }, async (req, reply) => {
    const job = await col('exportJobs').findOne({
      _id: new ObjectId(req.params.jobId), orgId: req.user.orgId
    });
    if (!job) return reply.notFound();
    return job;
  });

  // GET /exports/:jobId/download
  fastify.get('/:jobId/download', { preHandler }, async (req, reply) => {
    const job = await col('exportJobs').findOne({
      _id: new ObjectId(req.params.jobId), orgId: req.user.orgId
    });
    if (!job) return reply.notFound();
    if (job.status !== 'ready' || !job.filePath) return reply.badRequest('Export not ready');

    const ext = job.format === 'excel' ? 'xlsx' : 'csv';
    const mime = job.format === 'excel'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'text/csv';

    reply.header('Content-Disposition', `attachment; filename="export.${ext}"`);
    reply.header('Content-Type', mime);
    return reply.sendFile
      ? reply.sendFile(job.filePath)
      : fs.readFile(job.filePath).then(buf => reply.send(buf));
  });
}

async function processExport(jobId, device, { sensorKey, from, to, format }) {
  await col('exportJobs').updateOne({ _id: jobId }, { $set: { status: 'processing' } });

  try {
    const match = {
      'meta.deviceId': device._id,
      timestamp: { $gte: new Date(from), $lte: new Date(to) },
    };
    if (sensorKey) match['meta.sensorKey'] = sensorKey;

    const rows = await col('sensorReadings')
      .find(match, { projection: { timestamp: 1, 'meta.sensorKey': 1, value: 1, quality: 1 } })
      .sort({ timestamp: 1 })
      .toArray();

    await fs.mkdir(config.exports.dir, { recursive: true });
    const fileName = `export_${jobId}.${format === 'excel' ? 'xlsx' : 'csv'}`;
    const filePath = path.join(config.exports.dir, fileName);

    if (format === 'excel') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Readings');
      ws.columns = [
        { header: 'Timestamp', key: 'ts' },
        { header: 'Sensor', key: 'sensor' },
        { header: 'Value', key: 'value' },
        { header: 'Quality', key: 'quality' },
      ];
      rows.forEach(r => ws.addRow({ ts: r.timestamp, sensor: r.meta.sensorKey, value: r.value, quality: r.quality }));
      await wb.xlsx.writeFile(filePath);
    } else {
      const csv = stringify(
        rows.map(r => [r.timestamp.toISOString(), r.meta.sensorKey, r.value, r.quality]),
        { header: true, columns: ['timestamp', 'sensor', 'value', 'quality'] }
      );
      await fs.writeFile(filePath, csv);
    }

    await col('exportJobs').updateOne({ _id: jobId }, {
      $set: { status: 'ready', filePath, rowCount: rows.length, completedAt: new Date() }
    });
  } catch (err) {
    await col('exportJobs').updateOne({ _id: jobId }, {
      $set: { status: 'failed', error: err.message, completedAt: new Date() }
    });
  }
}
