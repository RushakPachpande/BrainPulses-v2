import type { NextFunction, Request, Response } from 'express';
import type { AccessLevel, ActivityKind, MembershipRole } from '#prisma';
import { badRequest, unauthorized, forbidden } from '../lib/errors.js';
import { verifyToken } from '../lib/jwt.js';
import { getPasswordEpoch } from '../lib/password-epoch.js';
import { tenantStore } from '../lib/prisma.js';
import { isStudentSessionCurrent, touchStudentSession } from '../lib/student-sessions.js';
import type { AuthActor } from '../types/auth-actor.js';

const accessRank: Record<AccessLevel, number> = {
  none: 0,
  view: 1,
  edit: 2,
  full: 3,
};

function bearer(req: Request): string | null {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

/** Paths a user with mustChangePassword may still call with their access token. */
function isMustChangePasswordAllowed(req: Request): boolean {
  const path = (req.originalUrl ?? req.url).split('?')[0] ?? '';
  const method = req.method.toUpperCase();
  if (method === 'GET' && path === '/api/auth/session') return true;
  if (method === 'POST' && path === '/api/auth/password') return true;
  return false;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = bearer(req);
    if (!token) throw unauthorized();
    const payload = verifyToken(token);

    if (payload.typ === 'access') {
      if (payload.pwdEpoch != null) {
        const current = await getPasswordEpoch(payload.sub);
        if (current > payload.pwdEpoch) throw unauthorized('Session expired. Sign in again.');
      }

      if (payload.mustChangePassword && !isMustChangePasswordAllowed(req)) {
        throw forbidden('You must change your password before continuing.');
      }

      req.actor = {
        kind: 'user',
        userId: payload.sub,
        organizationId: payload.organizationId,
        membershipId: payload.membershipId,
        role: payload.role,
        assessmentAccess: payload.assessmentAccess,
        quizAccess: payload.quizAccess,
        mustChangePassword: payload.mustChangePassword === true,
      };
      return next();
    }

    if (payload.typ === 'student') {
      if (!payload.sid) throw unauthorized('Invalid access token.');
      const active = await isStudentSessionCurrent(
        payload.organizationId,
        payload.sub,
        payload.sid,
      );
      if (!active) throw unauthorized('Session expired. Sign in again.');
      await touchStudentSession(payload.organizationId, payload.sub, payload.sid);
      req.actor = {
        kind: 'student',
        studentId: payload.sub,
        organizationId: payload.organizationId,
        sessionId: payload.sid,
      };
      return next();
    }

    throw unauthorized('Invalid access token.');
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      next(err);
      return;
    }
    next(unauthorized());
  }
}

export function requireUser(req: Request, _res: Response, next: NextFunction) {
  if (!req.actor || req.actor.kind !== 'user') {
    next(unauthorized());
    return;
  }
  next();
}

export function requireStudent(req: Request, _res: Response, next: NextFunction) {
  if (!req.actor || req.actor.kind !== 'student') {
    next(unauthorized());
    return;
  }
  next();
}

export function requireRole(...roles: MembershipRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.actor || req.actor.kind !== 'user') {
      next(unauthorized());
      return;
    }
    if (!roles.includes(req.actor.role)) {
      next(forbidden());
      return;
    }
    next();
  };
}

function accessForKind(actor: AuthActor | undefined, kind: ActivityKind): AccessLevel {
  if (!actor || actor.kind !== 'user') return 'none';
  return kind === 'assessment' ? actor.assessmentAccess : actor.quizAccess;
}

function maxOrgAccess(actor: Extract<AuthActor, { kind: 'user' }>): AccessLevel {
  const a = accessRank[actor.assessmentAccess];
  const q = accessRank[actor.quizAccess];
  const rank = Math.max(a, q);
  return (Object.entries(accessRank).find(([, v]) => v === rank)?.[0] as AccessLevel) ?? 'none';
}

export function requireAccess(kind: ActivityKind, min: AccessLevel) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.actor || req.actor.kind !== 'user') {
      next(unauthorized());
      return;
    }
    if (req.actor.role === 'super_admin') {
      next();
      return;
    }
    const level = accessForKind(req.actor, kind);
    if (accessRank[level] < accessRank[min]) {
      next(forbidden());
      return;
    }
    next();
  };
}

/** Max of assessment/quiz access — for org-wide resources (students, users, settings, files). */
export function requireOrgAccess(min: AccessLevel) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.actor || req.actor.kind !== 'user') {
      next(unauthorized());
      return;
    }
    if (req.actor.role === 'super_admin') {
      next();
      return;
    }
    if (accessRank[maxOrgAccess(req.actor)] < accessRank[min]) {
      next(forbidden());
      return;
    }
    next();
  };
}

/** Read kind from query or body then apply requireAccess. */
export function requireKindAccess(min: AccessLevel, source: 'query' | 'body' = 'query') {
  return (req: Request, res: Response, next: NextFunction) => {
    const raw = source === 'query' ? req.query.kind : (req.body as { kind?: unknown })?.kind;
    if (raw !== 'assessment' && raw !== 'quiz') {
      next(badRequest('Activity kind is required.'));
      return;
    }
    requireAccess(raw, min)(req, res, next);
  };
}

/** Bind Prisma tenant ALS for the remainder of the request. */
export function withTenantContext(req: Request, _res: Response, next: NextFunction) {
  if (!req.actor) {
    next(unauthorized());
    return;
  }
  tenantStore.run({ organizationId: req.actor.organizationId }, () => next());
}

export function userActor(req: Request) {
  if (!req.actor || req.actor.kind !== 'user') throw unauthorized();
  return req.actor;
}

export function studentActor(req: Request) {
  if (!req.actor || req.actor.kind !== 'student') throw unauthorized();
  return req.actor;
}
