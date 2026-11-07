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
  const pending: Array<{
    sheetRow: number;
    name: string;
    email: string;
    password: string;
    role: 'admin' | 'super_admin';
    assessmentAccess: 'full' | 'edit' | 'view' | 'none';
    quizAccess: 'full' | 'edit' | 'view' | 'none';
  }> = [];

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
        userRowIssue(row.sheetRow, 'the Name cell is empty', {
          column: 'Name',
          value: row.name,
          expected: 'the person’s full name',
          example: 'Priya Shah',
        }),
      );
      continue;
    }
    if (!emailRaw) {
      issues.push(
        userRowIssue(row.sheetRow, 'the Email cell is empty', {
          column: 'Email',
          value: row.email,
          expected: 'the address this person will use to sign in',
          example: 'admin@org.example',
        }),
      );
      continue;
    }
    if (!EMAIL_RE.test(email)) {
      issues.push(
        userRowIssue(row.sheetRow, 'this does not look like an email address', {
          column: 'Email',
          value: emailRaw,
          expected: 'an address with a name, an @ sign, and a domain',
          example: 'admin@org.example',
        }),
      );
      continue;
    }
    if (password.length < 8 || password.length > 128) {
      issues.push(
        userRowIssue(
          row.sheetRow,
          password
            ? 'this password is shorter than 8 characters or longer than 128'
            : 'the Password cell is empty',
          {
            column: 'Password',
            ...(password ? {} : { value: '' }),
            expected:
              'a temporary password of 8 to 128 characters. The person can change it after signing in',
            example: 'ChangeMe123!',
          },
        ),
      );
      continue;
    }
    if (!ROLES.has(role)) {
      issues.push(
        userRowIssue(row.sheetRow, 'this role cannot be imported', {
          column: 'Role',
          value: row.role,
          expected:
            'admin for a normal administrator, or super_admin only if you are a super admin. Leave the cell blank to create an admin',
          example: 'admin',
        }),
      );
      continue;
    }
    if (!ACCESS_LEVELS.has(assessmentAccess)) {
      issues.push(
        userRowIssue(row.sheetRow, 'this is not an access level', {
          column: 'Assessment access',
          value: row.assessmentAccess,
          expected:
            'full (create and delete), edit (change existing items), view (look only), or none (no access). Leave the cell blank for full access',
          example: 'view',
        }),
      );
      continue;
    }
    if (!ACCESS_LEVELS.has(quizAccess)) {
      issues.push(
        userRowIssue(row.sheetRow, 'this is not an access level', {
          column: 'Quiz access',
          value: row.quizAccess,
          expected:
            'full (create and delete), edit (change existing items), view (look only), or none (no access). Leave the cell blank for full access',
          example: 'edit',
        }),
      );
      continue;
    }
    if (seenEmails.has(email)) {
      issues.push(
        userRowIssue(row.sheetRow, 'this email already appears on an earlier row', {
          column: 'Email',
          value: email,
          expected: 'each person once in the file. Delete this row or use a different email',
        }),
      );
      continue;
    }
    if (role === 'super_admin' && actorRole !== 'super_admin') {
      issues.push(
        userRowIssue(row.sheetRow, 'only a super admin can add another super admin', {
          column: 'Role',
          value: row.role,
          expected: 'change Role to admin, or ask a super admin to import this row',
          example: 'admin',
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
        userRowIssue(row.sheetRow, 'you cannot give someone more access than you have', {
          column: 'Assessment access',
          value: `assessment ${assessmentAccess}, quiz ${quizAccess}`,
          expected: `your own levels or lower. You have assessment access “${actorAccess.assessmentAccess}” and quiz access “${actorAccess.quizAccess}”`,
        }),
      );
      continue;
    }

    seenEmails.add(email);
    pending.push({
      sheetRow: row.sheetRow,
      name,
      email,
      password,
      role,
      assessmentAccess,
      quizAccess,
    });
  }

  const IMPORT_CONCURRENCY = 4;
  for (let i = 0; i < pending.length; i += IMPORT_CONCURRENCY) {
    const chunk = pending.slice(i, i + IMPORT_CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async (item) => {
        try {
          await inviteUser(organizationId, actorUserId, actorRole, {
            name: item.name,
            email: item.email,
            password: item.password,
            role: item.role,
            assessmentAccess: item.assessmentAccess,
            quizAccess: item.quizAccess,
          });
          return { ok: true as const, sheetRow: item.sheetRow, email: item.email };
        } catch (err) {
          return { ok: false as const, sheetRow: item.sheetRow, email: item.email, err };
        }
      }),
    );
    for (const result of results) {
      if (result.ok) {
        created += 1;
        continue;
      }
      const err = result.err;
      if (err instanceof AppError && (err.status === 409 || err.status === 403)) {
        issues.push(
          userRowIssue(result.sheetRow, err.message.replace(/\.$/, ''), {
            column: 'Email',
            value: result.email,
            expected: 'skip this row, or use an email that is not already in the organization',
          }),
        );
        continue;
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        issues.push(
          userRowIssue(result.sheetRow, 'someone with this email is already in the organization', {
            column: 'Email',
            value: result.email,
            expected: 'skip this row, or use a different email',
          }),
        );
        continue;
      }
      const message =
        err instanceof Error && err.message
          ? err.message.replace(/\.$/, '')
          : 'the row could not be saved';
      issues.push(userRowIssue(result.sheetRow, message));
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
