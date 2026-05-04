import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifySensible from '@fastify/sensible';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import fastifyWebsocket from '@fastify/websocket';

import { config } from './config/index.js';
import { connectDB } from './config/db.js';
import { authenticate as mwAuthenticate } from './middleware/auth.js';
import { startMqttClient } from './mqtt/client.js';
import { startWorkers } from './workers/index.js';

import authRoutes    from './routes/auth.js';
import userRoutes    from './routes/users.js';
import deviceRoutes  from './routes/devices.js';
import ingestRoutes  from './routes/ingest.js';
import dataRoutes    from './routes/data.js';
import alertRoutes   from './routes/alerts.js';
import exportRoutes  from './routes/exports.js';
import weatherRoutes from './routes/weather.js';
import ecalRoutes    from './routes/ecal.js';
import firmwareRoutes from './routes/firmware.js';
import energyRoutes  from './routes/energy.js';
import wsRoutes      from './routes/ws.js';

// Null-safe Redis stub — used when Redis is not configured
const noopRedis = {
  get: async () => null,
  set: async () => null,
  del: async () => null,
  publish: async () => 0,
  subscribe: async () => {},
  quit: async () => {},
};

export async function buildApp(fastify) {
  // ── Connect MongoDB Atlas ──────────────────────────────────────────────────
  await connectDB();
  fastify.log.info('MongoDB Atlas connected');

  // ── Redis (optional — rate-limit / pub-sub / dedup) ────────────────────────
  let redis = noopRedis;
  if (config.redis.url) {
    try {
      const { default: Redis } = await import('ioredis');
      const client = new Redis(config.redis.url, { lazyConnect: true, enableOfflineQueue: false });
      await client.connect();
      redis = client;
      fastify.log.info('Redis connected');
    } catch (err) {
      fastify.log.warn({ err }, 'Redis unavailable — caching and pub/sub disabled');
    }
  } else {
    fastify.log.warn('REDIS_URL not set — running without Redis');
  }
  fastify.decorate('redis', redis);

  // ── Core plugins ───────────────────────────────────────────────────────────
  await fastify.register(fastifySensible);
  await fastify.register(fastifyHelmet, { global: true });
  await fastify.register(fastifyCors, {
    origin: [
      'http://localhost:8001',
      'http://localhost:4173',
      'https://taarifa.live',
      'https://www.taarifa.live',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await fastify.register(fastifyRateLimit, {
    global: false,
    keyGenerator: (req) => req.ip,
  });

  await fastify.register(fastifyJwt, { secret: config.jwt.secret });
  await fastify.register(fastifyWebsocket);

  // ── API Docs ───────────────────────────────────────────────────────────────
  await fastify.register(fastifySwagger, {
    openapi: {
      info: { title: 'Taarifa.live API', version: '1.0.0', description: 'IoT Environmental Platform' },
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      },
      security: [{ bearerAuth: [] }],
    },
  });
  await fastify.register(fastifySwaggerUi, { routePrefix: '/docs' });

  // ── Auth decorator — fetches full DB user, sets req.user ──────────────────
  fastify.decorate('authenticate', mwAuthenticate);

  // ── Routes ─────────────────────────────────────────────────────────────────
  const prefix = '/api/v1';
  fastify.register(authRoutes,    { prefix: `${prefix}/auth` });
  fastify.register(userRoutes,    { prefix: `${prefix}/users` });
  fastify.register(deviceRoutes,  { prefix: `${prefix}/devices` });
  fastify.register(ingestRoutes,  { prefix: `${prefix}/ingest` });
  fastify.register(dataRoutes,    { prefix: `${prefix}/data` });
  fastify.register(alertRoutes,   { prefix: `${prefix}/alerts` });
  fastify.register(exportRoutes,  { prefix: `${prefix}/exports` });
  fastify.register(weatherRoutes, { prefix: `${prefix}/weather` });
  fastify.register(ecalRoutes,    { prefix: `${prefix}/ecal` });
  fastify.register(firmwareRoutes, { prefix: `${prefix}/firmware` });
  fastify.register(energyRoutes,  { prefix: `${prefix}/energy` });
  fastify.register(wsRoutes,      { prefix: '/ws' });

  fastify.get('/health', { logLevel: 'silent' }, async () => ({ status: 'ok', ts: new Date().toISOString() }));

  // ── MQTT + background workers (non-fatal if broker absent) ─────────────────
  startMqttClient(fastify).catch(err => fastify.log.warn({ err }, 'MQTT unavailable'));
  await startWorkers(fastify);

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async () => {
    await fastify.close();
    if (redis.quit) await redis.quit();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
