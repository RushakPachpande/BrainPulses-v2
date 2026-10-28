import { Prisma } from '#prisma';
import { writeAudit } from '../../lib/audit.js';
import { invalidateDashboard } from '../../lib/cache.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { parseQuizSettings, shuffleInPlace } from '../../lib/quiz-settings.js';
import { scoreObjective, toNumber } from './scoring.js';

type OptionRow = {
  id: string;
  label: string;
  body: string;
  sortOrder: number;
  imageUrl?: string | null;
};
type OptionOrders = Record<string, string[]>;

async function autoSubmitIfExpired(attempt: {
  id: string;
  organizationId: string;
  status: string;
  deadlineAt: Date;
  activityId: string;
  studentId: string;
  revision: number;
}) {
  if (attempt.status !== 'in_progress') return attempt;
  if (attempt.deadlineAt.getTime() > Date.now()) return attempt;

  return submitAttemptInternal(attempt.organizationId, attempt.id, attempt.studentId, {
    auto: true,
    idempotencyKey: `auto:${attempt.id}`,
  });
}

type AttemptPresentation = 'one_at_a_time' | 'all_on_page' | 'timed_card';

type AttemptMapExtras = {
  activityKind?: string;
  softProctoring?: boolean;
  presentation?: AttemptPresentation | string | null;
  durationMode?: 'overall' | 'per_question' | string | null;
  perQuestionSeconds?: number | null;
};

function mapAttempt(
  a: {
    id: string;
    status: string;
    revision: number;
    startedAt: Date;
    deadlineAt: Date;
    submittedAt: Date | null;
    activityId: string;
    roundId?: string | null;
    studentId: string;
    disqualified?: boolean;
    isAuthoritative?: boolean;
    responses?: {
      questionVersionId: string;
      answer: Prisma.JsonValue;
      revision: number;
    }[];
  },
  extras?: AttemptMapExtras,
) {
  const presentation =
    extras?.presentation === 'all_on_page' || extras?.presentation === 'timed_card'
      ? extras.presentation
      : 'one_at_a_time';
  return {
    id: a.id,
    status: a.status,
    revision: a.revision,
    startedAt: a.startedAt,
    deadlineAt: a.deadlineAt,
    submittedAt: a.submittedAt,
    activityId: a.activityId,
    roundId: a.roundId ?? null,
    studentId: a.studentId,
    disqualified: a.disqualified ?? false,
    isAuthoritative: a.isAuthoritative ?? true,
    activityKind: extras?.activityKind ?? null,
    softProctoring: extras?.softProctoring ?? false,
    presentation,
    durationMode: extras?.durationMode === 'per_question' ? 'per_question' : 'overall',
    perQuestionSeconds:
      typeof extras?.perQuestionSeconds === 'number' && extras.perQuestionSeconds > 0
        ? extras.perQuestionSeconds
        : null,
    responses: (a.responses ?? []).map((r) => ({
      questionVersionId: r.questionVersionId,
      answer: r.answer,
      revision: r.revision,
    })),
  };
}

function extrasFromActivity(activity: {
  kind: string;
  presentation?: string | null;
  durationMode?: string | null;
  perQuestionSeconds?: number | null;
}): AttemptMapExtras {
  return {
    activityKind: activity.kind,
    softProctoring: activity.kind === 'quiz',
    presentation: activity.presentation,
    durationMode: activity.durationMode,
    perQuestionSeconds: activity.perQuestionSeconds ?? null,
  };
}

