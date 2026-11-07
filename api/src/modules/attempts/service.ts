import { Prisma } from '#prisma';
import { writeAudit } from '../../lib/audit.js';
import { invalidateDashboard } from '../../lib/cache.js';
import { AppError, badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { isQuizScoreVisible, parseQuizSettings, shuffleInPlace } from '../../lib/quiz-settings.js';
import {
  applyQuestionLimit,
  blocksFromItems,
  orderBlocks,
  type QuestionOrderItem,
} from '../../lib/question-order.js';
import {
  canRetryRound,
  parseRoundRow,
  roundIsCleared,
  roundNeedsManualPublish,
} from '../../lib/round-unlock.js';
import { meetsPassRule } from '../../lib/round-settings.js';
import { assertActivityPageEnabled } from '../../lib/participant-pages.js';
import {
  applyNegativeMarking,
  clampScore,
  hasSubmittedAnswer,
  scoreObjective,
  toNumber,
} from './scoring.js';
import { assertCanWipeActivity, wipeParticipantActivityAttempts, type WipeActor } from './wipe.js';

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
  participantId: string;
  revision: number;
  roundId?: string | null;
}) {
  if (attempt.status !== 'in_progress') return attempt;
  if (attempt.deadlineAt.getTime() > Date.now()) return attempt;

  const activity = await prisma.activity.findFirst({
    where: { organizationId: attempt.organizationId, id: attempt.activityId },
    select: {
      durationMode: true,
      perQuestionSeconds: true,
      endsAt: true,
      kind: true,
    },
  });

  let durationMode = activity?.durationMode ?? 'overall';
  let perQuestionSeconds = activity?.perQuestionSeconds ?? null;
  if (activity?.kind === 'assessment' && attempt.roundId) {
    const round = await prisma.activityRound.findFirst({
      where: { organizationId: attempt.organizationId, id: attempt.roundId },
    });
    if (round) {
      const settings = parseRoundRow(round);
      durationMode = settings.durationMode;
      perQuestionSeconds = settings.perQuestionSeconds;
    }
  }

  // Per-question: expired deadline is the question window, not the whole attempt,
  // unless the activity end time has passed.
  if (durationMode === 'per_question') {
    if (activity?.endsAt && activity.endsAt.getTime() <= Date.now()) {
      return submitAttemptInternal(attempt.organizationId, attempt.id, attempt.participantId, {
        auto: true,
        idempotencyKey: `auto:${attempt.id}`,
      });
    }
    return renewPerQuestionDeadline(attempt.organizationId, attempt.id, {
      perQuestionSeconds,
      endsAt: activity?.endsAt ?? null,
    });
  }

  return submitAttemptInternal(attempt.organizationId, attempt.id, attempt.participantId, {
    auto: true,
    idempotencyKey: `auto:${attempt.id}`,
  });
}

async function renewPerQuestionDeadline(
  organizationId: string,
  attemptId: string,
  activity: {
    perQuestionSeconds: number | null;
    endsAt: Date | null;
  },
) {
  const seconds = activity.perQuestionSeconds ?? 0;
  if (seconds <= 0) throw badRequest('This quiz has no per-question time.');
  let deadlineAt = new Date(Date.now() + seconds * 1000);
  if (activity.endsAt && activity.endsAt < deadlineAt) {
    deadlineAt = activity.endsAt;
  }
  return prisma.attempt.update({
    where: { id: attemptId },
    data: { deadlineAt },
  });
}

/** Close quiz attempts the product would already auto-submit, and record why. */
export async function settleOpenQuizAttempts(
  organizationId: string,
  opts?: { activityId?: string; reason?: AutoSubmitReasonCode },
) {
  const open = await prisma.attempt.findMany({
    where: {
      organizationId,
      status: 'in_progress',
      activity: {
        kind: 'quiz',
        ...(opts?.activityId ? { id: opts.activityId } : {}),
      },
    },
    select: {
      id: true,
      participantId: true,
      deadlineAt: true,
      activity: { select: { endsAt: true, durationMode: true } },
    },
  });

  const now = Date.now();
  for (const attempt of open) {
    let reason = opts?.reason ?? null;
    if (!reason) {
      const ended = attempt.activity.endsAt != null && attempt.activity.endsAt.getTime() <= now;
      if (ended) reason = 'quiz_ended';
      else if (
        attempt.activity.durationMode !== 'per_question' &&
        attempt.deadlineAt.getTime() <= now
      ) {
        reason = 'timer';
      }
    }
    if (!reason) continue;
    try {
      await submitAttemptInternal(organizationId, attempt.id, attempt.participantId, {
        auto: true,
        idempotencyKey: `auto:${attempt.id}`,
        autoSubmitReason: reason,
      });
    } catch (err) {
      if (err instanceof AppError && (err.code === 'CONFLICT' || err.code === 'NOT_FOUND')) {
        continue;
      }
      throw err;
    }
  }
}

