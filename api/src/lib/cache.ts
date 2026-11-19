import { env } from '../config/env.js';
import { getRedis, isRedisReady } from './redis.js';

export function dashboardCacheKey(organizationId: string): string {
  return `dash:summary:v2:${organizationId}`;
}

export function readCachedJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    if (!isRedisReady()) return null;
    const raw = await getRedis().get(key);
    if (!raw) return null;
    return readCachedJson<T>(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[cache] read failed', message);
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  try {
    if (!isRedisReady()) return;
    const ttl = ttlSeconds ?? env.DASHBOARD_CACHE_TTL_SECONDS;
    await getRedis().set(key, JSON.stringify(value), 'EX', ttl);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[cache] write failed', message);
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    if (!isRedisReady()) return;
    await getRedis().del(key);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[cache] delete failed', message);
  }
}

export async function invalidateDashboard(organizationId: string): Promise<void> {
  await cacheDel(dashboardCacheKey(organizationId));
}