async function presentQuestions(
  organizationId: string,
  versionIds: string[],
  optionOrders: OptionOrders | null,
) {
  const versions = await prisma.questionVersion.findMany({
    where: { organizationId, id: { in: versionIds } },
    include: {
      options: {
        orderBy: { sortOrder: 'asc' },
        select: { id: true, label: true, body: true, sortOrder: true, imageUrl: true },
      },
    },
  });
  const byId = new Map(versions.map((v) => [v.id, v]));
  return versionIds
    .map((id) => byId.get(id))
    .filter((v): v is NonNullable<typeof v> => Boolean(v))
    .map((v) => {
      let options: OptionRow[] = v.options;
      const order = optionOrders?.[v.id];
      if (order && order.length > 0) {
        const optById = new Map(options.map((o) => [o.id, o]));
        options = order.map((oid) => optById.get(oid)).filter((o): o is OptionRow => Boolean(o));
      }
      const key =
        v.answerKey && typeof v.answerKey === 'object' && !Array.isArray(v.answerKey)
          ? (v.answerKey as Record<string, unknown>)
          : {};
      const passageText = typeof key.passageText === 'string' ? key.passageText : undefined;
      const questionImageUrl =
        typeof key.questionImageUrl === 'string'
          ? key.questionImageUrl
          : typeof key.stemImageUrl === 'string'
            ? key.stemImageUrl
            : undefined;
      return {
        questionVersionId: v.id,
        type: v.type,
        question: v.question,
        points: toNumber(v.points),
        options: options.map((o) => ({
          id: o.id,
          label: o.label,
          body: o.body,
          sortOrder: o.sortOrder,
          ...(o.imageUrl ? { imageUrl: o.imageUrl } : {}),
        })),
        ...(passageText ? { passageText } : {}),
        ...(questionImageUrl ? { questionImageUrl } : {}),
      };
    });
}

async function presentOpenQuizAttempt(attemptId: string, organizationId: string) {
  const live = await prisma.attempt.findFirst({
    where: { id: attemptId },
    include: {
      responses: true,
      activity: {
        select: { kind: true, presentation: true, durationMode: true, perQuestionSeconds: true },
      },
    },
  });
  if (!live) throw notFound('Attempt not found.');
  const order =
    live.questionOrder.length > 0
      ? live.questionOrder
      : live.responses.map((r) => r.questionVersionId);
  const optionOrders = (live.optionOrders as OptionOrders | null) ?? null;
  const questions = await presentQuestions(organizationId, order, optionOrders);
  return {
    attempt: mapAttempt(live, extrasFromActivity(live.activity)),
    questions,
  };
}

function buildShuffleOrders(
  versionIds: string[],
  optionsByVersion: Map<string, OptionRow[]>,
  shuffleQuestions: boolean,
  shuffleOptions: boolean,
): { questionOrder: string[]; optionOrders: OptionOrders } {
  const questionOrder = shuffleQuestions ? shuffleInPlace(versionIds) : [...versionIds];
  const optionOrders: OptionOrders = {};
  if (shuffleOptions) {
    for (const id of questionOrder) {
      const opts = optionsByVersion.get(id) ?? [];
      if (opts.length > 1) {
        optionOrders[id] = shuffleInPlace(opts.map((o) => o.id));
      }
    }
  }
  return { questionOrder, optionOrders };
}

const questionBankInclude = {
  questions: {
    where: { isActive: true },
    include: {
      versions: { orderBy: { version: 'desc' as const }, take: 1 },
    },
  },
} satisfies Prisma.QuestionBankInclude;

function attemptDurationMs(
  activity: {
    kind: string;
    durationMode: 'overall' | 'per_question';
    durationMinutes: number | null;
    perQuestionSeconds: number | null;
  },
  questionCount: number,
  fallbackMinutes: number,
) {
  if (activity.kind === 'quiz' && activity.durationMode === 'per_question') {
    const seconds = activity.perQuestionSeconds ?? 0;
    if (seconds <= 0) throw badRequest('This quiz has no per-question time.');
    if (questionCount <= 0) throw badRequest('No questions available for this attempt.');
    return questionCount * seconds * 1000;
  }
  return fallbackMinutes * 60_000;
}

function versionIdsFromBank(
  bank: Prisma.QuestionBankGetPayload<{ include: typeof questionBankInclude }>,
): string[] {
  return bank.questions.map((q) => q.versions[0]?.id).filter((id): id is string => Boolean(id));
}

/** Student-facing result: withhold scores until published and quiz visibility allows. */
function mapStudentResult(
  r: {
    id: string;
    score: Prisma.Decimal | number;
    maxScore: Prisma.Decimal | number;
    percent: Prisma.Decimal | number;
    passed: boolean | null;
    releaseStatus: string;
  },
  visibility?: { scoreVisible: boolean; answersVisible: boolean },
) {
  const published = r.releaseStatus === 'published';
  const scoreOk = published && (visibility?.scoreVisible ?? true);
  return {
    id: r.id,
    score: scoreOk ? toNumber(r.score) : null,
    maxScore: scoreOk ? toNumber(r.maxScore) : null,
    percent: scoreOk ? toNumber(r.percent) : null,
    passed: scoreOk ? r.passed : null,
    releaseStatus: r.releaseStatus,
    answersVisible: published && (visibility?.answersVisible ?? false),
  };
}

