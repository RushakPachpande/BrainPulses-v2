import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { env } from '../../config/env.js';
import { writeAudit } from '../../lib/audit.js';
import { unauthorized, forbidden, badRequest, conflict } from '../../lib/errors.js';
import {
  signAccessToken,
  signOrgSelectToken,
  signStudentAccessToken,
  verifyToken,
} from '../../lib/jwt.js';
import { verifyPassword } from '../../lib/password.js';
import { normalizePhone, toE164 } from '../../lib/phone.js';
import { prisma } from '../../lib/prisma.js';
import {
  issueRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
} from '../../lib/refresh-tokens.js';
import {
  assertOtpSendAllowed,
  consumeStudentOtp,
  generateOtpDigits,
  markOtpSend,
  storeStudentOtp,
  verifyStudentOtp,
} from '../../lib/student-otp.js';
import {
  clearStudentSession,
  getStudentSessionId,
  storeStudentSession,
  ttlSecondsFromAccessToken,
} from '../../lib/student-sessions.js';
import {
  DEV_FIXED_OTP,
  DEV_FIXED_OTP_PHONE,
  sendSmsOtp,
} from '../../lib/twilio.js';
import type { Student } from '#prisma';

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
  // No cookie = anonymous visitor (fresh load / after sign-out), not an auth failure.
  if (!raw) return null;

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

type StudentWithOrg = Student & {
  organization: { id: string; name: string; slug: string };
};

