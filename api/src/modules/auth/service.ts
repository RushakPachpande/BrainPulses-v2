import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { env } from '../../config/env.js';
import { unauthorized, forbidden, badRequest } from '../../lib/errors.js';
import {
  signAccessToken,
  signOrgSelectToken,
  signStudentAccessToken,
  verifyToken,
} from '../../lib/jwt.js';
import { verifyPassword } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';
import {
  issueRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
} from '../../lib/refresh-tokens.js';

const REFRESH_COOKIE = 'bp_refresh';

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: '/api/auth',
    maxAge: env.REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: '/api/auth',
  });
}

async function issueSession(
  res: Response,
  membership: {
    id: string;
    userId: string;
    organizationId: string;
    role: 'super_admin' | 'admin';
    assessmentAccess: 'full' | 'edit' | 'view' | 'none';
    quizAccess: 'full' | 'edit' | 'view' | 'none';
    organization: { id: string; name: string; slug: string };
    user: { id: string; email: string; name: string };
  },
) {
  const accessToken = signAccessToken({
    sub: membership.userId,
    organizationId: membership.organizationId,
    membershipId: membership.id,
    role: membership.role,
    assessmentAccess: membership.assessmentAccess,
    quizAccess: membership.quizAccess,
  });

  const familyId = randomUUID();
  const refreshToken = await issueRefreshToken({
    userId: membership.userId,
    organizationId: membership.organizationId,
    membershipId: membership.id,
    familyId,
  });
  setRefreshCookie(res, refreshToken);

  await prisma.user.update({
    where: { id: membership.userId },
    data: { lastLoginAt: new Date() },
  });

  return {
    accessToken,
    user: {
      id: membership.user.id,
      email: membership.user.email,
      name: membership.user.name,
    },
    organization: membership.organization,
    membership: {
      id: membership.id,
      role: membership.role,
      assessmentAccess: membership.assessmentAccess,
      quizAccess: membership.quizAccess,
    },
  };
}

export async function signIn(input: { email: string; password: string }, res: Response) {
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (!user || !user.isActive) throw unauthorized('Invalid email or password.');

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) throw unauthorized('Invalid email or password.');

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id, isActive: true, organization: { isActive: true } },
    include: { organization: true, user: true },
    orderBy: { createdAt: 'asc' },
  });

  if (memberships.length === 0) {
    throw forbidden('No active organization membership.');
  }

  if (memberships.length === 1) {
    return {
      status: 'authenticated' as const,
      session: await issueSession(res, memberships[0]!),
    };
  }

  return {
    status: 'select_organization' as const,
    selectionToken: signOrgSelectToken(user.id),
    organizations: memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
    })),
  };
}

export async function selectOrganization(
  input: { selectionToken: string; organizationId: string },
  res: Response,
) {
  let userId: string;
  try {
    const payload = verifyToken(input.selectionToken);
    if (payload.typ !== 'org_select') throw new Error('bad typ');
    userId = payload.sub;
  } catch {
    throw unauthorized('Invalid or expired selection token.');
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId,
      organizationId: input.organizationId,
      isActive: true,
      organization: { isActive: true },
    },
    include: { organization: true, user: true },
  });
  if (!membership) throw forbidden('Membership not found for that organization.');

  return {
    status: 'authenticated' as const,
    session: await issueSession(res, membership),
  };
}

export async function refresh(reqCookies: Record<string, string | undefined>, res: Response) {
  const raw = reqCookies[REFRESH_COOKIE];
  if (!raw) throw unauthorized('Refresh token missing.');

  const rotated = await rotateRefreshToken(raw);
  if (!rotated) {
    clearRefreshCookie(res);
    throw unauthorized('Refresh token is invalid or reused.');
  }

  const membership = await prisma.membership.findFirst({
    where: {
      id: rotated.session.membershipId,
      userId: rotated.session.userId,
      organizationId: rotated.session.organizationId,
      isActive: true,
    },
    include: { organization: true, user: true },
  });
  if (!membership) {
    clearRefreshCookie(res);
    throw unauthorized('Membership no longer active.');
  }

  setRefreshCookie(res, rotated.nextToken);

  const accessToken = signAccessToken({
    sub: membership.userId,
    organizationId: membership.organizationId,
    membershipId: membership.id,
    role: membership.role,
    assessmentAccess: membership.assessmentAccess,
    quizAccess: membership.quizAccess,
  });

  return {
    accessToken,
    user: {
      id: membership.user.id,
      email: membership.user.email,
      name: membership.user.name,
    },
    organization: membership.organization,
    membership: {
      id: membership.id,
      role: membership.role,
      assessmentAccess: membership.assessmentAccess,
      quizAccess: membership.quizAccess,
    },
  };
}

export async function signOut(reqCookies: Record<string, string | undefined>, res: Response) {
  const raw = reqCookies[REFRESH_COOKIE];
  if (raw) await revokeRefreshToken(raw);
  clearRefreshCookie(res);
  return { ok: true };
}

export async function getSession(actor: {
  userId: string;
  organizationId: string;
  membershipId: string;
}) {
  const membership = await prisma.membership.findFirst({
    where: {
      id: actor.membershipId,
      userId: actor.userId,
      organizationId: actor.organizationId,
      isActive: true,
    },
    include: { organization: true, user: true },
  });
  if (!membership) throw unauthorized();

  return {
    user: {
      id: membership.user.id,
      email: membership.user.email,
      name: membership.user.name,
    },
    organization: {
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
    },
    membership: {
      id: membership.id,
      role: membership.role,
      assessmentAccess: membership.assessmentAccess,
      quizAccess: membership.quizAccess,
    },
  };
}

export async function studentSignIn(input: {
  email: string;
  password: string;
  organizationSlug?: string;
}) {
  const students = await prisma.student.findMany({
    where: {
      email: input.email.toLowerCase(),
      isActive: true,
      ...(input.organizationSlug
        ? { organization: { slug: input.organizationSlug, isActive: true } }
        : { organization: { isActive: true } }),
    },
    include: { organization: true },
  });

  if (students.length === 0) throw unauthorized('Invalid email or password.');
  if (students.length > 1 && !input.organizationSlug) {
    throw badRequest('Multiple organizations match; provide organizationSlug.');
  }

  const student = students[0]!;
  if (!student.passwordHash) throw unauthorized('Student login is not enabled.');
  const ok = await verifyPassword(input.password, student.passwordHash);
  if (!ok) throw unauthorized('Invalid email or password.');

  await prisma.student.update({
    where: { id: student.id },
    data: { lastLoginAt: new Date() },
  });

  const accessToken = signStudentAccessToken({
    sub: student.id,
    organizationId: student.organizationId,
  });

  return {
    accessToken,
    student: {
      id: student.id,
      code: student.code,
      name: student.name,
      email: student.email,
    },
    organization: {
      id: student.organization.id,
      name: student.organization.name,
      slug: student.organization.slug,
    },
  };
}