export async function startAttempt(
  organizationId: string,
  studentId: string,
  activityId: string,
  roundId?: string,
) {
  const activity = await prisma.activity.findFirst({
    where: { organizationId, id: activityId },
    include: {
      activityBanks: {
        include: {
          bank: { include: questionBankInclude },
        },
      },
      rounds: {
        orderBy: { sortOrder: 'asc' },
        include: {
          banks: { include: { bank: { include: questionBankInclude } } },
          localBank: { include: questionBankInclude },
        },
      },
    },
  });
  if (!activity) throw notFound('Activity not found.');
  if (activity.status !== 'active') throw forbidden('Activity is not open for attempts.');

  const now = new Date();
  if (activity.startsAt && activity.startsAt > now) {
    throw forbidden('Activity has not started yet.');
  }
  if (activity.endsAt && activity.endsAt < now) {
    throw forbidden('Activity window has ended.');
  }

  const registration = await prisma.registration.findFirst({
    where: {
      organizationId,
      activityId,
      studentId,
      status: 'assigned',
    },
  });
  if (!registration) throw forbidden('Student is not registered for this activity.');

  let resolvedRoundId: string | null = null;
  let durationMinutes = activity.durationMinutes ?? 60;
  let versionIds: string[];

  if (activity.kind === 'assessment') {
    if (!roundId) throw badRequest('roundId is required to start an assessment attempt.');
    const round = activity.rounds.find((r) => r.id === roundId);
    if (!round) throw notFound('Round not found on this assessment.');

    const previous = activity.rounds.filter((r) => r.sortOrder < round.sortOrder);
    if (previous.length > 0) {
      const prevIds = previous.map((r) => r.id);
      const completed = await prisma.attempt.findMany({
        where: {
          organizationId,
          activityId,
          studentId,
          roundId: { in: prevIds },
          status: { in: ['submitted', 'auto_submitted'] },
        },
        select: { roundId: true },
      });
      const completedSet = new Set(completed.map((c) => c.roundId));
      const missing = previous.find((r) => !completedSet.has(r.id));
      if (missing) {
        throw forbidden(`Complete "${missing.name}" before starting this round.`);
      }
    }

    const alreadyDone = await prisma.attempt.findFirst({
      where: {
        organizationId,
        activityId,
        studentId,
        roundId,
        status: { in: ['submitted', 'auto_submitted'] },
      },
    });
    if (alreadyDone) {
      throw conflict('This round has already been completed.');
    }

    const open = await prisma.attempt.findFirst({
      where: {
        organizationId,
        activityId,
        studentId,
        roundId,
        status: 'in_progress',
      },
    });
    if (open) {
      const refreshed = await autoSubmitIfExpired(open);
      if (refreshed && 'status' in refreshed && refreshed.status === 'in_progress') {
        throw conflict('An open attempt already exists for this round. Resume it instead.');
      }
    }

    // Also block starting another round while any assessment attempt is open
    const anyOpen = await prisma.attempt.findFirst({
      where: {
        organizationId,
        activityId,
        studentId,
        status: 'in_progress',
        NOT: { roundId },
      },
    });
    if (anyOpen) {
      throw conflict('Finish or resume your open round attempt first.');
    }

    resolvedRoundId = round.id;
    durationMinutes = round.durationMinutes ?? activity.durationMinutes ?? 60;
    const fromLinked = round.banks.flatMap((rb) => versionIdsFromBank(rb.bank));
    const fromLocal = round.localBank ? versionIdsFromBank(round.localBank) : [];
    versionIds = [...new Set([...fromLinked, ...fromLocal])];
  } else {
    if (roundId) throw badRequest('Quizzes do not use rounds.');
    const open = await prisma.attempt.findFirst({
      where: { organizationId, activityId, studentId, status: 'in_progress' },
    });
    if (open) {
      const grantContinue = await prisma.reattemptGrant.findFirst({
        where: {
          organizationId,
          activityId,
          studentId,
          mode: 'continue',
          consumedAt: null,
        },
        orderBy: { createdAt: 'asc' },
      });
      if (grantContinue) {
        const refreshed = await autoSubmitIfExpired(open);
        if (refreshed && 'status' in refreshed && refreshed.status === 'in_progress') {
          const questionCount = open.questionOrder.length;
          const durationMs = attemptDurationMs(
            activity,
            questionCount,
            activity.durationMinutes ?? 60,
          );
          let newDeadline = new Date(Date.now() + durationMs);
          if (activity.endsAt && activity.endsAt < newDeadline) newDeadline = activity.endsAt;
          await prisma.attempt.update({
            where: { id: open.id },
            data: { deadlineAt: newDeadline },
          });
          await prisma.reattemptGrant.update({
            where: { id: grantContinue.id },
            data: { consumedAt: new Date() },
          });
          return presentOpenQuizAttempt(open.id, organizationId);
        }
      }
      const refreshed = await autoSubmitIfExpired(open);
      if (refreshed && 'status' in refreshed && refreshed.status === 'in_progress') {
        return presentOpenQuizAttempt(open.id, organizationId);
      }
    }

    const completed = await prisma.attempt.findFirst({
      where: {
        organizationId,
        activityId,
        studentId,
        status: { in: ['submitted', 'auto_submitted'] },
      },
      orderBy: { submittedAt: 'desc' },
    });
    if (completed) {
      const grant = await prisma.reattemptGrant.findFirst({
        where: {
          organizationId,
          activityId,
          studentId,
          consumedAt: null,
        },
        orderBy: { createdAt: 'asc' },
      });
      if (!grant) {
        throw conflict('Quiz already completed. Ask an admin for a reattempt.');
      }
      if (grant.mode === 'restart' && completed.isAuthoritative) {
        await prisma.attempt.update({
          where: { id: completed.id },
          data: { isAuthoritative: false },
        });
      }
      await prisma.reattemptGrant.update({
        where: { id: grant.id },
        data: { consumedAt: new Date() },
      });
    }

    versionIds = activity.activityBanks.flatMap((ab) => versionIdsFromBank(ab.bank));
  }

  if (versionIds.length === 0) {
    throw badRequest('No questions available for this attempt.');
  }

  const durationMs = attemptDurationMs(activity, versionIds.length, durationMinutes);
  let deadlineAt = new Date(now.getTime() + durationMs);
  if (activity.endsAt && activity.endsAt < deadlineAt) {
    deadlineAt = activity.endsAt;
  }

  const quizSettings = activity.kind === 'quiz' ? parseQuizSettings(activity.settings) : null;

  let questionOrder = [...versionIds];
  let optionOrders: OptionOrders = {};
  if (activity.kind === 'quiz' && quizSettings) {
    const versionsForOpts = await prisma.questionVersion.findMany({
      where: { organizationId, id: { in: versionIds } },
      include: {
        options: {
          orderBy: { sortOrder: 'asc' },
          select: { id: true, label: true, body: true, sortOrder: true },
        },
      },
    });
    const optionsByVersion = new Map(versionsForOpts.map((v) => [v.id, v.options]));
    const built = buildShuffleOrders(
      versionIds,
      optionsByVersion,
      quizSettings.shuffleQuestions,
      quizSettings.shuffleOptions,
    );
    questionOrder = built.questionOrder;
    optionOrders = built.optionOrders;
  }

  const attempt = await prisma.attempt.create({
    data: {
      organizationId,
      activityId,
      roundId: resolvedRoundId,
      studentId,
      status: 'in_progress',
      revision: 0,
      startedAt: now,
      deadlineAt,
      questionOrder,
      optionOrders: Object.keys(optionOrders).length > 0 ? optionOrders : undefined,
      responses: {
        create: questionOrder.map((questionVersionId) => ({
          organizationId,
          questionVersionId,
          answer: {},
          revision: 0,
        })),
      },
    },
    include: { responses: true },
  });

  await invalidateDashboard(organizationId);

  const questions = await presentQuestions(
    organizationId,
    questionOrder,
    Object.keys(optionOrders).length > 0 ? optionOrders : null,
  );

  return {
    attempt: mapAttempt(attempt, extrasFromActivity(activity)),
    questions,
  };
}

