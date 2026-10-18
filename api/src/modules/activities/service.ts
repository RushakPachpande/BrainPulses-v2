import { Prisma, type AccessLevel, type ActivityKind, type MembershipRole } from '#prisma';
import { writeAudit } from '../../lib/audit.js';
import { invalidateDashboard } from '../../lib/cache.js';
import { nextHumanCode } from '../../lib/codes.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { buildPage, listEnvelope, prismaCursorArgs } from '../../lib/pagination.js';
import { prisma } from '../../lib/prisma.js';
import type { z } from 'zod';
import type {
  activityListQuerySchema,
  createActivitySchema,
  updateActivitySchema,
} from './schema.js';

const accessRank: Record<AccessLevel, number> = {
  none: 0,
  view: 1,
  edit: 2,
  full: 3,
};

export function assertActivityAccess(
  role: MembershipRole,
  assessmentAccess: AccessLevel,
  quizAccess: AccessLevel,
  kind: ActivityKind,
  min: AccessLevel,
) {
  if (role === 'super_admin') return;
  const level = kind === 'assessment' ? assessmentAccess : quizAccess;
  if (accessRank[level] < accessRank[min]) {
    throw forbidden('Insufficient access for this activity kind.');
  }
}

function mapActivity(a: {
  id: string;
  code: string;
  name: string;
  subtitle: string | null;
  kind: string;
  status: string;
  startsAt: Date | null;
  endsAt: Date | null;
  durationMinutes: number | null;
  passingPercent: Prisma.Decimal | null;
  presentation: string;
  _count?: { registrations: number; activityBanks: number; attempts: number };
  registrations?: { status: string }[];
}) {
  const registered = a._count?.registrations ?? 0;
  const assigned = a.registrations?.filter((r) => r.status === 'assigned').length ?? registered;
  return {
    id: a.id,
    code: a.code,
    name: a.name,
    subtitle: a.subtitle,
    kind: a.kind,
    status: a.status.charAt(0).toUpperCase() + a.status.slice(1),
    statusKey: a.status,
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    durationMinutes: a.durationMinutes,
    passingPercent: a.passingPercent ? Number(a.passingPercent) : null,
    presentation: a.presentation,
    registered,
    assigned,
    banks: a._count?.activityBanks ?? 0,
    attempts: a._count?.attempts ?? 0,
  };
}

export async function listActivities(
  organizationId: string,
  query: z.infer<typeof activityListQuerySchema>,
) {
  const where: Prisma.ActivityWhereInput = {
    organizationId,
    kind: query.kind,
    ...(query.status !== 'all' ? { status: query.status } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { code: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.activity.count({ where }),
    prisma.activity.findMany({
      where,
      include: {
        _count: { select: { registrations: true, activityBanks: true, attempts: true } },
        registrations: { select: { status: true } },
      },
      ...prismaCursorArgs(query),
    }),
  ]);

  const { items, page } = buildPage(rows, query.limit, total);
  return listEnvelope(items.map(mapActivity), page);
}

export async function getActivity(
  organizationId: string,
  id: string,
  actor?: {
    role: MembershipRole;
    assessmentAccess: AccessLevel;
    quizAccess: AccessLevel;
  },
) {
  const activity = await prisma.activity.findFirst({
    where: { organizationId, id },
    include: {
      _count: { select: { registrations: true, activityBanks: true, attempts: true } },
      registrations: { select: { status: true } },
      activityBanks: { include: { bank: true } },
    },
  });
  if (!activity) throw notFound('Activity not found.');
  if (actor) {
    assertActivityAccess(
      actor.role,
      actor.assessmentAccess,
      actor.quizAccess,
      activity.kind,
      'view',
    );
  }
  return {
    ...mapActivity(activity),
    bankIds: activity.activityBanks.map((ab) => ab.bankId),
  };
}

async function assertOrgBanksForKind(
  organizationId: string,
  kind: ActivityKind,
  bankIds: string[],
) {
  if (bankIds.length === 0) return;
  const unique = [...new Set(bankIds)];
  const banks = await prisma.questionBank.findMany({
    where: { organizationId, kind, id: { in: unique } },
    select: { id: true },
  });
  if (banks.length !== unique.length) {
    throw badRequest('One or more question banks are invalid for this organization and kind.');
  }
}

export async function createActivity(
  organizationId: string,
  actorUserId: string,
  actor: {
    role: MembershipRole;
    assessmentAccess: AccessLevel;
    quizAccess: AccessLevel;
  },
  input: z.infer<typeof createActivitySchema>,
) {
  assertActivityAccess(actor.role, actor.assessmentAccess, actor.quizAccess, input.kind, 'edit');
  await assertOrgBanksForKind(organizationId, input.kind, input.bankIds);
  const prefix = input.kind === 'assessment' ? 'ASM' : 'QUZ';
  const code = input.code ?? (await nextHumanCode(organizationId, prefix, 'activity'));

  try {
    const activity = await prisma.activity.create({
      data: {
        organizationId,
        kind: input.kind,
        code,
        name: input.name,
        subtitle: input.subtitle,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        durationMinutes: input.durationMinutes,
        passingPercent: input.passingPercent,
        presentation: input.presentation,
        activityBanks: {
          create: input.bankIds.map((bankId) => ({
            organizationId,
            bankId,
          })),
        },
      },
      include: {
        _count: { select: { registrations: true, activityBanks: true, attempts: true } },
        registrations: { select: { status: true } },
      },
    });

    await writeAudit({
      organizationId,
      actorType: 'user',
      actorUserId,
      action: 'activity.create',
      targetType: 'activity',
      targetId: activity.id,
    });
    await invalidateDashboard(organizationId);
    return mapActivity(activity);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw conflict('An activity with that code already exists.');
    }
    throw err;
  }
}

