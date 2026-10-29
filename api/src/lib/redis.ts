import { Redis } from 'ioredis';
import { env } from '../config/env.js';

let client: Redis | null = null;
let ready = false;

export function isRedisReady(): boolean {
  return Boolean(client && ready && client.status === 'ready');
}

export function getRedis(): Redis {
  if (!client) {
    throw new Error('Redis has not been initialized');
  }
  return client;
}

export async function initRedis(): Promise<Redis> {
  if (client && isRedisReady()) return client;

  client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableOfflineQueue: true,
    lazyConnect: true,
  });

  client.on('ready', () => {
    ready = true;
  });
  client.on('close', () => {
    ready = false;
  });
  client.on('end', () => {
    ready = false;
  });
  client.on('error', (err: Error) => {
    ready = false;
    console.warn(`[redis] ${err.message}`);
  });

  await client.connect();
  ready = true;
  return client;
}

export async function closeRedis(): Promise<void> {
  if (!client) return;
  await client.quit();
  client = null;
  ready = false;
}