export async function resumeAttempt(organizationId: string, studentId: string, attemptId: string) {
  const attempt = await prisma.attempt.findFirst({
    where: { organizationId, id: attemptId, studentId },
    include: {
      responses: true,
      activity: {
        select: {
          kind: true,
          settings: true,
          presentation: true,
          durationMode: true,
          perQuestionSeconds: true,
        },
      },
    },
  });
  if (!attempt) throw notFound('Attempt not found.');

  const quizSettings =
    attempt.activity.kind === 'quiz' ? parseQuizSettings(attempt.activity.settings) : null;
  const activityExtras = extrasFromActivity(attempt.activity);

  const maybe = await autoSubmitIfExpired(attempt);
  if (maybe && 'result' in maybe) {
    return {
      attempt: {
        ...maybe.attempt,
        ...activityExtras,
      },
      submitted: true,
      result: mapStudentResult(maybe.result as never, {
        scoreVisible: quizSettings?.scoreVisibleToStudent ?? true,
        answersVisible: quizSettings?.answersVisibleToStudent ?? false,
      }),
    };
  }

  const live = await prisma.attempt.findFirst({
    where: { organizationId, id: attemptId },
    include: { responses: true },
  });
  if (!live || live.status !== 'in_progress') {
    throw conflict('Attempt is no longer in progress.');
  }

  const versionIds =
    live.questionOrder.length > 0
      ? live.questionOrder
      : live.responses.map((r) => r.questionVersionId);
  const optionOrders = (live.optionOrders as OptionOrders | null) ?? null;
  const questions = await presentQuestions(organizationId, versionIds, optionOrders);

  return {
    attempt: mapAttempt(live, activityExtras),
    questions,
    submitted: false,
  };
}