export async function updateActivity(
  organizationId: string,
  actorUserId: string,
  actor: {
    role: MembershipRole;
    assessmentAccess: AccessLevel;
    quizAccess: AccessLevel;
  },
  id: string,
  input: z.infer<typeof updateActivitySchema>,
) {
  const existing = await prisma.activity.findFirst({ where: { organizationId, id } });
  if (!existing) throw notFound('Activity not found.');
  assertActivityAccess(actor.role, actor.assessmentAccess, actor.quizAccess, existing.kind, 'edit');

  if (input.bankIds) {
    await assertOrgBanksForKind(organizationId, existing.kind, input.bankIds);
  }

  const activity = await prisma.$transaction(async (tx) => {
    if (input.bankIds) {
      await tx.activityBank.deleteMany({ where: { organizationId, activityId: id } });
      if (input.bankIds.length > 0) {
        await tx.activityBank.createMany({
          data: input.bankIds.map((bankId) => ({
            organizationId,
            activityId: id,
            bankId,
          })),
        });
      }
    }

    return tx.activity.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.subtitle !== undefined ? { subtitle: input.subtitle } : {}),
        ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
        ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
        ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}),
        ...(input.passingPercent !== undefined ? { passingPercent: input.passingPercent } : {}),
        ...(input.presentation !== undefined ? { presentation: input.presentation } : {}),
        ...(input.code !== undefined ? { code: input.code } : {}),
      },
      include: {
        _count: { select: { registrations: true, activityBanks: true, attempts: true } },
        registrations: { select: { status: true } },
      },
    });
  });

  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId,
    action: 'activity.update',
    targetType: 'activity',
    targetId: id,
  });
  await invalidateDashboard(organizationId);
  return mapActivity(activity);
}

export async function publishActivity(
  organizationId: string,
  actorUserId: string,
  actor: {
    role: MembershipRole;
    assessmentAccess: AccessLevel;
    quizAccess: AccessLevel;
  },
  id: string,
) {
  const existing = await prisma.activity.findFirst({ where: { organizationId, id } });
  if (!existing) throw notFound('Activity not found.');
  assertActivityAccess(actor.role, actor.assessmentAccess, actor.quizAccess, existing.kind, 'full');
  if (existing.status !== 'draft' && existing.status !== 'archived') {
    throw badRequest('Only draft or archived activities can be published.');
  }

  const activity = await prisma.activity.update({
    where: { id },
    data: { status: 'active' },
    include: {
      _count: { select: { registrations: true, activityBanks: true, attempts: true } },
      registrations: { select: { status: true } },
    },
  });

  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId,
    action: 'activity.publish',
    targetType: 'activity',
    targetId: id,
  });
  await invalidateDashboard(organizationId);
  return mapActivity(activity);
}

export async function archiveActivity(
  organizationId: string,
  actorUserId: string,
  actor: {
    role: MembershipRole;
    assessmentAccess: AccessLevel;
    quizAccess: AccessLevel;
  },
  id: string,
) {
  const existing = await prisma.activity.findFirst({ where: { organizationId, id } });
  if (!existing) throw notFound('Activity not found.');
  assertActivityAccess(actor.role, actor.assessmentAccess, actor.quizAccess, existing.kind, 'full');
  if (existing.status !== 'draft' && existing.status !== 'active') {
    throw badRequest('Only draft or active activities can be archived.');
  }

  const activity = await prisma.activity.update({
    where: { id },
    data: { status: 'archived' },
    include: {
      _count: { select: { registrations: true, activityBanks: true, attempts: true } },
      registrations: { select: { status: true } },
    },
  });

  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId,
    action: 'activity.archive',
    targetType: 'activity',
    targetId: id,
  });
  await invalidateDashboard(organizationId);
  return mapActivity(activity);
}