/** Close assessment-round attempts the product would already auto-submit. */
export async function settleOpenAssessmentAttempts(
  organizationId: string,
  opts?: { activityId?: string; reason?: AutoSubmitReasonCode },
) {
  const open = await prisma.attempt.findMany({
    where: {
      organizationId,
      status: 'in_progress',
      activity: {
        kind: 'assessment',
        ...(opts?.activityId ? { id: opts.activityId } : {}),
      },
    },
    select: {
      id: true,
      participantId: true,
      deadlineAt: true,
      activity: { select: { endsAt: true } },
      round: { select: { durationMode: true } },
    },
  });

  const now = Date.now();
  for (const attempt of open) {
    let reason = opts?.reason ?? null;
    if (!reason) {
      const ended = attempt.activity.endsAt != null && attempt.activity.endsAt.getTime() <= now;
      if (ended) reason = 'quiz_ended';
      else if (
        attempt.round?.durationMode !== 'per_question' &&
        attempt.deadlineAt.getTime() <= now
      ) {
        reason = 'timer';
      }
    }
    if (!reason) continue;
    try {
      await submitAttemptInternal(organizationId, attempt.id, attempt.participantId, {
        auto: true,
        idempotencyKey: `auto:${attempt.id}`,
        autoSubmitReason: reason,
      });
    } catch (err) {
      if (err instanceof AppError && (err.code === 'CONFLICT' || err.code === 'NOT_FOUND')) {
        continue;
      }
      throw err;
    }
  }
}

type AttemptPresentation = 'one_at_a_time' | 'all_on_page';

type AttemptMapExtras = {
  activityKind?: string;
  softProctoring?: boolean;
  presentation?: AttemptPresentation | string | null;
  durationMode?: 'overall' | 'per_question' | string | null;
  perQuestionSeconds?: number | null;
  allowPrevious?: boolean;
  settings?: Prisma.JsonValue | null;
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
    participantId: string;
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
  const presentation: AttemptPresentation =
    extras?.presentation === 'all_on_page' ? 'all_on_page' : 'one_at_a_time';
  const durationMode = extras?.durationMode === 'per_question' ? 'per_question' : 'overall';
  const quizSettings = extras?.activityKind === 'quiz' ? parseQuizSettings(extras.settings) : null;
  const roundBehaviour =
    extras?.activityKind === 'assessment' &&
    extras.settings &&
    typeof extras.settings === 'object' &&
    !Array.isArray(extras.settings)
      ? parseRoundRow({ settings: extras.settings })
      : null;
  const behaviour = quizSettings ?? roundBehaviour;
  const allowPrevious =
    extras?.allowPrevious !== undefined ? extras.allowPrevious : (behaviour?.allowPrevious ?? true);
  const forwardOnly = durationMode === 'per_question' || allowPrevious === false;
  const showQuestionPanel =
    durationMode === 'per_question' ? false : (behaviour?.showQuestionPanel ?? true);
  const questionsCompulsory = behaviour?.questionsCompulsory ?? true;
  return {
    id: a.id,
    status: a.status,
    revision: a.revision,
    startedAt: a.startedAt,
    deadlineAt: a.deadlineAt,
    submittedAt: a.submittedAt,
    activityId: a.activityId,
    roundId: a.roundId ?? null,
    participantId: a.participantId,
    disqualified: a.disqualified ?? false,
    isAuthoritative: a.isAuthoritative ?? true,
    activityKind: extras?.activityKind ?? null,
    softProctoring: extras?.softProctoring ?? false,
    presentation,
    durationMode,
    perQuestionSeconds:
      typeof extras?.perQuestionSeconds === 'number' && extras.perQuestionSeconds > 0
        ? extras.perQuestionSeconds
        : null,
    allowPrevious,
    showQuestionPanel,
    questionsCompulsory,
    forwardOnly,
    responses: (a.responses ?? []).map((r) => ({
      questionVersionId: r.questionVersionId,
      answer: r.answer,
      revision: r.revision,
    })),
  };
}