async function issueStudentSession(
  student: StudentWithOrg,
  opts: { replaceSession?: boolean; auditAction?: string } = {},
) {
  const existingSid = await getStudentSessionId(student.organizationId, student.id);
  if (existingSid && !opts.replaceSession) {
    throw conflict(
      'Another active session exists for this student. Confirm to revoke it and continue.',
      { reason: 'SESSION_ACTIVE' },
    );
  }

  const replacing = Boolean(existingSid && opts.replaceSession);
  const sessionId = randomUUID();

  await prisma.student.update({
    where: { id: student.id },
    data: { lastLoginAt: new Date() },
  });

  const accessToken = signStudentAccessToken({
    sub: student.id,
    organizationId: student.organizationId,
    sid: sessionId,
  });
  await storeStudentSession(
    student.organizationId,
    student.id,
    sessionId,
    ttlSecondsFromAccessToken(accessToken),
  );

  if (opts.auditAction) {
    await writeAudit({
      organizationId: student.organizationId,
      actorType: 'student',
      action: opts.auditAction,
      targetType: 'student',
      targetId: student.id,
      metadata: { replacedSession: replacing },
    });
  }
  if (replacing) {
    await writeAudit({
      organizationId: student.organizationId,
      actorType: 'student',
      action: 'student.session.replace',
      targetType: 'student',
      targetId: student.id,
    });
  }

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

export async function studentSignOutSession(actor: {
  studentId: string;
  organizationId: string;
  sessionId: string;
}) {
  await clearStudentSession(actor.organizationId, actor.studentId, actor.sessionId);
  return { ok: true as const };
}

function orgFilter(organizationSlug?: string) {
  return organizationSlug
    ? { organization: { slug: organizationSlug, isActive: true } }
    : { organization: { isActive: true } };
}

async function findActiveStudents(
  where: Record<string, unknown>,
  organizationSlug?: string,
): Promise<StudentWithOrg[]> {
  return prisma.student.findMany({
    where: {
      ...where,
      isActive: true,
      ...orgFilter(organizationSlug),
    },
    include: { organization: true },
  });
}

function requireSingleStudent(
  students: StudentWithOrg[],
  organizationSlug: string | undefined,
  notFoundMessage: string,
): StudentWithOrg {
  if (students.length === 0) throw unauthorized(notFoundMessage);
  if (students.length > 1 && !organizationSlug) {
    throw badRequest('Multiple organizations match; provide organizationSlug.');
  }
  return students[0]!;
}

export async function studentSignInByCode(input: {
  code: string;
  organizationSlug?: string;
  replaceSession?: boolean;
}) {
  const code = input.code.trim();
  const students = await findActiveStudents({ code }, input.organizationSlug);
  const student = requireSingleStudent(students, input.organizationSlug, 'Invalid Unique ID.');
  return issueStudentSession(student, {
    replaceSession: input.replaceSession,
    auditAction: 'student.sign_in_by_code',
  });
}

async function resolveStudentForPhone(input: {
  countryCode: string;
  mobileNumber: string;
  organizationSlug?: string;
}): Promise<StudentWithOrg | null> {
  const phone = toE164(input.countryCode, input.mobileNumber);
  if (!phone) return null;

  const students = await findActiveStudents({ phone }, input.organizationSlug);
  if (students.length === 0) {
    // Fallback: match common spaced format still present in older rows
    const spaced = normalizePhone(`${input.countryCode} ${input.mobileNumber}`);
    if (spaced && spaced !== phone) {
      const alt = await findActiveStudents({ phone: spaced }, input.organizationSlug);
      if (alt.length === 1) return alt[0]!;
      if (alt.length > 1 && !input.organizationSlug) {
        throw badRequest('Multiple organizations match; provide organizationSlug.');
      }
    }
    return null;
  }
  if (students.length > 1 && !input.organizationSlug) {
    throw badRequest('Multiple organizations match; provide organizationSlug.');
  }
  return students[0]!;
}

async function issueAndSendOtp(student: StudentWithOrg, phone: string): Promise<string> {
  await assertOtpSendAllowed(student.organizationId, phone);

  const otp =
    env.NODE_ENV !== 'production' &&
    !env.TWILIO_ENABLED &&
    phone === DEV_FIXED_OTP_PHONE
      ? DEV_FIXED_OTP
      : generateOtpDigits();

  await storeStudentOtp({
    organizationId: student.organizationId,
    phone,
    studentId: student.id,
    otp,
  });
  await markOtpSend(student.organizationId, phone);

  // SMS must not delay or alter the generic response; failures stay private.
  void sendSmsOtp(phone, otp).catch((err: unknown) => {
    console.warn('[otp] SMS delivery failed', err instanceof Error ? err.message : err);
  });
  return otp;
}

/** Always returns a generic success payload (no user enumeration). */
export async function studentRequestOtp(input: {
  countryCode: string;
  mobileNumber: string;
  organizationSlug?: string;
}) {
  const phone = toE164(input.countryCode, input.mobileNumber);
  if (!phone) throw badRequest('Invalid phone number.');

  let debugOtp: string | undefined;
  const student = await resolveStudentForPhone(input);
  if (student) {
    const storedPhone = student.phone ? normalizePhone(student.phone) ?? phone : phone;
    try {
      const otp = await issueAndSendOtp(student, storedPhone);
      if (env.NODE_ENV === 'test') debugOtp = otp;
    } catch (err) {
      // Cooldown / daily limit: still return generic success to avoid enumeration,
      // except in test where clients need the signal.
      if (env.NODE_ENV === 'test') throw err;
    }
  } else if (env.NODE_ENV !== 'production' && !env.TWILIO_ENABLED) {
    const otp = generateOtpDigits();
    console.info(
      `[otp] TWILIO_ENABLED=false — OTP for ${phone}: ${otp} (no matching student; verify will fail)`,
    );
  }

  return {
    ok: true,
    message: 'If that number is registered, an OTP has been sent.',
    ...(debugOtp ? { debugOtp } : {}),
  };
}

export async function studentResendOtp(input: {
  countryCode: string;
  mobileNumber: string;
  organizationSlug?: string;
}) {
  return studentRequestOtp(input);
}

export async function studentVerifyOtp(input: {
  countryCode: string;
  mobileNumber: string;
  otp: string;
  organizationSlug?: string;
  replaceSession?: boolean;
}) {
  const phone = toE164(input.countryCode, input.mobileNumber);
  if (!phone) throw badRequest('Invalid phone number.');

  const student = await resolveStudentForPhone(input);
  if (!student) throw unauthorized('Invalid or expired OTP.');

  const storedPhone = student.phone ? normalizePhone(student.phone) ?? phone : phone;
  // Validate without consuming so SESSION_ACTIVE can retry with replaceSession.
  const result = await verifyStudentOtp({
    organizationId: student.organizationId,
    phone: storedPhone,
    otp: input.otp,
    consume: false,
  });

  if (!result.ok) {
    if (result.reason === 'exhausted') {
      throw unauthorized('Too many invalid attempts. Request a new OTP.');
    }
    throw unauthorized('Invalid or expired OTP.');
  }

  if (result.studentId !== student.id) throw unauthorized('Invalid or expired OTP.');

  const session = await issueStudentSession(student, {
    replaceSession: input.replaceSession,
    auditAction: 'student.sign_in_otp',
  });
  await consumeStudentOtp(student.organizationId, storedPhone);
  return session;
}
