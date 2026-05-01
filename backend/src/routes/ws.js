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

    // If Redis is available, subscribe to pub/sub for real-time push
    if (config.redis.url) {
      let sub;
      try {
        const { default: Redis } = await import('ioredis');
        sub = new Redis(config.redis.url, { enableOfflineQueue: false });
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

        const cleanup = () => { sub.unsubscribe(); sub.quit(); };
        connection.socket.on('close', cleanup);
        connection.socket.on('error', cleanup);
        return;
      } catch {
        sub?.quit?.();
      }
    }

    // Fallback: keep socket alive with periodic pings (no push)
    const interval = setInterval(() => {
      if (connection.socket.readyState === 1) {
        connection.socket.send(JSON.stringify({ channel: 'ping' }));
      }
    }, 25_000);
    connection.socket.on('close', () => clearInterval(interval));
  });
}
