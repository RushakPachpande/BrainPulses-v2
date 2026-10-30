import { getRedis } from './redis.js';

function epochKey(userId: string): string {
  return `password:epoch:${userId}`;
}

/** Current password epoch for a user (0 when never bumped). */
export async function getPasswordEpoch(userId: string): Promise<number> {
  const raw = await getRedis().get(epochKey(userId));
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Bump the password epoch so access tokens issued earlier become invalid. */
export async function bumpPasswordEpoch(userId: string): Promise<number> {
  const next = Date.now();
  await getRedis().set(epochKey(userId), String(next));
  return next;
}
