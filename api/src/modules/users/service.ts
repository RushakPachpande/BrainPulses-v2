import { Prisma } from '#prisma';
import { writeAudit } from '../../lib/audit.js';
import { conflict, forbidden, notFound } from '../../lib/errors.js';
import { buildPage, listEnvelope, prismaCursorArgs } from '../../lib/pagination.js';
import { hashPassword } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';
import type { z } from 'zod';
import type { inviteUserSchema, updateMembershipSchema, userListQuerySchema } from './schema.js';

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
