import { Prisma } from '#prisma';
import { writeAudit } from '../../lib/audit.js';
import { AppError, badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { buildPage, listEnvelope, prismaCursorArgs } from '../../lib/pagination.js';
import { hashPassword } from '../../lib/password.js';
import { bumpPasswordEpoch } from '../../lib/password-epoch.js';
import { prisma } from '../../lib/prisma.js';
import { revokeAllRefreshForUser } from '../../lib/refresh-tokens.js';
import type { z } from 'zod';
import {
  buildUserSampleWorkbook,
  parseUsersFile,
  userRowIssue,
  type UserImportIssue,
} from './import-export.js';
import type {
  inviteUserSchema,
  resetPasswordSchema,
  updateMembershipSchema,
  userListQuerySchema,
} from './schema.js';

function mapMembership(m: {
  id: string;
  role: string;
  assessmentAccess: string;
  quizAccess: string;
  isActive: boolean;
  user: { id: string; name: string; email: string; lastLoginAt: Date | null; isActive: boolean };
}) {
  return {
    id: m.id,
    userId: m.user.id,
    name: m.user.name,
    email: m.user.email,
    role: m.role === 'super_admin' ? 'Super Admin' : 'Admin',
    roleKey: m.role,
    assessmentAccess: m.assessmentAccess,
    quizAccess: m.quizAccess,
    status: m.isActive && m.user.isActive ? 'Active' : 'Inactive',
    isActive: m.isActive && m.user.isActive,
    lastLoginAt: m.user.lastLoginAt,
  };
}

export async function listUsers(
  organizationId: string,
  query: z.infer<typeof userListQuerySchema>,
) {
  const and: Prisma.MembershipWhereInput[] = [];
  if (query.status === 'active') {
    and.push({ isActive: true, user: { isActive: true } });
  } else if (query.status === 'inactive') {
    and.push({ OR: [{ isActive: false }, { user: { isActive: false } }] });
  }
  if (query.q) {
    and.push({
      user: {
        OR: [
          { name: { contains: query.q, mode: 'insensitive' } },
          { email: { contains: query.q, mode: 'insensitive' } },
        ],
      },
    });
  }

  const where: Prisma.MembershipWhereInput = {
    organizationId,
    ...(and.length > 0 ? { AND: and } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.membership.count({ where }),
    prisma.membership.findMany({
      where,
      include: { user: true },
      ...prismaCursorArgs(query),
    }),
  ]);

  const { items, page } = buildPage(rows, query.limit, total);
  return listEnvelope(items.map(mapMembership), page);
}

export async function getMembership(organizationId: string, membershipId: string) {
  const membership = await prisma.membership.findFirst({
    where: { organizationId, id: membershipId },
    include: { user: true },
  });
  if (!membership) throw notFound('User membership not found.');
  return mapMembership(membership);
}

export async function inviteUser(
  organizationId: string,
  actorUserId: string,
  actorRole: string,
  input: z.infer<typeof inviteUserSchema>,
) {
  if (input.role === 'super_admin' && actorRole !== 'super_admin') {
    throw forbidden('Only a super admin can invite another super admin.');
  }

  const email = input.email.toLowerCase();
  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: input.name,
        passwordHash: await hashPassword(input.password),
      },
    });
  }

  try {
    const membership = await prisma.membership.create({
      data: {
        organizationId,
        userId: user.id,
        role: input.role,
        assessmentAccess: input.assessmentAccess,
        quizAccess: input.quizAccess,
      },
      include: { user: true },
    });

    await writeAudit({
      organizationId,
      actorType: 'user',
      actorUserId,
      action: 'user.invite',
      targetType: 'membership',
      targetId: membership.id,
      metadata: { email },
    });

    return mapMembership(membership);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw conflict('That user is already a member of this organization.');
    }
    throw err;
  }
}

const accessRank: Record<string, number> = { none: 0, view: 1, edit: 2, full: 3 };

