import mqtt from 'mqtt';
import { col } from '../config/db.js';
import { config } from '../config/index.js';
import { processReadings } from '../services/readings.js';

export async function startMqttClient(fastify) {
  const client = mqtt.connect(config.mqtt.url, {
    clientId: config.mqtt.clientId,
    username: config.mqtt.username,
    password: config.mqtt.password,
    reconnectPeriod: 5000,
    connectTimeout: 15000,
    clean: true,
  });

  client.on('connect', () => {
    fastify.log.info('MQTT connected');
    client.subscribe(config.mqtt.topics.data);
    client.subscribe(config.mqtt.topics.status);
  });

  client.on('error', (err) => {
    fastify.log.error({ err }, 'MQTT error');
  });

  client.on('message', async (topic, payload) => {
    try {
      const parts = topic.split('/');
      const apiKeyPrefix = parts[1];
      const messageType = parts[2];

      const device = await col('devices').findOne({ apiKeyPrefix, isActive: true });
      if (!device) return;

      const data = JSON.parse(payload.toString());

      if (messageType === 'data') {
        const { readings, timestamp, dedupId } = data;
        if (!readings?.length) return;

        // Deduplication via Redis
        if (dedupId && fastify.redis) {
          const key = `dedup:mqtt:${device._id}:${dedupId}`;
          const seen = await fastify.redis.set(key, 1, 'NX', 'EX', 300);
          if (!seen) return;
        }

        const ts = timestamp ? new Date(timestamp) : new Date();
        await col('devices').updateOne(
          { _id: device._id },
          { $set: { lastSeenAt: new Date(), status: 'online', updatedAt: new Date() } }
        );
        await processReadings(device, ts, readings, fastify);

      } else if (messageType === 'status') {
        const update = { lastSeenAt: new Date(), updatedAt: new Date() };
        if (data.battery != null) update.batteryLevel = data.battery;
        if (data.signal != null) update.signalStrength = data.signal;
        update.status = 'online';
        await col('devices').updateOne({ _id: device._id }, { $set: update });
      }
    } catch (err) {
      fastify.log.warn({ err, topic }, 'Error processing MQTT message');
    }
  });

  // Push pending configs to devices
  client.on('connect', async () => {
    const pending = await col('devices').find({ configPending: true, isActive: true }).toArray();
    for (const device of pending) {
      const configTopic = `taarifa/${device.apiKeyPrefix}/config`;
      client.publish(configTopic, JSON.stringify(device.config), { qos: 1 });
      await col('devices').updateOne({ _id: device._id }, { $set: { configPending: false } });
    }
  });

  fastify.decorate('mqtt', client);
}
