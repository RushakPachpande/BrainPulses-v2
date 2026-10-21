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
  activityRoundInputSchema,
  createActivitySchema,
  createRoundQuestionSchema,
  updateActivitySchema,
} from './schema.js';

const accessRank: Record<AccessLevel, number> = {
  none: 0,
  view: 1,
  edit: 2,
  full: 3,
};

type AccessActor = {
  role: MembershipRole;
  assessmentAccess: AccessLevel;
  quizAccess: AccessLevel;
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

const roundInclude = {
  banks: { include: { bank: { select: { id: true, name: true, code: true } } } },
  localBank: {
    include: {
      _count: { select: { questions: true } },
      questions: {
        where: { isActive: true },
        include: {
          versions: {
            orderBy: { version: 'desc' as const },
            take: 1,
            include: {
              options: {
                orderBy: { sortOrder: 'asc' as const },
                select: { id: true, label: true, body: true, sortOrder: true },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ActivityRoundInclude;

function mapRound(r: Prisma.ActivityRoundGetPayload<{ include: typeof roundInclude }>) {
  const localQuestions = (r.localBank?.questions ?? []).map((q) => {
    const latest = q.versions[0];
    return {
      id: q.id,
      code: q.code,
      type: q.type,
      stem: q.stem,
      points: Number(q.points),
      isActive: q.isActive,
      options: latest?.options ?? [],
    };
  });
  return {
    id: r.id,
    name: r.name,
    sortOrder: r.sortOrder,
    durationMinutes: r.durationMinutes,
    bankIds: r.banks.map((b) => b.bankId),
    banksDetail: r.banks.map((b) => ({
      id: b.bank.id,
      name: b.bank.name,
      code: b.bank.code,
    })),
    localBankId: r.localBankId,
    localQuestionCount: r.localBank?._count.questions ?? localQuestions.length,
    localQuestions,
  };
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
  settings?: Prisma.JsonValue | null;
  _count?: { registrations: number; activityBanks: number; attempts: number; rounds?: number };
  registrations?: { status: string }[];
  rounds?: Array<
    | Prisma.ActivityRoundGetPayload<{ include: typeof roundInclude }>
    | { banks: { id: string }[]; sortOrder?: number }
  >;
}) {
  const registered = a._count?.registrations ?? 0;
  const assigned = a.registrations?.filter((r) => r.status === 'assigned').length ?? registered;
  const firstRound = a.rounds?.[0];
  const fullRounds =
    firstRound && 'name' in firstRound
      ? [...(a.rounds as Prisma.ActivityRoundGetPayload<{ include: typeof roundInclude }>[])]
          .sort((x, y) => x.sortOrder - y.sortOrder)
          .map(mapRound)
      : undefined;
  const bankCount =
    a.kind === 'assessment' && a.rounds
      ? a.rounds.reduce((n, r) => {
          if ('bankIds' in r && Array.isArray(r.bankIds)) return n + r.bankIds.length;
          if ('banks' in r && Array.isArray(r.banks)) return n + r.banks.length;
          return n;
        }, 0)
      : (a._count?.activityBanks ?? 0);
  const rounds = fullRounds;
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
    settings: a.settings ?? null,
    registered,
    assigned,
    banks: bankCount,
    attempts: a._count?.attempts ?? 0,
    ...(rounds ? { rounds } : {}),
  };
}

const listInclude = {
  _count: { select: { registrations: true, activityBanks: true, attempts: true, rounds: true } },
  registrations: { select: { status: true } },
  rounds: { select: { banks: { select: { id: true } } } },
} satisfies Prisma.ActivityInclude;

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
      include: listInclude,
      ...prismaCursorArgs(query),
    }),
  ]);

  const { items, page } = buildPage(rows, query.limit, total);
  return listEnvelope(items.map(mapActivity), page);
}

export async function getActivity(organizationId: string, id: string, actor?: AccessActor) {
  const activity = await prisma.activity.findFirst({
    where: { organizationId, id },
    include: {
      ...listInclude,
      activityBanks: { include: { bank: true } },
      rounds: { include: roundInclude, orderBy: { sortOrder: 'asc' } },
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

  const mapped = mapActivity(activity);
  if (activity.kind === 'assessment') {
    return {
      ...mapped,
      bankIds: mapped.rounds?.flatMap((r) => r.bankIds) ?? [],
      banksDetail: mapped.rounds?.flatMap((r) => r.banksDetail) ?? [],
      rounds: mapped.rounds ?? [],
    };
  }

  return {
    ...mapped,
    bankIds: activity.activityBanks.map((ab) => ab.bankId),
    banksDetail: activity.activityBanks.map((ab) => ({
      id: ab.bank.id,
      name: ab.bank.name,
      code: ab.bank.code,
    })),
  };
}

async function assertReusableBanksForKind(
  organizationId: string,
  kind: ActivityKind,
  bankIds: string[],
) {
  if (bankIds.length === 0) return;
  const unique = [...new Set(bankIds)];
  const banks = await prisma.questionBank.findMany({
    where: {
      organizationId,
      kind,
      id: { in: unique },
      origin: 'reusable',
    },
    select: { id: true },
  });
  if (banks.length !== unique.length) {
    throw badRequest('One or more question banks are invalid for this organization and kind.');
  }
}

type RoundInput = z.infer<typeof activityRoundInputSchema>;

async function replaceRounds(
  // Prisma interactive-transaction client (extension-aware)
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends' | '$use'
  >,
  organizationId: string,
  activityId: string,
  rounds: RoundInput[],
) {
  const existing = await tx.activityRound.findMany({
    where: { organizationId, activityId },
    select: { id: true, localBankId: true },
  });
  const keepIds = new Set(rounds.map((r) => r.id).filter((id): id is string => Boolean(id)));
  const toDelete = existing.filter((r) => !keepIds.has(r.id));

  if (toDelete.length > 0) {
    const attemptCount = await tx.attempt.count({
      where: { roundId: { in: toDelete.map((r) => r.id) } },
    });
    if (attemptCount > 0) {
      throw badRequest('Cannot remove rounds that already have student attempts.');
    }
  }

  for (const r of toDelete) {
    await tx.activityRoundBank.deleteMany({ where: { roundId: r.id } });
    await tx.activityRound.update({ where: { id: r.id }, data: { localBankId: null } });
    await tx.activityRound.delete({ where: { id: r.id } });
    if (r.localBankId) {
      await tx.question.deleteMany({ where: { bankId: r.localBankId } });
      await tx.questionBank.delete({ where: { id: r.localBankId } }).catch(() => undefined);
    }
  }

  const allBankIds = rounds.flatMap((r) => r.bankIds);
  await assertReusableBanksForKind(organizationId, 'assessment', allBankIds);

  for (const round of rounds) {
    if (round.id && keepIds.has(round.id)) {
      await tx.activityRound.update({
        where: { id: round.id },
        data: {
          name: round.name,
          sortOrder: round.sortOrder,
          durationMinutes: round.durationMinutes ?? null,
        },
      });
      await tx.activityRoundBank.deleteMany({ where: { roundId: round.id } });
      if (round.bankIds.length > 0) {
        await tx.activityRoundBank.createMany({
          data: [...new Set(round.bankIds)].map((bankId) => ({
            organizationId,
            roundId: round.id!,
            bankId,
          })),
        });
      }
    } else {
      const created = await tx.activityRound.create({
        data: {
          organizationId,
          activityId,
          name: round.name,
          sortOrder: round.sortOrder,
          durationMinutes: round.durationMinutes ?? null,
          banks: {
            create: [...new Set(round.bankIds)].map((bankId) => ({
              organizationId,
              bankId,
            })),
          },
        },
      });
      void created;
    }
  }
}

function normalizeAssessmentRounds(
  input: z.infer<typeof createActivitySchema> | z.infer<typeof updateActivitySchema>,
): RoundInput[] | undefined {
  if ('rounds' in input && input.rounds !== undefined) return input.rounds;
  if ('bankIds' in input && input.bankIds && input.bankIds.length > 0) {
    return [
      {
        name: 'Round 1',
        sortOrder: 0,
        bankIds: input.bankIds,
      },
    ];
  }
  return undefined;
}

export async function createActivity(
  organizationId: string,
  actorUserId: string,
  actor: AccessActor,
  input: z.infer<typeof createActivitySchema>,
) {
  assertActivityAccess(actor.role, actor.assessmentAccess, actor.quizAccess, input.kind, 'edit');
  const prefix = input.kind === 'assessment' ? 'ASM' : 'QUZ';
  const code = input.code ?? (await nextHumanCode(organizationId, prefix, 'activity'));

  try {
    if (input.kind === 'quiz') {
      await assertReusableBanksForKind(organizationId, input.kind, input.bankIds);
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
          settings: input.settings ?? undefined,
          activityBanks: {
            create: input.bankIds.map((bankId) => ({
              organizationId,
              bankId,
            })),
          },
        },
        include: listInclude,
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
    }

    const rounds = normalizeAssessmentRounds(input) ?? [];
    if (rounds.length > 0) {
      await assertReusableBanksForKind(
        organizationId,
        'assessment',
        rounds.flatMap((r) => r.bankIds),
      );
    }

    const activity = await prisma.activity.create({
      data: {
        organizationId,
        kind: 'assessment',
        code,
        name: input.name,
        subtitle: input.subtitle,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        durationMinutes: input.durationMinutes,
        passingPercent: input.passingPercent,
        presentation: input.presentation,
        settings: input.settings ?? undefined,
        rounds: {
          create: rounds.map((round) => ({
            organizationId,
            name: round.name,
            sortOrder: round.sortOrder,
            durationMinutes: round.durationMinutes ?? null,
            banks: {
              create: [...new Set(round.bankIds)].map((bankId) => ({
                organizationId,
                bankId,
              })),
            },
          })),
        },
      },
      include: {
        ...listInclude,
        rounds: { include: roundInclude, orderBy: { sortOrder: 'asc' } },
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
  actor: AccessActor,
  id: string,
  input: z.infer<typeof updateActivitySchema>,
) {
  const existing = await prisma.activity.findFirst({ where: { organizationId, id } });
  if (!existing) throw notFound('Activity not found.');
  assertActivityAccess(actor.role, actor.assessmentAccess, actor.quizAccess, existing.kind, 'edit');

  if (existing.kind === 'quiz' && input.rounds) {
    throw badRequest('Quizzes do not support rounds.');
  }

  const activity = await prisma.$transaction(async (tx) => {
    if (existing.kind === 'quiz' && input.bankIds) {
      await assertReusableBanksForKind(organizationId, existing.kind, input.bankIds);
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

    if (existing.kind === 'assessment') {
      const rounds = normalizeAssessmentRounds(input);
      if (rounds !== undefined) {
        await replaceRounds(tx, organizationId, id, rounds);
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
        ...(input.settings !== undefined ? { settings: input.settings } : {}),
      },
      include: {
        ...listInclude,
        rounds: { include: roundInclude, orderBy: { sortOrder: 'asc' } },
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

async function roundHasQuestions(organizationId: string, roundId: string): Promise<boolean> {
  const round = await prisma.activityRound.findFirst({
    where: { organizationId, id: roundId },
    include: {
      banks: {
        include: {
          bank: { include: { _count: { select: { questions: { where: { isActive: true } } } } } },
        },
      },
      localBank: { include: { _count: { select: { questions: { where: { isActive: true } } } } } },
    },
  });
  if (!round) return false;
  const fromBanks = round.banks.reduce((n, b) => n + b.bank._count.questions, 0);
  const fromLocal = round.localBank?._count.questions ?? 0;
  return fromBanks + fromLocal > 0;
}

export async function publishActivity(
  organizationId: string,
  actorUserId: string,
  actor: AccessActor,
  id: string,
) {
  const existing = await prisma.activity.findFirst({
    where: { organizationId, id },
    include: {
      rounds: { select: { id: true } },
      activityBanks: { select: { id: true } },
    },
  });
  if (!existing) throw notFound('Activity not found.');
  assertActivityAccess(actor.role, actor.assessmentAccess, actor.quizAccess, existing.kind, 'full');
  if (existing.status !== 'draft' && existing.status !== 'archived') {
    throw badRequest('Only draft or archived activities can be published.');
  }

  if (existing.kind === 'assessment') {
    if (existing.rounds.length === 0) {
      throw badRequest('Publish requires at least one round with questions.');
    }
    for (const round of existing.rounds) {
      const ok = await roundHasQuestions(organizationId, round.id);
      if (!ok) {
        throw badRequest('Each round must have at least one question (linked bank or manual).');
      }
    }
  } else if (existing.activityBanks.length === 0) {
    throw badRequest('Publish requires at least one question bank.');
  }

  const activity = await prisma.activity.update({
    where: { id },
    data: { status: 'active' },
    include: {
      ...listInclude,
      rounds: { include: roundInclude, orderBy: { sortOrder: 'asc' } },
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
  actor: AccessActor,
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
      ...listInclude,
      rounds: { include: roundInclude, orderBy: { sortOrder: 'asc' } },
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

async function ensureRoundLocalBank(
  organizationId: string,
  activityId: string,
  roundId: string,
  activityKind: ActivityKind,
) {
  const round = await prisma.activityRound.findFirst({
    where: { organizationId, id: roundId, activityId },
  });
  if (!round) throw notFound('Round not found.');
  if (round.localBankId) return round.localBankId;

  const code = await nextHumanCode(organizationId, 'QB', 'bank');
  const bank = await prisma.questionBank.create({
    data: {
      organizationId,
      kind: activityKind,
      code,
      name: `${round.name} (local)`,
      origin: 'round_local',
      status: 'active',
    },
  });
  await prisma.activityRound.update({
    where: { id: roundId },
    data: { localBankId: bank.id },
  });
  return bank.id;
}

export async function listRoundQuestions(
  organizationId: string,
  actor: AccessActor,
  activityId: string,
  roundId: string,
) {
  const activity = await prisma.activity.findFirst({ where: { organizationId, id: activityId } });
  if (!activity) throw notFound('Activity not found.');
  if (activity.kind !== 'assessment') throw badRequest('Rounds are only available on assessments.');
  assertActivityAccess(actor.role, actor.assessmentAccess, actor.quizAccess, activity.kind, 'view');

  const round = await prisma.activityRound.findFirst({
    where: { organizationId, id: roundId, activityId },
    include: roundInclude,
  });
  if (!round) throw notFound('Round not found.');
  return mapRound(round).localQuestions;
}

export async function createRoundQuestion(
  organizationId: string,
  actorUserId: string,
  actor: AccessActor,
  activityId: string,
  roundId: string,
  input: z.infer<typeof createRoundQuestionSchema>,
) {
  const activity = await prisma.activity.findFirst({ where: { organizationId, id: activityId } });
  if (!activity) throw notFound('Activity not found.');
  if (activity.kind !== 'assessment') throw badRequest('Rounds are only available on assessments.');
  assertActivityAccess(actor.role, actor.assessmentAccess, actor.quizAccess, activity.kind, 'edit');

  const localBankId = await ensureRoundLocalBank(
    organizationId,
    activityId,
    roundId,
    activity.kind,
  );

  const code = input.code ?? `Q-${Date.now().toString(36)}`;
  const options = input.options ?? [];
  const answerKey =
    input.answerKey && Object.keys(input.answerKey).length > 0
      ? input.answerKey
      : {
          correctLabels: options.filter((o) => o.isCorrect).map((o) => o.label),
        };

  const question = await prisma.question.create({
    data: {
      organizationId,
      bankId: localBankId,
      code,
      type: input.type,
      stem: input.stem,
      points: input.points,
    },
  });

  const version = await prisma.questionVersion.create({
    data: {
      organizationId,
      questionId: question.id,
      version: 1,
      type: input.type,
      stem: input.stem,
      points: input.points,
      answerKey: answerKey as Prisma.InputJsonValue,
    },
  });

  if (options.length > 0) {
    await prisma.questionOption.createMany({
      data: options.map((o, i) => ({
        questionId: question.id,
        questionVersionId: version.id,
        label: o.label,
        body: o.body,
        imageUrl: o.imageUrl ?? null,
        sortOrder: i,
        isCorrect: o.isCorrect,
      })),
    });
  }

  const createdOptions = await prisma.questionOption.findMany({
    where: { questionVersionId: version.id },
    orderBy: { sortOrder: 'asc' },
  });

  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId,
    action: 'round.question.create',
    targetType: 'question',
    targetId: question.id,
  });

  return {
    id: question.id,
    code: question.code,
    type: question.type,
    stem: question.stem,
    points: Number(question.points),
    isActive: question.isActive,
    options: createdOptions.map((o) => ({
      id: o.id,
      label: o.label,
      body: o.body,
      sortOrder: o.sortOrder,
    })),
  };
}

export async function deleteRoundQuestion(
  organizationId: string,
  actorUserId: string,
  actor: AccessActor,
  activityId: string,
  roundId: string,
  questionId: string,
) {
  const activity = await prisma.activity.findFirst({ where: { organizationId, id: activityId } });
  if (!activity) throw notFound('Activity not found.');
  if (activity.kind !== 'assessment') throw badRequest('Rounds are only available on assessments.');
  assertActivityAccess(actor.role, actor.assessmentAccess, actor.quizAccess, activity.kind, 'edit');

  const round = await prisma.activityRound.findFirst({
    where: { organizationId, id: roundId, activityId },
  });
  if (!round?.localBankId) throw notFound('Question not found.');

  const question = await prisma.question.findFirst({
    where: { organizationId, id: questionId, bankId: round.localBankId },
  });
  if (!question) throw notFound('Question not found.');

  await prisma.question.delete({ where: { id: questionId } });

  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId,
    action: 'round.question.delete',
    targetType: 'question',
    targetId: questionId,
  });
}
