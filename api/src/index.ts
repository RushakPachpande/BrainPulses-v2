import 'temporal-polyfill/full/global';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { disconnectPrisma } from './lib/prisma.js';
import { closeRedis, initRedis } from './lib/redis.js';

async function main() {
  await initRedis();
  const app = createApp();

  const server = app.listen(env.PORT, env.HOST, () => {
    console.log(`[api] listening on http://${env.HOST}:${env.PORT}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[api] ${signal} received, shutting down`);
    server.close(async () => {
      await closeRedis();
      await disconnectPrisma();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[api] failed to start', err);
  process.exit(1);
});