export async function saveAttempt(
  organizationId: string,
  studentId: string,
  attemptId: string,
  input: {
    revision: number;
    responses: { questionVersionId: string; answer: unknown }[];
  },
) {
  const attempt = await prisma.attempt.findFirst({
    where: { organizationId, id: attemptId, studentId },
  });
  if (!attempt) throw notFound('Attempt not found.');

  await autoSubmitIfExpired(attempt);

  const live = await prisma.attempt.findFirst({
    where: { organizationId, id: attemptId },
  });
  if (!live || live.status !== 'in_progress') {
    throw conflict('Attempt is no longer in progress.');
  }
  if (live.revision !== input.revision) {
    throw conflict('Stale revision. Reload the attempt and retry.', {
      revision: String(live.revision),
    });
  }

  const nextRevision = live.revision + 1;

  await prisma.$transaction(async (tx) => {
    const guarded = await tx.attempt.updateMany({
      where: {
        organizationId,
        id: attemptId,
        status: 'in_progress',
        revision: input.revision,
        deadlineAt: { gt: new Date() },
      },
      data: { revision: nextRevision },
    });
    if (guarded.count !== 1) {
      throw conflict('Stale revision. Reload the attempt and retry.', {
        revision: String(live.revision),
      });
    }

    for (const r of input.responses) {
      const existing = await tx.attemptResponse.findFirst({
        where: {
          organizationId,
          attemptId,
          questionVersionId: r.questionVersionId,
        },
      });
      if (!existing) {
        throw badRequest('Unknown question for this attempt.', {
          questionVersionId: r.questionVersionId,
        });
      }
      await tx.attemptResponse.updateMany({
        where: { organizationId, id: existing.id },
        data: {
          answer: r.answer as Prisma.InputJsonValue,
          revision: nextRevision,
        },
      });
    }
  });

  const updated = await prisma.attempt.findFirst({
    where: { organizationId, id: attemptId },
    include: { responses: true },
  });
  if (!updated) throw notFound('Attempt not found.');

  return {
    acknowledged: true,
    revision: updated.revision,
    attempt: mapAttempt(updated),
  };
}

