import 'temporal-polyfill/full/global';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { installProcessGuards, shutdownDrainMs } from './lib/process-guards.js';
import { closeRedis, initRedis, isRedisReady } from './lib/redis.js';

async function main() {
  await initRedis();
  if (env.NODE_ENV === 'production' && !isRedisReady()) {
    throw new Error('Redis must be ready before starting the API in production.');
  }
  const app = createApp();

  const server = app.listen(env.PORT, env.HOST, () => {
    console.log(`[api] listening on http://${env.HOST}:${env.PORT}`);
  });
  server.requestTimeout = env.REQUEST_TIMEOUT_MS;
  // Slightly above requestTimeout so incomplete headers are not cut mid-body.
  server.headersTimeout = env.REQUEST_TIMEOUT_MS + 5_000;

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) {
      process.exit(0);
      return;
    }
    shuttingDown = true;
    console.log(`[api] ${signal} received, shutting down`);
    // Nodemon waits until this process exits. Cleanup must not be able to hold the port.
    const forceExit = setTimeout(() => process.exit(0), shutdownDrainMs(env.NODE_ENV, 'api'));
    server.close(() => {
      void (async () => {
        try {
          const { closeJobQueue } = await import('./lib/queue/queues.js');
          const { disconnectPrisma } = await import('./lib/prisma.js');
          await closeJobQueue().catch(() => undefined);
          await closeRedis();
          await disconnectPrisma();
        } finally {
          clearTimeout(forceExit);
          process.exit(0);
        }
      })();
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  installProcessGuards('api', shutdown);
}

main().catch((err) => {
  console.error('[api] failed to start', err);
  process.exit(1);
});
