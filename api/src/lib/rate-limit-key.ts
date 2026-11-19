import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { ipKeyGenerator } from 'express-rate-limit';

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (typeof header !== 'string') return null;
  const match = /^Bearer\s+(\S+)/i.exec(header);
  const token = match?.[1]?.trim();
  return token ? token : null;
}

/** One bucket per login token, so a shared NAT does not share a quiz's budget. */
export function rateLimitKey(req: Request): string {
  const token = bearerToken(req);
  if (token) {
    const digest = createHash('sha256').update(token).digest('hex').slice(0, 32);
    return `actor:${digest}`;
  }
  return `ip:${ipKeyGenerator(req.ip ?? '')}`;
}

export function rateLimitMax(req: Request, limits: { actor: number; ip: number }): number {
  return bearerToken(req) ? limits.actor : limits.ip;
}
