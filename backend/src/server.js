import Fastify from 'fastify';
import { config } from './config/index.js';
import { buildApp } from './app.js';

const logger = {
  level: config.env === 'production' ? 'info' : 'debug',
};

async function start() {
  const fastify = Fastify({ logger, trustProxy: true });

  await buildApp(fastify);

  await fastify.listen({ port: config.port, host: '0.0.0.0' });
  fastify.log.info(`Taarifa.live backend running on port ${config.port}`);
}

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
