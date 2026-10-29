import { createApp } from '../src/app.js';
import { disconnectPrisma } from '../src/lib/prisma.js';
import { closeRedis, initRedis } from '../src/lib/redis.js';

async function main() {
  await initRedis();
  const app = createApp();
  const server = app.listen(0);

  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No port');

  const res = await fetch(`http://127.0.0.1:${address.port}/health/ready`);
  const body = await res.json();
  console.log(body);

  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await closeRedis();
  await disconnectPrisma();

  if (!res.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
