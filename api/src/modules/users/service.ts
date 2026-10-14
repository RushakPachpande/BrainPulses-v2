import { Prisma } from '#prisma';
import { writeAudit } from '../../lib/audit.js';
import { conflict, forbidden, notFound } from '../../lib/errors.js';
import { buildPage, listEnvelope } from '../../lib/pagination.js';
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
  const where: Prisma.MembershipWhereInput = {
    organizationId,
    ...(query.status === 'active' ? { isActive: true, user: { isActive: true } } : {}),
    ...(query.status === 'inactive'
      ? { OR: [{ isActive: false }, { user: { isActive: false } }] }
      : {}),
    ...(query.q
      ? {
          user: {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { email: { contains: query.q, mode: 'insensitive' } },
            ],
          },
        }
      : {}),
    ...(query.cursor ? { id: { lt: query.cursor } } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.membership.count({ where: { ...where, id: undefined } }),
    prisma.membership.findMany({
      where,
      include: { user: true },
      orderBy: { createdAt: query.order },
      take: query.limit + 1,
    }),
  ]);

  const { items, page } = buildPage(rows, query.limit, total);
  return listEnvelope(items.map(mapMembership), page);
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

export async function updateMembership(
  organizationId: string,
  actorUserId: string,
  actorRole: string,
  membershipId: string,
  input: z.infer<typeof updateMembershipSchema>,
) {
  if (input.role === 'super_admin' && actorRole !== 'super_admin') {
    throw forbidden('Only a super admin can promote to super admin.');
  }

  const existing = await prisma.membership.findFirst({
    where: { organizationId, id: membershipId },
    include: { user: true },
  });
  if (!existing) throw notFound('User membership not found.');

  const membership = await prisma.membership.update({
    where: { id: membershipId },
    data: {
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.assessmentAccess !== undefined ? { assessmentAccess: input.assessmentAccess } : {}),
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
}

export async function deactivateMembership(
  organizationId: string,
  actorUserId: string,
  actorRole: string,
  membershipId: string,
) {
  return updateMembership(organizationId, actorUserId, actorRole, membershipId, {
    isActive: false,
  });
}
