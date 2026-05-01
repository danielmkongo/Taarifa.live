import { config } from '../config/index.js';

export default async function wsRoutes(fastify) {
  fastify.get('/', { websocket: true }, async (connection, req) => {
    const token = req.query.token;
    if (!token) { connection.socket.close(4001, 'Unauthorized'); return; }

    let user;
    try {
      user = fastify.jwt.verify(token);
    } catch {
      connection.socket.close(4001, 'Unauthorized');
      return;
    }

    // Try Redis pub/sub — skip entirely if Redis is unavailable
    if (config.redis.url) {
      let sub;
      try {
        const { default: Redis } = await import('ioredis');
        sub = new Redis(config.redis.url, {
          enableOfflineQueue: false,
          lazyConnect: true,
          connectTimeout: 3000,
        });

        // Test connection before subscribing
        await sub.connect();
        await sub.subscribe('readings', 'alerts');

        sub.on('message', (channel, message) => {
          try {
            const data = JSON.parse(message);
            if (data.orgId?.toString() !== user.orgId?.toString()) return;
            if (connection.socket.readyState === 1) {
              connection.socket.send(JSON.stringify({ channel, data }));
            }
          } catch {}
        });

        const cleanup = () => {
          sub.unsubscribe().catch(() => {});
          sub.quit().catch(() => {});
        };
        connection.socket.on('close', cleanup);
        connection.socket.on('error', cleanup);
        return;
      } catch {
        // Redis unavailable — fall through to ping fallback
        if (sub) sub.quit().catch(() => {});
      }
    }

    // Fallback: keepalive pings so the client knows the socket is alive
    const interval = setInterval(() => {
      if (connection.socket.readyState === 1) {
        connection.socket.send(JSON.stringify({ channel: 'ping' }));
      }
    }, 25_000);

    connection.socket.on('close', () => clearInterval(interval));
    connection.socket.on('error', () => clearInterval(interval));
  });
}
