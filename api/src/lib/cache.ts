import { env } from '../config/env.js';
import { getRedis, isRedisReady } from './redis.js';

export function dashboardCacheKey(organizationId: string): string {
  return `dash:summary:${organizationId}`;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isRedisReady()) return null;
  const raw = await getRedis().get(key);
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

export async function cacheSet(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  if (!isRedisReady()) return;
  const ttl = ttlSeconds ?? env.DASHBOARD_CACHE_TTL_SECONDS;
  await getRedis().set(key, JSON.stringify(value), 'EX', ttl);
}

export async function cacheDel(key: string): Promise<void> {
  if (!isRedisReady()) return;
  await getRedis().del(key);
}

export async function invalidateDashboard(organizationId: string): Promise<void> {
  await cacheDel(dashboardCacheKey(organizationId));
}
