import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { getRedis } from './redis.js';

function sessionKey(organizationId: string, participantId: string) {
  return `participant:session:${organizationId}:${participantId}`;
}

/**
 * Fallback parser for duration env values when a token cannot be decoded.
 * Supports unit-less seconds and compact forms (15m, 1h, 2d, 30s).
 */
export function parseDurationSeconds(rawValue: string, fallback = 900): number {
  const raw = rawValue.trim();
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    return n > 0 ? n : fallback;
  }
  const match = raw.match(/^(\d+)\s*([smhd])$/i);
  if (!match) return fallback;
  const n = Number(match[1]);
  const unit = match[2]!.toLowerCase();
  if (unit === 's') return n;
  if (unit === 'm') return n * 60;
  if (unit === 'h') return n * 3600;
  return n * 86_400;
}

export function participantSessionTtlSeconds(): number {
  return parseDurationSeconds(env.PARTICIPANT_JWT_ACCESS_EXPIRES_IN, 14_400);
}

/** Prefer the signed token's `exp` so Redis TTL matches jsonwebtoken's lifetime. */
export function ttlSecondsFromAccessToken(accessToken: string): number {
  const decoded = jwt.decode(accessToken);
  if (decoded && typeof decoded === 'object' && typeof decoded.exp === 'number') {
    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) return ttl;
  }
  return participantSessionTtlSeconds();
}

export async function getParticipantSessionId(
  organizationId: string,
  participantId: string,
): Promise<string | null> {
  const raw = await getRedis().get(sessionKey(organizationId, participantId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { sessionId?: string };
    return typeof parsed.sessionId === 'string' ? parsed.sessionId : null;
  } catch {
    return null;
  }
}

export async function storeParticipantSession(
  organizationId: string,
  participantId: string,
  sessionId: string,
  ttlSeconds: number,
): Promise<void> {
  const ttl = ttlSeconds > 0 ? ttlSeconds : participantSessionTtlSeconds();
  await getRedis().set(
    sessionKey(organizationId, participantId),
    JSON.stringify({ sessionId }),
    'EX',
    ttl,
  );
}

export async function replaceParticipantSession(
  organizationId: string,
  participantId: string,
  ttlSeconds?: number,
): Promise<string> {
  const sessionId = randomUUID();
  await storeParticipantSession(
    organizationId,
    participantId,
    sessionId,
    ttlSeconds ?? participantSessionTtlSeconds(),
  );
  return sessionId;
}

export async function isParticipantSessionCurrent(
  organizationId: string,
  participantId: string,
  sessionId: string,
): Promise<boolean> {
  const current = await getParticipantSessionId(organizationId, participantId);
  return current !== null && current === sessionId;
}

/** Extend Redis session TTL on authenticated participant requests. */
export async function touchParticipantSession(
  organizationId: string,
  participantId: string,
  sessionId: string,
): Promise<void> {
  const key = sessionKey(organizationId, participantId);
  const current = await getParticipantSessionId(organizationId, participantId);
  if (current !== sessionId) return;
  await getRedis().expire(key, participantSessionTtlSeconds());
}

export async function clearParticipantSession(
  organizationId: string,
  participantId: string,
  sessionId?: string,
): Promise<void> {
  if (sessionId) {
    const current = await getParticipantSessionId(organizationId, participantId);
    if (current !== sessionId) return;
  }
  await getRedis().del(sessionKey(organizationId, participantId));
}