async function submitAttemptInternal(
  organizationId: string,
  attemptId: string,
  studentId: string,
  opts: { auto: boolean; idempotencyKey: string },
) {
  const existingByKey = await prisma.attempt.findFirst({
    where: {
      organizationId,
      id: attemptId,
      studentId,
      submitIdempotencyKey: opts.idempotencyKey,
    },
    include: { result: true, responses: true, activity: true },
  });

  const attempt = await prisma.attempt.findFirst({
    where: { organizationId, id: attemptId, studentId },
    include: {
      responses: true,
      activity: true,
      result: true,
    },
  });
  if (!attempt) throw notFound('Attempt not found.');

  const quizSettings =
    attempt.activity.kind === 'quiz' ? parseQuizSettings(attempt.activity.settings) : null;
  const visibility = {
    scoreVisible: quizSettings?.scoreVisibleToStudent ?? true,
    answersVisible: quizSettings?.answersVisibleToStudent ?? false,
  };

  if (existingByKey?.result) {
    return {
      attempt: mapAttempt(existingByKey, {
        activityKind: attempt.activity.kind,
        softProctoring: attempt.activity.kind === 'quiz',
      }),
      result: mapStudentResult(existingByKey.result, visibility),
    };
  }

  if (attempt.submitIdempotencyKey === opts.idempotencyKey && attempt.result) {
    return {
      attempt: mapAttempt(attempt, {
        activityKind: attempt.activity.kind,
        softProctoring: attempt.activity.kind === 'quiz',
      }),
      result: mapStudentResult(attempt.result, visibility),
    };
  }

  if (attempt.status !== 'in_progress' && attempt.result) {
    if (attempt.submitIdempotencyKey === opts.idempotencyKey) {
      return {
        attempt: mapAttempt(attempt, {
          activityKind: attempt.activity.kind,
          softProctoring: attempt.activity.kind === 'quiz',
        }),
        result: mapStudentResult(attempt.result, visibility),
      };
    }
    throw conflict('Attempt already submitted.');
  }

  const versions = await prisma.questionVersion.findMany({
    where: {
      organizationId,
      id: { in: attempt.responses.map((r) => r.questionVersionId) },
    },
  });
  const byId = new Map(versions.map((v) => [v.id, v]));

  let score = 0;
  let maxScore = 0;
  for (const response of attempt.responses) {
    const version = byId.get(response.questionVersionId);
    if (!version) continue;
    const pts = toNumber(version.points);
    const earned = scoreObjective(version.type, version.answerKey, response.answer, pts);
    if (earned === null) continue;
    maxScore += pts;
    score += earned;
  }

  const percent = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const passing = attempt.activity.passingPercent
    ? toNumber(attempt.activity.passingPercent)
    : null;
  const passed = passing === null ? null : percent >= passing;

  const submittedAt = new Date();
  const status = opts.auto ? 'auto_submitted' : 'submitted';

  const [updated, result] = await prisma.$transaction(async (tx) => {
    const locked = await tx.attempt.updateMany({
      where: { organizationId, id: attemptId, status: 'in_progress' },
      data: {
        status,
        submittedAt,
        submitIdempotencyKey: opts.idempotencyKey,
      },
    });
    if (locked.count !== 1) {
      throw conflict('Attempt already submitted.');
    }

    const upd = await tx.attempt.findFirst({
      where: { organizationId, id: attemptId },
      include: { responses: true },
    });
    if (!upd) throw notFound('Attempt not found.');

    const res = await tx.result.create({
      data: {
        organizationId,
        attemptId,
        activityId: attempt.activityId,
        studentId,
        score,
        maxScore,
        percent,
        passed,
        releaseStatus: 'withheld',
        revisions: {
          create: {
            organizationId,
            score,
            maxScore,
            percent,
            reason: opts.auto ? 'auto_submit' : 'initial',
          },
        },
      },
    });

    return [upd, res] as const;
  });

  await writeAudit({
    organizationId,
    actorType: 'student',
    action: opts.auto ? 'attempt.auto_submit' : 'attempt.submit',
    targetType: 'attempt',
    targetId: attemptId,
  });
  await invalidateDashboard(organizationId);

  return {
    attempt: mapAttempt(updated, {
      activityKind: attempt.activity.kind,
      softProctoring: attempt.activity.kind === 'quiz',
    }),
    result: mapStudentResult(result, visibility),
  };
}

export async function submitAttempt(
  organizationId: string,
  studentId: string,
  attemptId: string,
  idempotencyKey: string | undefined,
) {
  if (!idempotencyKey) {
    throw badRequest('Idempotency-Key header is required for submit.');
  }
  return submitAttemptInternal(organizationId, attemptId, studentId, {
    auto: false,
    idempotencyKey,
  });
}