export async function updateMembership(
  organizationId: string,
  actorUserId: string,
  actorRole: string,
  membershipId: string,
  input: z.infer<typeof updateMembershipSchema>,
  actorAccess?: { assessmentAccess: string; quizAccess: string },
) {
  if (input.role === 'super_admin' && actorRole !== 'super_admin') {
    throw forbidden('Only a super admin can promote to super admin.');
  }

  const existing = await prisma.membership.findFirst({
    where: { organizationId, id: membershipId },
    include: { user: true },
  });
  if (!existing) throw notFound('User membership not found.');

  if (actorRole !== 'super_admin') {
    if (existing.role === 'super_admin') {
      throw forbidden('Only a super admin can modify a super admin membership.');
    }
    if (existing.userId === actorUserId) {
      throw forbidden('You cannot modify your own membership.');
    }
    if (
      input.assessmentAccess !== undefined &&
      actorAccess &&
      (accessRank[input.assessmentAccess] ?? 0) > (accessRank[actorAccess.assessmentAccess] ?? 0)
    ) {
      throw forbidden('Cannot grant assessment access above your own level.');
    }
    if (
      input.quizAccess !== undefined &&
      actorAccess &&
      (accessRank[input.quizAccess] ?? 0) > (accessRank[actorAccess.quizAccess] ?? 0)
    ) {
      throw forbidden('Cannot grant quiz access above your own level.');
    }
  }

  const nextEmail = input.email !== undefined ? input.email.trim().toLowerCase() : undefined;
  if (nextEmail && nextEmail !== existing.user.email) {
    const taken = await prisma.user.findFirst({
      where: { email: nextEmail, NOT: { id: existing.userId } },
      select: { id: true },
    });
    if (taken) throw conflict('Another account already uses that email.');
  }

  try {
    if (input.name !== undefined || nextEmail !== undefined) {
      await prisma.user.update({
        where: { id: existing.userId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(nextEmail !== undefined ? { email: nextEmail } : {}),
        },
      });
    }

    const membership = await prisma.membership.update({
      where: { id: membershipId },
      data: {
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.assessmentAccess !== undefined
          ? { assessmentAccess: input.assessmentAccess }
          : {}),
        ...(input.quizAccess !== undefined ? { quizAccess: input.quizAccess } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      include: { user: true },
    });

    await writeAudit({
      organizationId,
      actorType: 'user',
      actorUserId,
      action: 'user.update',
      targetType: 'membership',
      targetId: membershipId,
      metadata: input,
    });

    return mapMembership(membership);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw conflict('Another account already uses that email.');
    }
    throw err;
  }
}

export async function deactivateMembership(
  organizationId: string,
  actorUserId: string,
  actorRole: string,
  membershipId: string,
  actorAccess?: { assessmentAccess: string; quizAccess: string },
) {
  return updateMembership(
    organizationId,
    actorUserId,
    actorRole,
    membershipId,
    { isActive: false },
    actorAccess,
  );
}

export async function resetMembershipPassword(
  organizationId: string,
  actorUserId: string,
  membershipId: string,
  input: z.infer<typeof resetPasswordSchema>,
) {
  const existing = await prisma.membership.findFirst({
    where: { organizationId, id: membershipId },
    include: { user: true },
  });
  if (!existing) throw notFound('User membership not found.');

  if (input.password !== input.confirmPassword) {
    throw badRequest('Passwords do not match.', { confirmPassword: 'Passwords do not match.' });
  }

  const mustChangePassword = input.mustChangePassword ?? true;
  const self = existing.userId === actorUserId;
  const passwordHash = await hashPassword(input.password);

  await prisma.user.update({
    where: { id: existing.userId },
    data: {
      passwordHash,
      mustChangePassword,
    },
  });

  await bumpPasswordEpoch(existing.userId);
  await revokeAllRefreshForUser(existing.userId);

  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId,
    action: 'user.password_reset',
    targetType: 'user',
    targetId: existing.userId,
    metadata: { membershipId, mustChangePassword, self },
  });

  return { ok: true as const, self };
}

export async function deleteUserCompletely(
  organizationId: string,
  actorUserId: string,
  actorRole: string,
  membershipId: string,
) {
  const existing = await prisma.membership.findFirst({
    where: { organizationId, id: membershipId },
    include: { user: true },
  });
  if (!existing) throw notFound('User membership not found.');

  if (existing.userId === actorUserId) {
    throw forbidden('You cannot delete your own account.');
  }
  if (actorRole !== 'super_admin' && existing.role === 'super_admin') {
    throw forbidden('Only a super admin can delete a super admin.');
  }

  if (existing.role === 'super_admin' && existing.isActive && existing.user.isActive) {
    const otherSuperAdmins = await prisma.membership.count({
      where: {
        organizationId,
        role: 'super_admin',
        isActive: true,
        user: { isActive: true },
        NOT: { id: membershipId },
      },
    });
    if (otherSuperAdmins === 0) {
      throw forbidden('Cannot delete the last active super admin in this organization.');
    }
  }

  const email = existing.user.email;
  const userId = existing.userId;

  await prisma.$transaction(async (tx) => {
    // ReattemptGrant.grantedBy is Restrict — clear grants attributed to this user first.
    await tx.reattemptGrant.deleteMany({ where: { grantedByUserId: userId } });
    await tx.user.delete({ where: { id: userId } });
  });

  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId,
    action: 'user.delete',
    targetType: 'user',
    targetId: userId,
    metadata: { email, membershipId },
  });

  return { deleted: true, email };
}

