import { col } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';
import { config } from '../config/index.js';

export default async function weatherRoutes(fastify) {
  const preHandler = [authenticate];

  // GET /weather?lat=&lon=
  fastify.get('/', { preHandler }, async (req, reply) => {
    const { lat, lon } = req.query;
    if (!lat || !lon) return reply.badRequest('lat and lon required');

    const latR = Math.round(parseFloat(lat) * 100) / 100;
    const lonR = Math.round(parseFloat(lon) * 100) / 100;

    const cached = await col('weatherCache').findOne({
      lat: latR, lon: lonR, expiresAt: { $gt: new Date() },
    });
    if (cached) return cached.data;

    if (!config.weather.apiKey) return reply.serviceUnavailable('Weather API not configured');

    const url = `${config.weather.apiUrl}/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${config.weather.apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return reply.badGateway('Weather API error');

    const data = await res.json();
    const expiresAt = new Date(Date.now() + config.weather.cacheTtlS * 1000);

    await col('weatherCache').updateOne(
      { lat: latR, lon: lonR },
      { $set: { lat: latR, lon: lonR, data, fetchedAt: new Date(), expiresAt } },
      { upsert: true }
    );

    return data;
  });

  // GET /weather/current?lat=&lon=
  fastify.get('/current', { preHandler }, async (req, reply) => {
    const { lat, lon } = req.query;
    if (!lat || !lon) return reply.badRequest('lat and lon required');
    if (!config.weather.apiKey) return reply.serviceUnavailable('Weather API not configured');

    const cacheKey = `weather:current:${Math.round(parseFloat(lat)*100)}:${Math.round(parseFloat(lon)*100)}`;
    const cached = await fastify.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const url = `${config.weather.apiUrl}/weather?lat=${lat}&lon=${lon}&units=metric&appid=${config.weather.apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return reply.badGateway('Weather API error');

    const data = await res.json();
    await fastify.redis.set(cacheKey, JSON.stringify(data), 'EX', 600);
    return data;
  });
}