export async function disqualifyAttempt(
  organizationId: string,
  actorUserId: string,
  attemptId: string,
  note?: string,
) {
  const attempt = await prisma.attempt.findFirst({
    where: { organizationId, id: attemptId },
    include: { activity: true },
  });
  if (!attempt) throw notFound('Attempt not found.');
  if (attempt.activity.kind !== 'quiz') {
    throw badRequest('Disqualify is only available for quiz attempts.');
  }
  if (attempt.disqualified) throw conflict('Attempt is already disqualified.');

  const updated = await prisma.attempt.update({
    where: { id: attemptId },
    data: {
      disqualified: true,
      disqualifiedAt: new Date(),
      disqualifiedByUserId: actorUserId,
      disqualifiedNote: note?.trim() || null,
      isAuthoritative: false,
    },
    include: { responses: true },
  });

  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId,
    action: 'attempt.disqualify',
    targetType: 'attempt',
    targetId: attemptId,
  });
  await invalidateDashboard(organizationId);
  return mapAttempt(updated, { activityKind: 'quiz' });
}

export async function requalifyAttempt(
  organizationId: string,
  actorUserId: string,
  attemptId: string,
) {
  const attempt = await prisma.attempt.findFirst({
    where: { organizationId, id: attemptId },
    include: { activity: true },
  });
  if (!attempt) throw notFound('Attempt not found.');
  if (attempt.activity.kind !== 'quiz') {
    throw badRequest('Re-qualify is only available for quiz attempts.');
  }
  if (!attempt.disqualified) throw conflict('Attempt is not disqualified.');

  // Make this the authoritative completed attempt if submitted
  if (attempt.status === 'submitted' || attempt.status === 'auto_submitted') {
    await prisma.attempt.updateMany({
      where: {
        organizationId,
        activityId: attempt.activityId,
        studentId: attempt.studentId,
        id: { not: attemptId },
        status: { in: ['submitted', 'auto_submitted'] },
      },
      data: { isAuthoritative: false },
    });
  }

  const updated = await prisma.attempt.update({
    where: { id: attemptId },
    data: {
      disqualified: false,
      disqualifiedAt: null,
      disqualifiedByUserId: null,
      disqualifiedNote: null,
      isAuthoritative: true,
    },
    include: { responses: true },
  });

  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId,
    action: 'attempt.requalify',
    targetType: 'attempt',
    targetId: attemptId,
  });
  await invalidateDashboard(organizationId);
  return mapAttempt(updated, { activityKind: 'quiz' });
}

export async function grantReattempt(
  organizationId: string,
  actorUserId: string,
  activityId: string,
  studentId: string,
  mode: 'continue' | 'restart',
  note?: string,
) {
  const activity = await prisma.activity.findFirst({ where: { organizationId, id: activityId } });
  if (!activity) throw notFound('Activity not found.');
  if (activity.kind !== 'quiz') throw badRequest('Reattempts are only for quizzes.');

  const student = await prisma.student.findFirst({ where: { organizationId, id: studentId } });
  if (!student) throw notFound('Student not found.');

  const grant = await prisma.reattemptGrant.create({
    data: {
      organizationId,
      activityId,
      studentId,
      mode,
      note: note?.trim() || null,
      grantedByUserId: actorUserId,
    },
  });

  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId,
    action: 'reattempt.grant',
    targetType: 'reattempt_grant',
    targetId: grant.id,
  });

  return {
    id: grant.id,
    activityId: grant.activityId,
    studentId: grant.studentId,
    mode: grant.mode,
    note: grant.note,
    consumedAt: grant.consumedAt,
    createdAt: grant.createdAt,
  };
}

export async function listReattemptGrants(organizationId: string, activityId: string) {
  const activity = await prisma.activity.findFirst({ where: { organizationId, id: activityId } });
  if (!activity) throw notFound('Activity not found.');

  const rows = await prisma.reattemptGrant.findMany({
    where: { organizationId, activityId },
    include: {
      student: { select: { id: true, name: true, code: true } },
      grantedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return rows.map((g) => ({
    id: g.id,
    mode: g.mode,
    note: g.note,
    consumedAt: g.consumedAt,
    createdAt: g.createdAt,
    student: g.student,
    grantedBy: g.grantedBy,
  }));
}
