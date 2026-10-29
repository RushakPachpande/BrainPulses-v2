import { Prisma, type AccessLevel, type ActivityKind, type MembershipRole } from '#prisma';
import { activityStatusDisplay } from '../../lib/activity-status.js';
import { writeAudit } from '../../lib/audit.js';
import { invalidateDashboard } from '../../lib/cache.js';
import { nextHumanCode } from '../../lib/codes.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { buildPage, listEnvelope, prismaCursorArgs } from '../../lib/pagination.js';
import { prisma } from '../../lib/prisma.js';
import { parseQuizSettings } from '../../lib/quiz-settings.js';
import { saveSharedPassage, stripPassageText } from '../banks/passages.js';
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
      question: q.question,
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
  instructions?: string | null;
  kind: string;
  status: string;
  startsAt: Date | null;
  endsAt: Date | null;
  durationMinutes: number | null;
  durationMode?: 'overall' | 'per_question';
  perQuestionSeconds?: number | null;
  passingPercent: Prisma.Decimal | null;
  presentation: string;
  imageFileId?: string | null;
  sponsorId?: string | null;
  contestId?: string | null;
  sponsor?: { id: string; name: string } | null;
  contest?: { id: string; name: string } | null;
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
  const statusDisplay = activityStatusDisplay(a.status, a.startsAt, a.endsAt);
  const row = {
    id: a.id,
    code: a.code,
    name: a.name,
    subtitle: a.subtitle,
    instructions: a.instructions ?? null,
    kind: a.kind,
    status: statusDisplay,
    statusKey: a.status,
    statusDisplay,
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    durationMinutes: a.durationMinutes,
    durationMode: a.durationMode ?? 'overall',
    perQuestionSeconds: a.perQuestionSeconds ?? null,
    passingPercent: a.passingPercent ? Number(a.passingPercent) : null,
    presentation: a.presentation,
    imageFileId: a.imageFileId ?? null,
    sponsorId: a.sponsorId ?? null,
    contestId: a.contestId ?? null,
    sponsor: a.sponsor ? { id: a.sponsor.id, name: a.sponsor.name } : null,
    contest: a.contest ? { id: a.contest.id, name: a.contest.name } : null,
    settings: a.kind === 'quiz' ? normalizeQuizSettingsJson(a.settings) : (a.settings ?? null),
    registered,
    assigned,
    banks: bankCount,
    attempts: a._count?.attempts ?? 0,
    ...(rounds ? { rounds } : {}),
  };
  if (a.kind === 'quiz') {
    const { code: _quizCode, ...withoutCode } = row;
    return withoutCode;
  }
  return row;
}

const listInclude = {
  _count: { select: { registrations: true, activityBanks: true, attempts: true, rounds: true } },
  registrations: { select: { status: true } },
  rounds: { select: { banks: { select: { id: true } } } },
  sponsor: { select: { id: true, name: true } },
  contest: { select: { id: true, name: true } },
} satisfies Prisma.ActivityInclude;

