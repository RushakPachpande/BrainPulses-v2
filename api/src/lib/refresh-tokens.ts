import { createHash, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import { getRedis } from './redis.js';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function familyKey(familyId: string): string {
  return `refresh:family:${familyId}`;
}

function tokenKey(tokenHash: string): string {
  return `refresh:token:${tokenHash}`;
}

function userFamiliesKey(userId: string): string {
  return `refresh:user:${userId}`;
}

const tokenFamilyIndex = (tokenHash: string) => `refresh:idx:${tokenHash}`;

export type RefreshSession = {
  userId: string;
  organizationId: string;
  membershipId: string;
  familyId: string;
};

export async function issueRefreshToken(session: RefreshSession): Promise<string> {
  const redis = getRedis();
  const raw = randomBytes(48).toString('base64url');
  const tokenHash = hashToken(raw);
  const ttl = env.REFRESH_TOKEN_TTL_SECONDS;

  await redis.set(tokenKey(tokenHash), JSON.stringify(session), 'EX', ttl);
  await redis.sadd(familyKey(session.familyId), tokenHash);
  await redis.expire(familyKey(session.familyId), ttl);
  await redis.set(tokenFamilyIndex(tokenHash), session.familyId, 'EX', ttl);
  await redis.sadd(userFamiliesKey(session.userId), session.familyId);
  await redis.expire(userFamiliesKey(session.userId), ttl);

  return raw;
}

export async function rotateRefreshToken(
  rawToken: string,
): Promise<{ session: RefreshSession; nextToken: string } | null> {
  const redis = getRedis();
  const tokenHash = hashToken(rawToken);
  const key = tokenKey(tokenHash);
  // Atomic consume so only one concurrent rotator receives the payload.
  const payload = await redis.getdel(key);

  if (!payload) {
    // Reuse of a rotated token: revoke the whole family if we still know it.
    const familyId = await redis.get(tokenFamilyIndex(tokenHash));
    if (familyId) {
      await revokeRefreshFamily(familyId);
    }
    return null;
  }

  const session = JSON.parse(payload) as RefreshSession;
  await redis.srem(familyKey(session.familyId), tokenHash);
  // Keep a short-lived index so reuse of this hash can revoke the family.
  await redis.set(
    tokenFamilyIndex(tokenHash),
    session.familyId,
    'EX',
    env.REFRESH_TOKEN_TTL_SECONDS,
  );

  const nextToken = await issueRefreshToken(session);
  const nextHash = hashToken(nextToken);
  await redis.set(
    tokenFamilyIndex(nextHash),
    session.familyId,
    'EX',
    env.REFRESH_TOKEN_TTL_SECONDS,
  );
  return { session, nextToken };
}

export async function revokeRefreshFamily(familyId: string, userId?: string): Promise<void> {
  const redis = getRedis();
  const key = familyKey(familyId);
  const members = await redis.smembers(key);
  if (members.length > 0) {
    await redis.del(...members.map(tokenKey), key);
  } else {
    await redis.del(key);
  }
  if (userId) {
    await redis.srem(userFamiliesKey(userId), familyId);
  }
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const redis = getRedis();
  const tokenHash = hashToken(rawToken);
  const payload = await redis.get(tokenKey(tokenHash));
  if (!payload) return;
  const session = JSON.parse(payload) as RefreshSession;
  await revokeRefreshFamily(session.familyId, session.userId);
}

/** Revoke every refresh-token family for a staff user (password change / reset). */
export async function revokeAllRefreshForUser(userId: string): Promise<void> {
  const redis = getRedis();
  const key = userFamiliesKey(userId);
  const families = await redis.smembers(key);
  for (const familyId of families) {
    await revokeRefreshFamily(familyId);
  }
  await redis.del(key);
}

/**
 * Detect reuse: token missing from live set but still indexed to a family.
 * Returns the family id if reuse is detected (and revokes the family).
 */
export async function detectRefreshReuse(rawToken: string): Promise<string | null> {
  const redis = getRedis();
  const tokenHash = hashToken(rawToken);
  const exists = await redis.exists(tokenKey(tokenHash));
  if (exists) return null;

  const familyId = await redis.get(tokenFamilyIndex(tokenHash));
  if (!familyId) return null;

  await revokeRefreshFamily(familyId);
  return familyId;
}