export async function sampleUsersWorkbook() {
  return buildUserSampleWorkbook();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACCESS_LEVELS = new Set(['full', 'edit', 'view', 'none']);
const ROLES = new Set(['admin', 'super_admin']);

export async function importUsersFile(
  organizationId: string,
  actorUserId: string,
  actorRole: string,
  actorAccess: { assessmentAccess: string; quizAccess: string },
  file: { buffer: Buffer; originalname: string },
) {
  const { rows, ignoredColumns } = await parseUsersFile(file.buffer, file.originalname);
  const issues: UserImportIssue[] = [];
  let created = 0;
  const seenEmails = new Set<string>();

  for (const row of rows) {
    const name = row.name.trim();
    const emailRaw = row.email.trim();
    const email = emailRaw.toLowerCase();
    const password = row.password;
    const roleRaw = row.role
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
    const role =
      roleRaw === ''
        ? 'admin'
        : roleRaw === 'superadmin'
          ? 'super_admin'
          : (roleRaw as 'admin' | 'super_admin');
    const assessmentRaw = row.assessmentAccess.trim().toLowerCase();
    const quizRaw = row.quizAccess.trim().toLowerCase();
    const assessmentAccess = (assessmentRaw === '' ? 'full' : assessmentRaw) as
      'full' | 'edit' | 'view' | 'none';
    const quizAccess = (quizRaw === '' ? 'full' : quizRaw) as 'full' | 'edit' | 'view' | 'none';

    if (!name) {
      issues.push(
        userRowIssue(row.sheetRow, 'name is required', {
          column: 'name',
          value: row.name,
          expected: 'the user’s full name',
          example: 'Priya Shah',
        }),
      );
      continue;
    }
    if (!emailRaw) {
      issues.push(
        userRowIssue(row.sheetRow, 'email is required', {
          column: 'email',
          value: row.email,
          expected: 'a real email address',
          example: 'admin@org.example',
        }),
      );
      continue;
    }
    if (!EMAIL_RE.test(email)) {
      issues.push(
        userRowIssue(row.sheetRow, 'this is not a valid email', {
          column: 'email',
          value: emailRaw,
          expected: 'a real email address',
          example: 'admin@org.example',
        }),
      );
      continue;
    }
    if (password.length < 8 || password.length > 128) {
      issues.push(
        userRowIssue(row.sheetRow, 'password must be 8–128 characters', {
          column: 'password',
          value: password ? '(set)' : '',
          expected: 'a temporary password of at least 8 characters',
        }),
      );
      continue;
    }
    if (!ROLES.has(role)) {
      issues.push(
        userRowIssue(row.sheetRow, 'role must be admin or super_admin', {
          column: 'role',
          value: row.role,
          expected: 'admin or super_admin (blank = admin)',
          example: 'admin',
        }),
      );
      continue;
    }
    if (!ACCESS_LEVELS.has(assessmentAccess)) {
      issues.push(
        userRowIssue(row.sheetRow, 'assessmentAccess must be full, edit, view, or none', {
          column: 'assessmentAccess',
          value: row.assessmentAccess,
          expected: 'full, edit, view, or none (blank = full)',
          example: 'full',
        }),
      );
      continue;
    }
    if (!ACCESS_LEVELS.has(quizAccess)) {
      issues.push(
        userRowIssue(row.sheetRow, 'quizAccess must be full, edit, view, or none', {
          column: 'quizAccess',
          value: row.quizAccess,
          expected: 'full, edit, view, or none (blank = full)',
          example: 'edit',
        }),
      );
      continue;
    }
    if (seenEmails.has(email)) {
      issues.push(
        userRowIssue(row.sheetRow, 'this email is duplicated earlier in the file', {
          column: 'email',
          value: email,
        }),
      );
      continue;
    }
    if (role === 'super_admin' && actorRole !== 'super_admin') {
      issues.push(
        userRowIssue(row.sheetRow, 'only a super admin can invite another super admin', {
          column: 'role',
          value: row.role,
        }),
      );
      continue;
    }
    if (
      actorRole !== 'super_admin' &&
      ((accessRank[assessmentAccess] ?? 0) > (accessRank[actorAccess.assessmentAccess] ?? 0) ||
        (accessRank[quizAccess] ?? 0) > (accessRank[actorAccess.quizAccess] ?? 0))
    ) {
      issues.push(
        userRowIssue(row.sheetRow, 'cannot grant access above your own level', {
          column: 'assessmentAccess',
          value: `${assessmentAccess}/${quizAccess}`,
        }),
      );
      continue;
    }

    try {
      await inviteUser(organizationId, actorUserId, actorRole, {
        name,
        email,
        password,
        role,
        assessmentAccess,
        quizAccess,
      });
      created += 1;
      seenEmails.add(email);
    } catch (err) {
      if (err instanceof AppError && (err.status === 409 || err.status === 403)) {
        issues.push(
          userRowIssue(row.sheetRow, err.message.replace(/\.$/, ''), {
            column: 'email',
            value: email,
          }),
        );
        continue;
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        issues.push(
          userRowIssue(row.sheetRow, 'that user is already a member of this organization', {
            column: 'email',
            value: email,
          }),
        );
        continue;
      }
      const message =
        err instanceof Error && err.message
          ? err.message.replace(/\.$/, '')
          : 'the row could not be saved';
      issues.push(userRowIssue(row.sheetRow, message));
    }
  }

  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId,
    action: 'user.import',
    targetType: 'membership',
    metadata: { created, issues: issues.length, ignoredColumns },
  });

  return { created, issues, ignoredColumns };
}