function extrasFromRound(round: {
  presentation?: string | null;
  durationMode?: string | null;
  perQuestionSeconds?: number | null;
  settings?: Prisma.JsonValue | null;
}): AttemptMapExtras {
  const settings = parseRoundRow(round);
  return {
    activityKind: 'assessment',
    softProctoring: false,
    presentation: settings.presentation,
    durationMode: settings.durationMode,
    perQuestionSeconds: settings.perQuestionSeconds,
    allowPrevious: settings.allowPrevious,
    settings: round.settings ?? null,
  };
}

function extrasFromActivity(activity: {
  kind: string;
  presentation?: string | null;
  durationMode?: string | null;
  perQuestionSeconds?: number | null;
  settings?: Prisma.JsonValue | null;
}): AttemptMapExtras {
  return {
    activityKind: activity.kind,
    softProctoring: activity.kind === 'quiz',
    presentation: activity.presentation,
    durationMode: activity.durationMode,
    perQuestionSeconds: activity.perQuestionSeconds ?? null,
    settings: activity.settings ?? null,
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
      passage: { select: { body: true } },
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
      const passageText =
        v.passage?.body?.trim() ||
        (typeof key.passageText === 'string' ? key.passageText : undefined);
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
        select: {
          kind: true,
          presentation: true,
          durationMode: true,
          perQuestionSeconds: true,
          settings: true,
        },
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

function buildAttemptOrders(
  items: QuestionOrderItem[],
  questionLimit: number | null,
  optionsByVersion: Map<string, OptionRow[]>,
  shuffleQuestions: boolean,
  shuffleOptions: boolean,
): { questionOrder: string[]; optionOrders: OptionOrders } {
  const blocks = applyQuestionLimit(blocksFromItems(items), questionLimit);
  const questionOrder = orderBlocks(blocks, shuffleQuestions);
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
    orderBy: { createdAt: 'asc' as const },
    include: {
      versions: { orderBy: { version: 'desc' as const }, take: 1 },
    },
  },
} satisfies Prisma.QuestionBankInclude;

/** Session or per-question window length in ms. Per-question uses one question only. */
export function attemptDurationMs(
  activity: {
    kind: string;
    durationMode: 'overall' | 'per_question';
    durationMinutes: number | null;
    perQuestionSeconds: number | null;
  },
  questionCount: number,
  fallbackMinutes: number,
) {
  if (activity.durationMode === 'per_question') {
    const seconds = activity.perQuestionSeconds ?? 0;
    if (seconds <= 0) throw badRequest('This activity has no per-question time.');
    if (questionCount <= 0) throw badRequest('No questions available for this attempt.');
    return seconds * 1000;
  }
  return fallbackMinutes * 60_000;
}

function orderItemsFromBank(
  bank: Prisma.QuestionBankGetPayload<{ include: typeof questionBankInclude }>,
): QuestionOrderItem[] {
  return bank.questions.flatMap((question) => {
    const id = question.versions[0]?.id;
    if (!id) return [];
    return [{ id, passageId: question.passageId, sortOrder: question.sortOrder }];
  });
}

/** Participant-facing result. `scoreVisible` is the final decision, including publish rules. */
function mapParticipantResult(
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
  const scoreOk = visibility ? visibility.scoreVisible : published;
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
  participantId: string,
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
  await assertActivityPageEnabled(organizationId, activity.kind);
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
      participantId,
      status: 'assigned',
    },
  });
  if (!registration) throw forbidden('Participant is not registered for this activity.');

  let resolvedRoundId: string | null = null;
  let durationMinutes = activity.durationMinutes ?? 60;
  let orderItems: QuestionOrderItem[];
  let questionLimit: number | null;
  let assessmentTiming: {
    durationMode: 'overall' | 'per_question';
    perQuestionSeconds: number | null;
  } | null = null;
  let assessmentShuffle: { shuffleQuestions: boolean; shuffleOptions: boolean } | null = null;
  let assessmentExtras: AttemptMapExtras | null = null;

  if (activity.kind === 'assessment') {
    if (!roundId) throw badRequest('roundId is required to start an assessment attempt.');
    const round = activity.rounds.find((r) => r.id === roundId);
    if (!round) throw notFound('Round not found on this assessment.');

    const roundSettings = parseRoundRow(round);
    const allAttempts = await prisma.attempt.findMany({
      where: { organizationId, activityId, participantId },
      include: { result: true },
    });

    // Objective rounds auto-publish on submit; withheld results never unlock the next round.
    const requirePublished = true;
    for (const prev of activity.rounds.filter((r) => r.sortOrder < round.sortOrder)) {
      if (!roundIsCleared(allAttempts, prev.id, parseRoundRow(prev), requirePublished)) {
        throw forbidden(`Pass "${prev.name}" before starting this round.`);
      }
    }

    if (roundIsCleared(allAttempts, round.id, roundSettings, requirePublished)) {
      throw conflict('This round has already been passed.');
    }
    if (!canRetryRound(allAttempts, round.id, roundSettings, requirePublished)) {
      throw conflict('No attempts remaining for this round.');
    }

    const open = allAttempts.find((a) => a.roundId === round.id && a.status === 'in_progress');
    if (open) {
      const refreshed = await autoSubmitIfExpired(open);
      if (refreshed && 'status' in refreshed && refreshed.status === 'in_progress') {
        throw conflict('An open attempt already exists for this round. Resume it instead.');
      }
    }

    const anyOpen = allAttempts.find((a) => a.status === 'in_progress' && a.roundId !== round.id);
    if (anyOpen) {
      throw conflict('Finish or resume your open round attempt first.');
    }

    resolvedRoundId = round.id;
    durationMinutes =
      roundSettings.durationMode === 'overall'
        ? (roundSettings.durationMinutes ?? activity.durationMinutes ?? 60)
        : 60;
    assessmentTiming = {
      durationMode: roundSettings.durationMode,
      perQuestionSeconds: roundSettings.perQuestionSeconds,
    };
    assessmentShuffle = {
      shuffleQuestions: roundSettings.shuffleQuestions,
      shuffleOptions: roundSettings.shuffleOptions,
    };
    assessmentExtras = extrasFromRound(round);
    orderItems = round.localBank ? orderItemsFromBank(round.localBank) : [];
    questionLimit = roundSettings.questionLimit;
  } else {
    if (roundId) throw badRequest('Quizzes do not use rounds.');
    const open = await prisma.attempt.findFirst({
      where: { organizationId, activityId, participantId, status: 'in_progress' },
    });
    if (open) {
      const grantContinue = await prisma.reattemptGrant.findFirst({
        where: {
          organizationId,
          activityId,
          participantId,
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

    const usedAttempts = await prisma.attempt.count({
      where: {
        organizationId,
        activityId,
        participantId,
        status: { in: ['submitted', 'auto_submitted'] },
      },
    });
    if (usedAttempts > 0) {
      const cap = parseQuizSettings(activity.settings).maxAttempts;
      const underCap = cap == null || usedAttempts < cap;
      if (underCap) {
        await prisma.attempt.updateMany({
          where: {
            organizationId,
            activityId,
            participantId,
            status: { in: ['submitted', 'auto_submitted'] },
            isAuthoritative: true,
          },
          data: { isAuthoritative: false },
        });
      } else {
        const grant = await prisma.reattemptGrant.findFirst({
          where: {
            organizationId,
            activityId,
            participantId,
            consumedAt: null,
          },
          orderBy: { createdAt: 'asc' },
        });
        if (!grant) {
          throw conflict('You have used all attempts for this quiz.');
        }
        if (grant.mode === 'restart') {
          await prisma.attempt.updateMany({
            where: {
              organizationId,
              activityId,
              participantId,
              status: { in: ['submitted', 'auto_submitted'] },
              isAuthoritative: true,
            },
            data: { isAuthoritative: false },
          });
        }
        await prisma.reattemptGrant.update({
          where: { id: grant.id },
          data: { consumedAt: new Date() },
        });
      }
    }

    orderItems = activity.activityBanks.flatMap((ab) => orderItemsFromBank(ab.bank));
    questionLimit = parseQuizSettings(activity.settings).questionLimit;
  }

  if (orderItems.length === 0) {
    throw badRequest('No questions available for this attempt.');
  }

  const timingSource = assessmentTiming
    ? {
        kind: activity.kind,
        durationMode: assessmentTiming.durationMode,
        durationMinutes: activity.durationMinutes,
        perQuestionSeconds: assessmentTiming.perQuestionSeconds,
      }
    : activity;
  const quizSettings = activity.kind === 'quiz' ? parseQuizSettings(activity.settings) : null;
  const shuffle =
    activity.kind === 'quiz' && quizSettings
      ? {
          shuffleQuestions: quizSettings.shuffleQuestions,
          shuffleOptions: quizSettings.shuffleOptions,
        }
      : assessmentShuffle;

  const candidateIds = applyQuestionLimit(blocksFromItems(orderItems), questionLimit).flatMap(
    (block) => block.map((item) => item.id),
  );
  if (candidateIds.length === 0) {
    throw badRequest('No questions available for this attempt.');
  }
  const versionsForOpts = await prisma.questionVersion.findMany({
    where: { organizationId, id: { in: candidateIds } },
    include: {
      options: {
        orderBy: { sortOrder: 'asc' },
        select: { id: true, label: true, body: true, sortOrder: true },
      },
    },
  });
  const optionsByVersion = new Map(versionsForOpts.map((v) => [v.id, v.options]));
  const built = buildAttemptOrders(
    orderItems,
    questionLimit,
    optionsByVersion,
    shuffle?.shuffleQuestions ?? false,
    shuffle?.shuffleOptions ?? false,
  );
  const questionOrder = built.questionOrder;
  const optionOrders = built.optionOrders;

  const durationMs = attemptDurationMs(timingSource, questionOrder.length, durationMinutes);
  let deadlineAt = new Date(now.getTime() + durationMs);
  if (activity.endsAt && activity.endsAt < deadlineAt) {
    deadlineAt = activity.endsAt;
  }

  // Last-chance guard against duplicate open quiz attempts (e.g. double Start).
  if (activity.kind === 'quiz') {
    const stillOpen = await prisma.attempt.findFirst({
      where: { organizationId, activityId, participantId, status: 'in_progress' },
      orderBy: { startedAt: 'desc' },
    });
    if (stillOpen) {
      return presentOpenQuizAttempt(stillOpen.id, organizationId);
    }
  }

  const attempt = await prisma.attempt.create({
    data: {
      organizationId,
      activityId,
      roundId: resolvedRoundId,
      participantId,
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
    attempt: mapAttempt(attempt, assessmentExtras ?? extrasFromActivity(activity)),
    questions,
  };
}

export async function resumeAttempt(
  organizationId: string,
  participantId: string,
  attemptId: string,
) {
  const attempt = await prisma.attempt.findFirst({
    where: { organizationId, id: attemptId, participantId },
    include: {
      responses: true,
      round: true,
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
  await assertActivityPageEnabled(organizationId, attempt.activity.kind);

  const quizSettings =
    attempt.activity.kind === 'quiz' ? parseQuizSettings(attempt.activity.settings) : null;
  const roundSettings =
    attempt.activity.kind === 'assessment' && attempt.round ? parseRoundRow(attempt.round) : null;
  const activityExtras =
    attempt.activity.kind === 'assessment' && attempt.round
      ? extrasFromRound(attempt.round)
      : extrasFromActivity(attempt.activity);

  const maybe = await autoSubmitIfExpired(attempt);
  if (maybe && 'result' in maybe) {
    const published = (maybe.result as { releaseStatus?: string }).releaseStatus === 'published';
    return {
      attempt: {
        ...maybe.attempt,
        ...activityExtras,
      },
      submitted: true,
      result: mapParticipantResult(maybe.result as never, {
        scoreVisible: isQuizScoreVisible(quizSettings ?? roundSettings, published),
        answersVisible:
          quizSettings?.answersVisibleToParticipant ??
          roundSettings?.answersVisibleToParticipant ??
          false,
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
  participantId: string,
  attemptId: string,
  input: {
    revision: number;
    responses: { questionVersionId: string; answer: unknown }[];
  },
) {
  const attempt = await prisma.attempt.findFirst({
    where: { organizationId, id: attemptId, participantId },
    include: {
      activity: {
        select: {
          kind: true,
          durationMode: true,
          presentation: true,
          perQuestionSeconds: true,
          settings: true,
        },
      },
    },
  });
  if (!attempt) throw notFound('Attempt not found.');
  await assertActivityPageEnabled(organizationId, attempt.activity.kind);

  await autoSubmitIfExpired(attempt);

  const live = await prisma.attempt.findFirst({
    where: { organizationId, id: attemptId },
    include: {
      activity: {
        select: {
          kind: true,
          durationMode: true,
          presentation: true,
          perQuestionSeconds: true,
          settings: true,
        },
      },
    },
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
  const perQuestion =
    live.activity.kind === 'quiz' && live.activity.durationMode === 'per_question';

  await prisma.$transaction(async (tx) => {
    const guarded = await tx.attempt.updateMany({
      where: {
        organizationId,
        id: attemptId,
        status: 'in_progress',
        revision: input.revision,
        // Per-question: allow a final save after the question window expires (advance follows).
        ...(perQuestion ? {} : { deadlineAt: { gt: new Date() } }),
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
    attempt: mapAttempt(updated, extrasFromActivity(live.activity)),
  };
}

/** Renew the per-question deadline when the participant moves to the next question. */
export async function advanceAttempt(
  organizationId: string,
  participantId: string,
  attemptId: string,
) {
  const attempt = await prisma.attempt.findFirst({
    where: { organizationId, id: attemptId, participantId },
    include: {
      activity: {
        select: {
          kind: true,
          durationMode: true,
          presentation: true,
          perQuestionSeconds: true,
          endsAt: true,
          settings: true,
        },
      },
      responses: true,
    },
  });
  if (!attempt) throw notFound('Attempt not found.');
  await assertActivityPageEnabled(organizationId, attempt.activity.kind);
  if (attempt.status !== 'in_progress') {
    throw conflict('Attempt is no longer in progress.');
  }
  const round =
    attempt.activity.kind === 'assessment' && attempt.roundId
      ? await prisma.activityRound.findFirst({
          where: { organizationId, id: attempt.roundId },
        })
      : null;
  const durationMode =
    round != null ? parseRoundRow(round).durationMode : attempt.activity.durationMode;
  const perQuestionSeconds =
    round != null ? parseRoundRow(round).perQuestionSeconds : attempt.activity.perQuestionSeconds;
  if (durationMode !== 'per_question') {
    throw badRequest('Advance is only available for per-question timed attempts.');
  }

  if (attempt.activity.endsAt && attempt.activity.endsAt.getTime() <= Date.now()) {
    const submitted = await submitAttemptInternal(organizationId, attemptId, participantId, {
      auto: true,
      idempotencyKey: `auto:${attemptId}`,
    });
    return {
      attempt: submitted.attempt,
      submitted: true as const,
      result: submitted.result,
    };
  }

  await renewPerQuestionDeadline(organizationId, attemptId, {
    perQuestionSeconds,
    endsAt: attempt.activity.endsAt,
  });
  const live = await prisma.attempt.findFirst({
    where: { organizationId, id: attemptId },
    include: { responses: true },
  });
  if (!live) throw notFound('Attempt not found.');

  return {
    attempt: mapAttempt(
      live,
      round ? extrasFromRound(round) : extrasFromActivity(attempt.activity),
    ),
    submitted: false as const,
  };
}

export type AutoSubmitReasonCode = 'timer' | 'quiz_ended' | 'quiz_deactivated';

function inferAutoSubmitReason(endsAt: Date | null): AutoSubmitReasonCode {
  if (endsAt && endsAt.getTime() <= Date.now()) return 'quiz_ended';
  return 'timer';
}

async function submitAttemptInternal(
  organizationId: string,
  attemptId: string,
  participantId: string,
  opts: { auto: boolean; idempotencyKey: string; autoSubmitReason?: AutoSubmitReasonCode },
) {
  const existingByKey = await prisma.attempt.findFirst({
    where: {
      organizationId,
      id: attemptId,
      participantId,
      submitIdempotencyKey: opts.idempotencyKey,
    },
    include: { result: true, responses: true, activity: true },
  });

  const attempt = await prisma.attempt.findFirst({
    where: { organizationId, id: attemptId, participantId },
    include: {
      responses: true,
      activity: true,
      result: true,
      round: true,
    },
  });
  if (!attempt) throw notFound('Attempt not found.');
  if (!opts.auto) await assertActivityPageEnabled(organizationId, attempt.activity.kind);

  const quizSettings =
    attempt.activity.kind === 'quiz' ? parseQuizSettings(attempt.activity.settings) : null;
  const roundSettings =
    attempt.activity.kind === 'assessment' && attempt.round ? parseRoundRow(attempt.round) : null;
  const visibilityFor = (releaseStatus: string) => {
    const published = releaseStatus === 'published';
    if (quizSettings) {
      return {
        scoreVisible: isQuizScoreVisible(quizSettings, published),
        answersVisible: quizSettings.answersVisibleToParticipant,
      };
    }
    if (roundSettings) {
      return {
        scoreVisible: isQuizScoreVisible(
          { ...roundSettings, scoreRelease: roundSettings.scoreRelease },
          published,
        ),
        answersVisible: roundSettings.answersVisibleToParticipant,
      };
    }
    return {
      scoreVisible: published,
      answersVisible: false,
    };
  };

  if (existingByKey?.result) {
    return {
      attempt: mapAttempt(existingByKey, {
        activityKind: attempt.activity.kind,
        softProctoring: attempt.activity.kind === 'quiz',
      }),
      result: mapParticipantResult(
        existingByKey.result,
        visibilityFor(existingByKey.result.releaseStatus),
      ),
    };
  }

  if (attempt.submitIdempotencyKey === opts.idempotencyKey && attempt.result) {
    return {
      attempt: mapAttempt(attempt, {
        activityKind: attempt.activity.kind,
        softProctoring: attempt.activity.kind === 'quiz',
      }),
      result: mapParticipantResult(attempt.result, visibilityFor(attempt.result.releaseStatus)),
    };
  }

  if (attempt.status !== 'in_progress' && attempt.result) {
    if (attempt.submitIdempotencyKey === opts.idempotencyKey) {
      return {
        attempt: mapAttempt(attempt, {
          activityKind: attempt.activity.kind,
          softProctoring: attempt.activity.kind === 'quiz',
        }),
        result: mapParticipantResult(attempt.result, visibilityFor(attempt.result.releaseStatus)),
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

  const behaviour = quizSettings ?? roundSettings;
  const negativeEnabled = Boolean(behaviour?.negativeMarkingEnabled);
  const negativePenalty =
    negativeEnabled && behaviour && behaviour.negativeMarkPoints > 0
      ? behaviour.negativeMarkPoints
      : 0;

  let score = 0;
  let maxScore = 0;
  const questionTypes: string[] = [];
  for (const response of attempt.responses) {
    const version = byId.get(response.questionVersionId);
    if (!version) continue;
    questionTypes.push(version.type);
    const pts = toNumber(version.points);
    const earned = scoreObjective(version.type, version.answerKey, response.answer, pts);
    if (earned === null) continue;
    maxScore += pts;
    score = applyNegativeMarking(score, {
      enabled: negativeEnabled,
      penalty: negativePenalty,
      earned,
      answered: hasSubmittedAnswer(version.type, response.answer),
    });
  }
  score = clampScore(score);

  const percent = maxScore > 0 ? (score / maxScore) * 100 : 0;
  let passed: boolean | null;
  if (roundSettings) {
    passed = meetsPassRule(roundSettings, score, percent);
  } else {
    const passing = attempt.activity.passingPercent
      ? toNumber(attempt.activity.passingPercent)
      : null;
    passed = passing === null ? null : percent >= passing;
  }

  const quizPublished =
    attempt.activity.kind === 'quiz' && attempt.activity.resultsPublishedAt != null;
  const roundPublished =
    attempt.activity.kind === 'assessment' && attempt.round?.resultsPublishedAt != null;
  const holdUntilPublish =
    attempt.activity.kind === 'assessment' &&
    !roundPublished &&
    (roundSettings?.scoreRelease === 'after_publish' ||
      roundNeedsManualPublish(questionTypes));
  const releaseStatus =
    quizPublished || roundPublished || (attempt.activity.kind === 'assessment' && !holdUntilPublish)
      ? ('published' as const)
      : ('withheld' as const);
  const publishedAt = releaseStatus === 'published' ? new Date() : null;

  const submittedAt = new Date();
  const status = opts.auto ? 'auto_submitted' : 'submitted';
  const autoSubmitReason = opts.auto
    ? (opts.autoSubmitReason ?? inferAutoSubmitReason(attempt.activity.endsAt))
    : null;

  const [updated, result] = await prisma.$transaction(async (tx) => {
    const locked = await tx.attempt.updateMany({
      where: { organizationId, id: attemptId, status: 'in_progress' },
      data: {
        status,
        submittedAt,
        submitIdempotencyKey: opts.idempotencyKey,
        ...(autoSubmitReason ? { autoSubmitReason } : {}),
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
        participantId,
        score,
        maxScore,
        percent,
        passed,
        releaseStatus,
        publishedAt,
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
    actorType: 'participant',
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
    result: mapParticipantResult(result, visibilityFor(result.releaseStatus)),
  };
}

export async function submitAttempt(
  organizationId: string,
  participantId: string,
  attemptId: string,
  idempotencyKey: string | undefined,
) {
  if (!idempotencyKey) {
    throw badRequest('Idempotency-Key header is required for submit.');
  }
  return submitAttemptInternal(organizationId, attemptId, participantId, {
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
        participantId: attempt.participantId,
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
  participantId: string,
  mode: 'continue' | 'restart',
  note?: string,
) {
  const activity = await prisma.activity.findFirst({ where: { organizationId, id: activityId } });
  if (!activity) throw notFound('Activity not found.');
  if (activity.kind !== 'quiz') throw badRequest('Reattempts are only for quizzes.');

  const participant = await prisma.participant.findFirst({
    where: { organizationId, id: participantId },
  });
  if (!participant) throw notFound('Participant not found.');

  const grant = await prisma.reattemptGrant.create({
    data: {
      organizationId,
      activityId,
      participantId,
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
    participantId: grant.participantId,
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
      participant: { select: { id: true, name: true, code: true } },
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
    participant: g.participant,
    grantedBy: g.grantedBy,
  }));
}

/**
 * Admin delete for any attempt status (including in_progress). Clears the
 * participant's attempts for that quiz/round as if they never started.
 */
export async function deleteAttemptAdmin(
  organizationId: string,
  actor: WipeActor,
  attemptId: string,
) {
  const existing = await prisma.attempt.findFirst({
    where: { organizationId, id: attemptId },
    include: {
      activity: { select: { id: true, kind: true, name: true } },
      participant: { select: { id: true, name: true, code: true } },
      result: { select: { id: true } },
    },
  });
  if (!existing) throw notFound('Attempt not found.');
  assertCanWipeActivity(actor, existing.activity.kind);

  const attemptsRemoved = await prisma.$transaction(async (tx) =>
    wipeParticipantActivityAttempts(tx, {
      organizationId,
      activityId: existing.activityId,
      participantId: existing.participantId,
      attemptId: existing.id,
      roundId: existing.roundId,
      activityKind: existing.activity.kind,
      resultId: existing.result?.id ?? null,
    }),
  );

  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId: actor.userId,
    action: 'attempt.delete',
    targetType: 'attempt',
    targetId: attemptId,
    metadata: {
      activityId: existing.activityId,
      participantId: existing.participantId,
      roundId: existing.roundId,
      status: existing.status,
      attemptsRemoved,
      participantName: existing.participant.name,
      activityName: existing.activity.name,
    },
  });
  await invalidateDashboard(organizationId);

  return { id: attemptId, deleted: true as const, attemptsRemoved };
}
