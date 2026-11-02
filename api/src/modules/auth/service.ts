import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { env } from '../../config/env.js';
import { writeAudit } from '../../lib/audit.js';
import { unauthorized, forbidden, badRequest, conflict } from '../../lib/errors.js';
import {
  signAccessToken,
  signOrgSelectToken,
  signParticipantAccessToken,
  verifyToken,
} from '../../lib/jwt.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { bumpPasswordEpoch, getPasswordEpoch } from '../../lib/password-epoch.js';
import { normalizePhone, toE164 } from '../../lib/phone.js';
import { prisma } from '../../lib/prisma.js';
import {
  issueRefreshToken,
  revokeAllRefreshForUser,
  revokeRefreshToken,
  rotateRefreshToken,
} from '../../lib/refresh-tokens.js';
import {
  assertOtpSendAllowed,
  consumeParticipantOtp,
  generateOtpDigits,
  markOtpSend,
  storeParticipantOtp,
  verifyParticipantOtp,
} from '../../lib/participant-otp.js';
import {
  clearParticipantSession,
  getParticipantSessionId,
  storeParticipantSession,
  ttlSecondsFromAccessToken,
} from '../../lib/participant-sessions.js';
import {
  getParticipantLoginOptions,
  isParticipantPhoneLoginEnabled,
} from '../../lib/participant-login.js';
import { DEV_FIXED_OTP, DEV_FIXED_OTP_PHONE, sendSmsOtp } from '../../lib/twilio.js';
import type { Participant } from '#prisma';

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
    user: { id: string; email: string; name: string; mustChangePassword: boolean };
  },
  opts: { touchLastLogin?: boolean } = {},
) {
  const mustChangePassword = membership.user.mustChangePassword;
  const pwdEpoch = await getPasswordEpoch(membership.userId);
  const accessToken = signAccessToken({
    sub: membership.userId,
    organizationId: membership.organizationId,
    membershipId: membership.id,
    role: membership.role,
    assessmentAccess: membership.assessmentAccess,
    quizAccess: membership.quizAccess,
    mustChangePassword: mustChangePassword || undefined,
    pwdEpoch,
  });

  const familyId = randomUUID();
  const refreshToken = await issueRefreshToken({
    userId: membership.userId,
    organizationId: membership.organizationId,
    membershipId: membership.id,
    familyId,
  });
  setRefreshCookie(res, refreshToken);

  if (opts.touchLastLogin !== false) {
    await prisma.user.update({
      where: { id: membership.userId },
      data: { lastLoginAt: new Date() },
    });
  }

  return {
    accessToken,
    user: {
      id: membership.user.id,
      email: membership.user.email,
      name: membership.user.name,
      mustChangePassword,
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

  // TEMP DEMO: skip org chooser; auto-enter NextGenInnov8 until org management is ready.
  const demoMembership = memberships.find((m) => m.organization.slug === 'nextgeninnov8');
  if (demoMembership) {
    return {
      status: 'authenticated' as const,
      session: await issueSession(res, demoMembership),
    };
  }

  const orgIds = memberships.map((m) => m.organization.id);
  const displayRows = await prisma.setting.findMany({
    where: {
      organizationId: { in: orgIds },
      group: 'general',
      key: 'orgDisplayName',
    },
    select: { organizationId: true, value: true },
  });
  const displayByOrg = new Map(
    displayRows.map((row) => [
      row.organizationId,
      typeof row.value === 'string' && row.value.trim() ? row.value.trim() : 'BrainPulses',
    ]),
  );

  return {
    status: 'select_organization' as const,
    selectionToken: signOrgSelectToken(user.id),
    organizations: memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
      displayName: displayByOrg.get(m.organization.id) ?? 'BrainPulses',
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

  const mustChangePassword = membership.user.mustChangePassword;
  const pwdEpoch = await getPasswordEpoch(membership.userId);
  const accessToken = signAccessToken({
    sub: membership.userId,
    organizationId: membership.organizationId,
    membershipId: membership.id,
    role: membership.role,
    assessmentAccess: membership.assessmentAccess,
    quizAccess: membership.quizAccess,
    mustChangePassword: mustChangePassword || undefined,
    pwdEpoch,
  });

  return {
    accessToken,
    user: {
      id: membership.user.id,
      email: membership.user.email,
      name: membership.user.name,
      mustChangePassword,
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
      mustChangePassword: membership.user.mustChangePassword,
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

export async function changeOwnPassword(
  actor: {
    userId: string;
    organizationId: string;
    membershipId: string;
  },
  input: {
    currentPassword?: string;
    newPassword: string;
    confirmPassword: string;
  },
  res: Response,
) {
  if (input.newPassword !== input.confirmPassword) {
    throw badRequest('Passwords do not match.', { confirmPassword: 'Passwords do not match.' });
  }

  const user = await prisma.user.findUnique({ where: { id: actor.userId } });
  if (!user || !user.isActive) throw unauthorized();

  if (!user.mustChangePassword) {
    if (!input.currentPassword) {
      throw badRequest('Current password is required.', {
        currentPassword: 'Current password is required.',
      });
    }
    const ok = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!ok) {
      throw badRequest('Current password is incorrect.', {
        currentPassword: 'Current password is incorrect.',
      });
    }
  }

  const sameAsCurrent = await verifyPassword(input.newPassword, user.passwordHash);
  if (sameAsCurrent) {
    throw badRequest('New password must be different from the current password.', {
      newPassword: 'New password must be different from the current password.',
    });
  }

  const wasForced = user.mustChangePassword;
  const passwordHash = await hashPassword(input.newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      mustChangePassword: false,
    },
  });

  await bumpPasswordEpoch(user.id);
  await revokeAllRefreshForUser(user.id);
  clearRefreshCookie(res);

  await writeAudit({
    organizationId: actor.organizationId,
    actorType: 'user',
    actorUserId: actor.userId,
    action: 'user.password_change',
    targetType: 'user',
    targetId: user.id,
    metadata: { forced: wasForced },
  });

  if (!wasForced) {
    return { status: 'signed_out' as const, ok: true as const };
  }

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
    status: 'authenticated' as const,
    session: await issueSession(res, membership, { touchLastLogin: false }),
  };
}

type ParticipantWithOrg = Participant & {
  organization: { id: string; name: string; slug: string };
};

async function issueParticipantSession(
  participant: ParticipantWithOrg,
  opts: { replaceSession?: boolean; auditAction?: string } = {},
) {
  const existingSid = await getParticipantSessionId(participant.organizationId, participant.id);
  if (existingSid && !opts.replaceSession) {
    throw conflict(
      'Another active session exists for this participant. Confirm to revoke it and continue.',
      { reason: 'SESSION_ACTIVE' },
    );
  }

  const replacing = Boolean(existingSid && opts.replaceSession);
  const sessionId = randomUUID();

  await prisma.participant.update({
    where: { id: participant.id },
    data: { lastLoginAt: new Date() },
  });

  const accessToken = signParticipantAccessToken({
    sub: participant.id,
    organizationId: participant.organizationId,
    sid: sessionId,
  });
  await storeParticipantSession(
    participant.organizationId,
    participant.id,
    sessionId,
    ttlSecondsFromAccessToken(accessToken),
  );

  if (opts.auditAction) {
    await writeAudit({
      organizationId: participant.organizationId,
      actorType: 'participant',
      action: opts.auditAction,
      targetType: 'participant',
      targetId: participant.id,
      metadata: { replacedSession: replacing },
    });
  }
  if (replacing) {
    await writeAudit({
      organizationId: participant.organizationId,
      actorType: 'participant',
      action: 'participant.session.replace',
      targetType: 'participant',
      targetId: participant.id,
    });
  }

  return {
    accessToken,
    participant: {
      id: participant.id,
      code: participant.code,
      name: participant.name,
      email: participant.email,
    },
    organization: {
      id: participant.organization.id,
      name: participant.organization.name,
      slug: participant.organization.slug,
    },
  };
}

export async function participantSignOutSession(actor: {
  participantId: string;
  organizationId: string;
  sessionId: string;
}) {
  await clearParticipantSession(actor.organizationId, actor.participantId, actor.sessionId);
  return { ok: true as const };
}

function orgFilter(organizationSlug?: string) {
  return organizationSlug
    ? { organization: { slug: organizationSlug, isActive: true } }
    : { organization: { isActive: true } };
}

async function findActiveParticipants(
  where: Record<string, unknown>,
  organizationSlug?: string,
): Promise<ParticipantWithOrg[]> {
  return prisma.participant.findMany({
    where: {
      ...where,
      isActive: true,
      ...orgFilter(organizationSlug),
    },
    include: { organization: true },
  });
}

function requireSingleParticipant(
  participants: ParticipantWithOrg[],
  organizationSlug: string | undefined,
  notFoundMessage: string,
): ParticipantWithOrg {
  if (participants.length === 0) throw unauthorized(notFoundMessage);
  if (participants.length > 1 && !organizationSlug) {
    throw badRequest('Multiple organizations match; provide organizationSlug.');
  }
  return participants[0]!;
}

export async function participantSignInByCode(input: {
  code: string;
  organizationSlug?: string;
  replaceSession?: boolean;
}) {
  const code = input.code.trim();
  const participants = await findActiveParticipants({ code }, input.organizationSlug);
  const participant = requireSingleParticipant(
    participants,
    input.organizationSlug,
    'Invalid Unique ID.',
  );
  return issueParticipantSession(participant, {
    replaceSession: input.replaceSession,
    auditAction: 'participant.sign_in_by_code',
  });
}

async function resolveParticipantForPhone(input: {
  countryCode: string;
  mobileNumber: string;
  organizationSlug?: string;
}): Promise<ParticipantWithOrg | null> {
  const phone = toE164(input.countryCode, input.mobileNumber);
  if (!phone) return null;

  const participants = await findActiveParticipants({ phone }, input.organizationSlug);
  if (participants.length === 0) {
    // Fallback: match common spaced format still present in older rows
    const spaced = normalizePhone(`${input.countryCode} ${input.mobileNumber}`);
    if (spaced && spaced !== phone) {
      const alt = await findActiveParticipants({ phone: spaced }, input.organizationSlug);
      if (alt.length === 1) return alt[0]!;
      if (alt.length > 1 && !input.organizationSlug) {
        throw badRequest('Multiple organizations match; provide organizationSlug.');
      }
    }
    return null;
  }
  if (participants.length > 1 && !input.organizationSlug) {
    throw badRequest('Multiple organizations match; provide organizationSlug.');
  }
  return participants[0]!;
}

async function issueAndSendOtp(participant: ParticipantWithOrg, phone: string): Promise<string> {
  await assertOtpSendAllowed(participant.organizationId, phone);

  const otp =
    env.NODE_ENV !== 'production' && !env.TWILIO_ENABLED && phone === DEV_FIXED_OTP_PHONE
      ? DEV_FIXED_OTP
      : generateOtpDigits();

  await storeParticipantOtp({
    organizationId: participant.organizationId,
    phone,
    participantId: participant.id,
    otp,
  });
  await markOtpSend(participant.organizationId, phone);

  // SMS must not delay or alter the generic response; failures stay private.
  void sendSmsOtp(phone, otp).catch((err: unknown) => {
    console.warn('[otp] SMS delivery failed', err instanceof Error ? err.message : err);
  });
  return otp;
}

export async function participantLoginOptions(organizationSlug?: string) {
  return getParticipantLoginOptions(organizationSlug);
}

/** Always returns a generic success payload (no user enumeration). */
export async function participantRequestOtp(input: {
  countryCode: string;
  mobileNumber: string;
  organizationSlug?: string;
}) {
  const phone = toE164(input.countryCode, input.mobileNumber);
  if (!phone) throw badRequest('Invalid phone number.');

  let debugOtp: string | undefined;
  const participant = await resolveParticipantForPhone(input);
  if (participant && (await isParticipantPhoneLoginEnabled(participant.organizationId))) {
    const storedPhone = participant.phone ? (normalizePhone(participant.phone) ?? phone) : phone;
    try {
      const otp = await issueAndSendOtp(participant, storedPhone);
      if (env.NODE_ENV === 'test') debugOtp = otp;
    } catch (err) {
      // Cooldown / daily limit: still return generic success to avoid enumeration,
      // except in test where clients need the signal.
      if (env.NODE_ENV === 'test') throw err;
    }
  } else if (env.NODE_ENV !== 'production' && !env.TWILIO_ENABLED) {
    // Do not invent digits here — a logged code looks real but was never stored,
    // so verify always fails with "Invalid or expired OTP".
    console.info(
      `[otp] TWILIO_ENABLED=false — no matching participant for ${phone}; OTP not issued`,
    );
  }

  return {
    ok: true,
    message: 'If that number is registered, an OTP has been sent.',
    ...(debugOtp ? { debugOtp } : {}),
  };
}

export async function participantResendOtp(input: {
  countryCode: string;
  mobileNumber: string;
  organizationSlug?: string;
}) {
  return participantRequestOtp(input);
}

export async function participantVerifyOtp(input: {
  countryCode: string;
  mobileNumber: string;
  otp: string;
  organizationSlug?: string;
  replaceSession?: boolean;
}) {
  const phone = toE164(input.countryCode, input.mobileNumber);
  if (!phone) throw badRequest('Invalid phone number.');

  const participant = await resolveParticipantForPhone(input);
  if (!participant) throw unauthorized('Invalid or expired OTP.');
  if (!(await isParticipantPhoneLoginEnabled(participant.organizationId))) {
    throw forbidden('Phone sign-in is turned off for your organization.');
  }

  const storedPhone = participant.phone ? (normalizePhone(participant.phone) ?? phone) : phone;
  // Validate without consuming so SESSION_ACTIVE can retry with replaceSession.
  const result = await verifyParticipantOtp({
    organizationId: participant.organizationId,
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

  if (result.participantId !== participant.id) throw unauthorized('Invalid or expired OTP.');

  const session = await issueParticipantSession(participant, {
    replaceSession: input.replaceSession,
    auditAction: 'participant.sign_in_otp',
  });
  await consumeParticipantOtp(participant.organizationId, storedPhone);
  return session;
}
