import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { getRedis } from './redis.js';

function sessionKey(organizationId: string, studentId: string) {
  return `student:session:${organizationId}:${studentId}`;
}

/**
 * Fallback parser for JWT_ACCESS_EXPIRES_IN when a token cannot be decoded.
 * Supports unit-less seconds and compact forms (15m, 1h, 2d, 30s).
 */
export function accessTokenTtlSeconds(): number {
  const raw = env.JWT_ACCESS_EXPIRES_IN.trim();
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    return n > 0 ? n : 900;
  }
  const match = raw.match(/^(\d+)\s*([smhd])$/i);
  if (!match) return 900;
  const n = Number(match[1]);
  const unit = match[2]!.toLowerCase();
  if (unit === 's') return n;
  if (unit === 'm') return n * 60;
  if (unit === 'h') return n * 3600;
  return n * 86_400;
}

/** Prefer the signed token's `exp` so Redis TTL matches jsonwebtoken's lifetime. */
export function ttlSecondsFromAccessToken(accessToken: string): number {
  const decoded = jwt.decode(accessToken);
  if (decoded && typeof decoded === 'object' && typeof decoded.exp === 'number') {
    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) return ttl;
  }
  return accessTokenTtlSeconds();
}

export async function getStudentSessionId(
  organizationId: string,
  studentId: string,
): Promise<string | null> {
  const raw = await getRedis().get(sessionKey(organizationId, studentId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { sessionId?: string };
    return typeof parsed.sessionId === 'string' ? parsed.sessionId : null;
  } catch {
    return null;
  }
}

export async function storeStudentSession(
  organizationId: string,
  studentId: string,
  sessionId: string,
  ttlSeconds: number,
): Promise<void> {
  const ttl = ttlSeconds > 0 ? ttlSeconds : accessTokenTtlSeconds();
  await getRedis().set(
    sessionKey(organizationId, studentId),
    JSON.stringify({ sessionId }),
    'EX',
    ttl,
  );
}

export async function replaceStudentSession(
  organizationId: string,
  studentId: string,
  ttlSeconds?: number,
): Promise<string> {
  const sessionId = randomUUID();
  await storeStudentSession(
    organizationId,
    studentId,
    sessionId,
    ttlSeconds ?? accessTokenTtlSeconds(),
  );
  return sessionId;
}

export async function isStudentSessionCurrent(
  organizationId: string,
  studentId: string,
  sessionId: string,
): Promise<boolean> {
  const current = await getStudentSessionId(organizationId, studentId);
  return current !== null && current === sessionId;
}

export async function clearStudentSession(
  organizationId: string,
  studentId: string,
  sessionId?: string,
): Promise<void> {
  if (sessionId) {
    const current = await getStudentSessionId(organizationId, studentId);
    if (current !== sessionId) return;
  }
  await getRedis().del(sessionKey(organizationId, studentId));
}