export async function listActivities(
  organizationId: string,
  query: z.infer<typeof activityListQuerySchema>,
) {
  const now = new Date();
  let statusWhere: Prisma.ActivityWhereInput = {};
  if (query.status === 'scheduled') {
    statusWhere = { status: 'active', startsAt: { gt: now } };
  } else if (query.status === 'expired') {
    statusWhere = { status: 'active', endsAt: { lt: now } };
  } else if (query.status === 'active') {
    statusWhere = {
      status: 'active',
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    };
  } else if (query.status !== 'all') {
    statusWhere = { status: query.status };
  }

  const where: Prisma.ActivityWhereInput = {
    organizationId,
    kind: query.kind,
    ...statusWhere,
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            ...(query.kind === 'assessment'
              ? [{ code: { contains: query.q, mode: 'insensitive' as const } }]
              : []),
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
    select: {
      id: true,
      questions: { where: { isActive: true }, select: { type: true } },
    },
  });
  if (banks.length !== unique.length) {
    throw badRequest('One or more question banks are invalid for this organization and kind.');
  }
  if (kind === 'quiz') {
    const allowed = new Set(['single_mcq', 'image_mcq']);
    for (const bank of banks) {
      const bad = bank.questions.find((q) => !allowed.has(q.type));
      if (bad) {
        throw badRequest(
          'Quiz activities only accept banks whose questions are single choice (or legacy image_mcq).',
        );
      }
    }
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

function normalizeQuizSettingsJson(settings: Prisma.JsonValue | null | undefined) {
  const parsed = parseQuizSettings(settings);
  const base =
    settings && typeof settings === 'object' && !Array.isArray(settings)
      ? { ...(settings as Record<string, unknown>) }
      : {};
  return { ...base, quiz: parsed };
}

async function ensureQuizLocalBank(
  organizationId: string,
  activityId: string,
  activityName: string,
) {
  const links = await prisma.activityBank.findMany({
    where: { organizationId, activityId },
    include: { bank: { select: { id: true, origin: true, kind: true } } },
  });
  const local = links.find((link) => link.bank.origin === 'quiz_local');
  if (local) return local.bankId;

  if (links.length === 1) {
    const only = links[0]!;
    const shared = await prisma.activityBank.count({ where: { bankId: only.bankId } });
    if (shared === 1 && only.bank.kind === 'quiz') {
      await prisma.questionBank.update({
        where: { id: only.bankId },
        data: { origin: 'quiz_local' },
      });
      return only.bankId;
    }
  }

  if (links.length > 0) return links[0]!.bankId;

  const code = await nextHumanCode(organizationId, 'QB', 'bank');
  const bank = await prisma.questionBank.create({
    data: {
      organizationId,
      kind: 'quiz',
      code,
      name: `${activityName} questions`.slice(0, 200),
      origin: 'quiz_local',
      status: 'active',
    },
  });
  await prisma.activityBank.create({
    data: { organizationId, activityId, bankId: bank.id },
  });
  return bank.id;
}

async function assertSponsorContest(organizationId: string, sponsorId: string, contestId: string) {
  const contest = await prisma.contest.findFirst({
    where: { organizationId, id: contestId, sponsorId },
    select: { id: true },
  });
  if (!contest) throw badRequest('Contest must belong to the selected sponsor.');
}

function quizTimingWrite(input: {
  durationMode?: 'overall' | 'per_question' | null;
  durationMinutes?: number | null;
  perQuestionSeconds?: number | null;
}) {
  const mode = input.durationMode ?? 'overall';
  if (mode === 'per_question') {
    if (!input.perQuestionSeconds || input.perQuestionSeconds <= 0) {
      throw badRequest('Enter a time in seconds for each question.');
    }
    return {
      durationMode: 'per_question' as const,
      durationMinutes: null,
      perQuestionSeconds: input.perQuestionSeconds,
    };
  }
  if (!input.durationMinutes || input.durationMinutes <= 0) {
    throw badRequest('Enter the overall quiz duration in minutes.');
  }
  return {
    durationMode: 'overall' as const,
    durationMinutes: input.durationMinutes,
    perQuestionSeconds: null,
  };
}

export async function createActivity(
  organizationId: string,
  actorUserId: string,
  actor: AccessActor,
  input: z.infer<typeof createActivitySchema>,
) {
  assertActivityAccess(actor.role, actor.assessmentAccess, actor.quizAccess, input.kind, 'edit');
  const prefix = input.kind === 'assessment' ? 'ASM' : 'QUZ';
  const code =
    input.kind === 'quiz'
      ? await nextHumanCode(organizationId, prefix, 'activity')
      : (input.code ?? (await nextHumanCode(organizationId, prefix, 'activity')));

  try {
    if (input.kind === 'quiz') {
      if (!input.sponsorId || !input.contestId || !input.startsAt || !input.endsAt) {
        throw badRequest('A quiz needs a sponsor, a contest, and a start and end.');
      }
      if (input.endsAt <= input.startsAt) throw badRequest('End must be after start.');
      await assertSponsorContest(organizationId, input.sponsorId, input.contestId);
      const timing = quizTimingWrite(input);
      const activity = await prisma.activity.create({
        data: {
          organizationId,
          kind: input.kind,
          code,
          name: input.name,
          subtitle: input.subtitle,
          instructions: input.instructions?.trim() || null,
          imageFileId: input.imageFileId ?? null,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          durationMinutes: timing.durationMinutes,
          durationMode: timing.durationMode,
          perQuestionSeconds: timing.perQuestionSeconds,
          sponsorId: input.sponsorId,
          contestId: input.contestId,
          passingPercent: input.passingPercent,
          presentation:
            timing.durationMode === 'per_question' ? 'one_at_a_time' : input.presentation,
          settings: input.settings ?? undefined,
        },
        include: listInclude,
      });
      await ensureQuizLocalBank(organizationId, activity.id, activity.name);

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
        instructions: input.instructions?.trim() || null,
        imageFileId: input.imageFileId ?? null,
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
  if (existing.kind === 'quiz' && input.code !== undefined) {
    throw badRequest('Quizzes do not use a code.');
  }

  let quizPatch: {
    sponsorId: string;
    contestId: string;
    startsAt: Date;
    endsAt: Date;
    durationMode: 'overall' | 'per_question';
    durationMinutes: number | null;
    perQuestionSeconds: number | null;
  } | null = null;

  if (existing.kind === 'quiz') {
    const sponsorId = input.sponsorId !== undefined ? input.sponsorId : existing.sponsorId;
    const contestId = input.contestId !== undefined ? input.contestId : existing.contestId;
    const startsAt = input.startsAt !== undefined ? input.startsAt : existing.startsAt;
    const endsAt = input.endsAt !== undefined ? input.endsAt : existing.endsAt;
    if (!sponsorId || !contestId) throw badRequest('A quiz needs a sponsor and a contest.');
    if (!startsAt || !endsAt) throw badRequest('A quiz needs a start and an end.');
    if (endsAt <= startsAt) throw badRequest('End must be after start.');
    await assertSponsorContest(organizationId, sponsorId, contestId);
    const timing = quizTimingWrite({
      durationMode: input.durationMode ?? existing.durationMode,
      durationMinutes:
        input.durationMinutes !== undefined ? input.durationMinutes : existing.durationMinutes,
      perQuestionSeconds:
        input.perQuestionSeconds !== undefined
          ? input.perQuestionSeconds
          : existing.perQuestionSeconds,
    });
    quizPatch = { sponsorId, contestId, startsAt, endsAt, ...timing };
  }

  const activity = await prisma.$transaction(async (tx) => {
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
        ...(input.instructions !== undefined
          ? { instructions: input.instructions?.trim() || null }
          : {}),
        ...(input.imageFileId !== undefined ? { imageFileId: input.imageFileId } : {}),
        ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
        ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
        ...(existing.kind === 'assessment' && input.durationMinutes !== undefined
          ? { durationMinutes: input.durationMinutes }
          : {}),
        ...(input.passingPercent !== undefined ? { passingPercent: input.passingPercent } : {}),
        ...(quizPatch?.durationMode === 'per_question'
          ? { presentation: 'one_at_a_time' as const }
          : input.presentation !== undefined
            ? { presentation: input.presentation }
            : {}),
        ...(existing.kind === 'assessment' && input.code !== undefined ? { code: input.code } : {}),
        ...(quizPatch
          ? {
              sponsorId: quizPatch.sponsorId,
              contestId: quizPatch.contestId,
              startsAt: quizPatch.startsAt,
              endsAt: quizPatch.endsAt,
              durationMode: quizPatch.durationMode,
              durationMinutes: quizPatch.durationMinutes,
              perQuestionSeconds: quizPatch.perQuestionSeconds,
            }
          : {}),
        ...(input.settings !== undefined ? { settings: input.settings } : {}),
      },
      include: {
        ...listInclude,
        rounds: { include: roundInclude, orderBy: { sortOrder: 'asc' } },
      },
    });
  });

  if (existing.kind === 'quiz') {
    await ensureQuizLocalBank(organizationId, id, input.name ?? existing.name);
  }

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
  idempotencyKey?: string,
) {
  if (idempotencyKey) {
    const prior = await prisma.auditEvent.findFirst({
      where: {
        organizationId,
        action: 'activity.publish',
        targetId: id,
        metadata: { path: ['idempotencyKey'], equals: idempotencyKey },
      },
    });
    if (prior) {
      return getActivity(organizationId, id, actor);
    }
  }

  const existing = await prisma.activity.findFirst({
    where: { organizationId, id },
    include: {
      rounds: { select: { id: true } },
      activityBanks: { select: { id: true } },
    },
  });
  if (!existing) throw notFound('Activity not found.');
  assertActivityAccess(actor.role, actor.assessmentAccess, actor.quizAccess, existing.kind, 'full');

  // Already published — safe retry (e.g. client never saw the first response).
  if (existing.status === 'active') {
    return getActivity(organizationId, id, actor);
  }
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
    metadata: { idempotencyKey },
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

/**
 * Permanently deletes a quiz and all related student data (attempts, results,
 * registrations, reattempt grants, bank links). The quiz's private question
 * bank is removed. Shared assessment banks are kept.
 */
export async function deleteActivity(
  organizationId: string,
  actorUserId: string,
  actor: AccessActor,
  id: string,
) {
  const existing = await prisma.activity.findFirst({
    where: { organizationId, id },
    select: { id: true, kind: true },
  });
  if (!existing) throw notFound('Activity not found.');
  assertActivityAccess(actor.role, actor.assessmentAccess, actor.quizAccess, existing.kind, 'full');
  if (existing.kind !== 'quiz') {
    throw badRequest('Only quizzes can be permanently deleted.');
  }

  await prisma.$transaction(async (tx) => {
    const localBankIds = (
      await tx.activityBank.findMany({
        where: { organizationId, activityId: id, bank: { origin: 'quiz_local' } },
        select: { bankId: true },
      })
    ).map((row) => row.bankId);
    // Attempts first: round FK is Restrict; responses/results cascade from attempt.
    await tx.attempt.deleteMany({ where: { organizationId, activityId: id } });
    await tx.result.deleteMany({ where: { organizationId, activityId: id } });
    await tx.reattemptGrant.deleteMany({ where: { organizationId, activityId: id } });
    await tx.registration.deleteMany({ where: { organizationId, activityId: id } });
    // Cascades activityBanks / rounds / round banks.
    await tx.activity.delete({ where: { id } });
    if (localBankIds.length > 0) {
      await tx.questionBank.deleteMany({
        where: {
          id: { in: localBankIds },
          origin: 'quiz_local',
          activityBanks: { none: {} },
        },
      });
    }
  });

  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId,
    action: 'activity.delete',
    targetType: 'activity',
    targetId: id,
    metadata: { kind: 'quiz' },
  });
  await invalidateDashboard(organizationId);
  return { id, deleted: true as const };
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
  const rawKey: Record<string, unknown> =
    input.answerKey && Object.keys(input.answerKey).length > 0
      ? { ...input.answerKey }
      : {
          correctLabels: options.filter((o) => o.isCorrect).map((o) => o.label),
        };
  if (!Array.isArray(rawKey.correctLabels)) {
    rawKey.correctLabels = options.filter((o) => o.isCorrect).map((o) => o.label);
  }
  const fromQuestion =
    typeof rawKey.questionImageUrl === 'string' ? rawKey.questionImageUrl.trim() : '';
  const fromStem = typeof rawKey.stemImageUrl === 'string' ? rawKey.stemImageUrl.trim() : '';
  delete rawKey.stemImageUrl;
  if (fromQuestion || fromStem) rawKey.questionImageUrl = fromQuestion || fromStem;
  else delete rawKey.questionImageUrl;

  let passageId: string | null = null;
  let sortOrder = 0;
  if (input.type === 'comprehension_mcq') {
    const body = typeof rawKey.passageText === 'string' ? rawKey.passageText : '';
    const saved = await saveSharedPassage({
      organizationId,
      bankId: localBankId,
      body,
    });
    passageId = saved.passageId;
    sortOrder = saved.sortOrder;
  }
  const answerKey = stripPassageText(rawKey);

  const question = await prisma.question.create({
    data: {
      organizationId,
      bankId: localBankId,
      code,
      type: input.type,
      question: input.question,
      points: input.points,
      passageId,
      sortOrder,
    },
  });

  const version = await prisma.questionVersion.create({
    data: {
      organizationId,
      questionId: question.id,
      version: 1,
      type: input.type,
      question: input.question,
      points: input.points,
      answerKey: answerKey as Prisma.InputJsonValue,
      passageId,
    },
  });

  if (options.length > 0) {
    await prisma.questionOption.createMany({
      data: options.map((o, i) => ({
        questionId: question.id,
        questionVersionId: version.id,
        label: o.label,
        body: o.body ?? '',
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
    question: question.question,
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
