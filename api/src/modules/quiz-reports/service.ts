import type { AccessLevel, MembershipRole } from '#prisma';
import { activityStatusDisplay } from '../../lib/activity-status.js';
import { writeAudit } from '../../lib/audit.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { parseQuizSettings } from '../../lib/quiz-settings.js';
import { assertActivityAccess } from '../activities/service.js';
import { settleOpenQuizAttempts } from '../attempts/service.js';
import { hasSubmittedAnswer, scoreObjective, toNumber } from '../attempts/scoring.js';
import { buildAttemptReview, type ReviewVersion } from './review.js';
import {
  buildReportRow,
  filterReportRows,
  sortReportRows,
  summarizeReportRows,
  wholePercent,
  type ReportQuery,
  type ReportRow,
  type ReportSource,
  type ScoreBreakdown,
} from './rows.js';

export type QuizReportActor = {
  userId: string;
  role: MembershipRole;
  assessmentAccess: AccessLevel;
  quizAccess: AccessLevel;
};

function assertQuiz(actor: QuizReportActor, min: 'view' | 'full') {
  assertActivityAccess(actor.role, actor.assessmentAccess, actor.quizAccess, 'quiz', min);
}

type QuizOption = {
  id: string;
  name: string;
  contestId: string | null;
  contestName: string | null;
  quizStatus: ReportRow['quizStatus'];
  displayStatus: ReportRow['displayStatus'];
  scoreRelease: ReportRow['scoreRelease'];
  resultsPublishedAt: string | null;
  passingPercent: number | null;
};

type Loaded = {
  rows: ReportRow[];
  options: {
    contests: { id: string; name: string }[];
    quizzes: QuizOption[];
  };
};

function pairKey(activityId: string, participantId: string) {
  return `${activityId}:${participantId}`;
}

export async function loadQuizReport(
  organizationId: string,
  actor: QuizReportActor,
): Promise<Loaded> {
  assertQuiz(actor, 'view');
  await settleOpenQuizAttempts(organizationId);

  const [registrations, attempts, grants, links] = await Promise.all([
    prisma.registration.findMany({
      where: { organizationId, status: 'assigned', activity: { kind: 'quiz' } },
      select: {
        id: true,
        assignedAt: true,
        createdAt: true,
        activityId: true,
        participantId: true,
        participant: { select: { code: true, name: true, email: true, phone: true } },
        activity: {
          select: {
            id: true,
            name: true,
            status: true,
            startsAt: true,
            endsAt: true,
            passingPercent: true,
            settings: true,
            resultsPublishedAt: true,
            contest: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.attempt.findMany({
      where: { organizationId, status: { not: 'voided' }, activity: { kind: 'quiz' } },
      select: {
        id: true,
        activityId: true,
        participantId: true,
        status: true,
        startedAt: true,
        submittedAt: true,
        createdAt: true,
        disqualified: true,
        autoSubmitReason: true,
        questionOrder: true,
        result: { select: { id: true, score: true, maxScore: true } },
      },
    }),
    prisma.reattemptGrant.findMany({
      where: { organizationId, activity: { kind: 'quiz' } },
      select: { activityId: true, participantId: true },
    }),
    prisma.activityBank.findMany({
      where: { organizationId, activity: { kind: 'quiz' } },
      select: { activityId: true, bankId: true },
    }),
  ]);

  const bankIds = [...new Set(links.map((link) => link.bankId))];
  const questions =
    bankIds.length === 0
      ? []
      : await prisma.question.findMany({
          where: { organizationId, bankId: { in: bankIds }, isActive: true },
          select: { id: true, bankId: true, points: true, sortOrder: true },
        });
  const questionsByBank = new Map<string, typeof questions>();
  for (const question of questions) {
    const list = questionsByBank.get(question.bankId) ?? [];
    list.push(question);
    questionsByBank.set(question.bankId, list);
  }
  const banksByActivity = new Map<string, string[]>();
  for (const link of links) {
    const list = banksByActivity.get(link.activityId) ?? [];
    list.push(link.bankId);
    banksByActivity.set(link.activityId, list);
  }

  const attemptsByPair = new Map<string, typeof attempts>();
  for (const attempt of attempts) {
    const key = pairKey(attempt.activityId, attempt.participantId);
    const list = attemptsByPair.get(key) ?? [];
    list.push(attempt);
    attemptsByPair.set(key, list);
  }
  const grantsByPair = new Map<string, number>();
  for (const grant of grants) {
    const key = pairKey(grant.activityId, grant.participantId);
    grantsByPair.set(key, (grantsByPair.get(key) ?? 0) + 1);
  }

  const negativeByActivity = new Map<string, { enabled: boolean; penalty: number }>();
  const sources: ReportSource[] = registrations.map((registration) => {
    const settings = parseQuizSettings(registration.activity.settings);
    negativeByActivity.set(registration.activityId, {
      enabled: settings.negativeMarkingEnabled,
      penalty: settings.negativeMarkPoints,
    });
    const unique = new Map<string, (typeof questions)[number]>();
    for (const bankId of banksByActivity.get(registration.activityId) ?? []) {
      for (const question of questionsByBank.get(bankId) ?? []) unique.set(question.id, question);
    }
    const ordered = [...unique.values()].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
    );
    const taken =
      settings.questionLimit == null ? ordered : ordered.slice(0, settings.questionLimit);
    const pairAttempts =
      attemptsByPair.get(pairKey(registration.activityId, registration.participantId)) ?? [];
    return {
      registrationId: registration.id,
      registeredAt: (registration.assignedAt ?? registration.createdAt).toISOString(),
      code: registration.participant.code,
      name: registration.participant.name,
      email: registration.participant.email,
      phone: registration.participant.phone,
      activityId: registration.activity.id,
      quizName: registration.activity.name,
      contestId: registration.activity.contest?.id ?? null,
      contestName: registration.activity.contest?.name ?? null,
      displayStatus: activityStatusDisplay(
        registration.activity.status,
        registration.activity.startsAt,
        registration.activity.endsAt,
      ),
      passingPercent:
        registration.activity.passingPercent == null
          ? null
          : toNumber(registration.activity.passingPercent),
      scoreRelease: settings.scoreRelease,
      resultsPublishedAt: registration.activity.resultsPublishedAt?.toISOString() ?? null,
      maxAttempts: settings.maxAttempts,
      grantCount:
        grantsByPair.get(pairKey(registration.activityId, registration.participantId)) ?? 0,
      quizQuestionCount: taken.length,
      quizMaxScore: taken.reduce((sum, question) => sum + toNumber(question.points), 0),
      attempts: pairAttempts.map((attempt) => ({
        id: attempt.id,
        status: attempt.status as ReportSource['attempts'][number]['status'],
        startedAt: attempt.startedAt.toISOString(),
        submittedAt: attempt.submittedAt?.toISOString() ?? null,
        createdAt: attempt.createdAt.toISOString(),
        disqualified: attempt.disqualified,
        autoSubmitReason: attempt.autoSubmitReason,
        score: attempt.result ? toNumber(attempt.result.score) : null,
        maxScore: attempt.result ? toNumber(attempt.result.maxScore) : null,
        questionCount: attempt.questionOrder.length,
        resultId: attempt.result?.id ?? null,
      })),
    };
  });

  const bestIds = sources.flatMap((source) => {
    const id = buildReportRow(source).bestAttemptId;
    return id ? [id] : [];
  });
  const breakdowns = await loadBreakdowns(organizationId, bestIds, sources, negativeByActivity);
  const rows = sources.map((source) => {
    const bestId = buildReportRow(source).bestAttemptId;
    return buildReportRow(source, bestId ? (breakdowns.get(bestId) ?? null) : null);
  });

  const contests = new Map<string, string>();
  const quizzes = new Map<string, QuizOption>();
  for (const row of rows) {
    if (row.contestId && row.contestName) contests.set(row.contestId, row.contestName);
    if (!quizzes.has(row.activityId)) {
      quizzes.set(row.activityId, {
        id: row.activityId,
        name: row.quizName,
        contestId: row.contestId,
        contestName: row.contestName,
        quizStatus: row.quizStatus,
        displayStatus: row.displayStatus,
        scoreRelease: row.scoreRelease,
        resultsPublishedAt: row.resultsPublishedAt,
        passingPercent: row.passingPercent,
      });
    }
  }

  return {
    rows,
    options: {
      contests: [...contests.entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
      quizzes: [...quizzes.values()].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      ),
    },
  };
}

async function loadBreakdowns(
  organizationId: string,
  attemptIds: string[],
  sources: ReportSource[],
  negativeByActivity: Map<string, { enabled: boolean; penalty: number }>,
): Promise<Map<string, ScoreBreakdown>> {
  const result = new Map<string, ScoreBreakdown>();
  if (attemptIds.length === 0) return result;
  const responses = await prisma.attemptResponse.findMany({
    where: { organizationId, attemptId: { in: attemptIds } },
    select: { attemptId: true, questionVersionId: true, answer: true },
  });
  const versionIds = [...new Set(responses.map((response) => response.questionVersionId))];
  const versions =
    versionIds.length === 0
      ? []
      : await prisma.questionVersion.findMany({
          where: { organizationId, id: { in: versionIds } },
          select: { id: true, type: true, points: true, answerKey: true },
        });
  const versionById = new Map(versions.map((version) => [version.id, version]));
  const byAttempt = new Map<string, typeof responses>();
  for (const response of responses) {
    const list = byAttempt.get(response.attemptId) ?? [];
    list.push(response);
    byAttempt.set(response.attemptId, list);
  }
  const activityOfAttempt = new Map<string, string>();
  for (const source of sources) {
    for (const attempt of source.attempts) activityOfAttempt.set(attempt.id, source.activityId);
  }
  for (const attemptId of attemptIds) {
    const negative = negativeByActivity.get(activityOfAttempt.get(attemptId) ?? '') ?? {
      enabled: false,
      penalty: 0,
    };
    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    let negativeMarks = 0;
    for (const response of byAttempt.get(attemptId) ?? []) {
      const version = versionById.get(response.questionVersionId);
      if (!version) continue;
      const points = toNumber(version.points);
      const earned = scoreObjective(version.type, version.answerKey, response.answer, points);
      if (earned == null) continue;
      if (!hasSubmittedAnswer(version.type, response.answer)) {
        skipped += 1;
        continue;
      }
      if (earned > 0) {
        correct += 1;
        continue;
      }
      wrong += 1;
      if (negative.enabled && negative.penalty > 0) negativeMarks += negative.penalty;
    }
    result.set(attemptId, { correct, wrong, skipped, negative: negativeMarks });
  }
  return result;
}

export async function listQuizReports(
  organizationId: string,
  actor: QuizReportActor,
  query: ReportQuery & { page: number; pageSize: number },
) {
  const loaded = await loadQuizReport(organizationId, actor);
  const filtered = sortReportRows(filterReportRows(loaded.rows, query), query.sort, query.dir);
  const summary = summarizeReportRows(filtered);
  const pageCount = Math.max(1, Math.ceil(filtered.length / query.pageSize));
  const page = Math.min(query.page, pageCount);
  const start = (page - 1) * query.pageSize;
  return {
    rows: filtered.slice(start, start + query.pageSize),
    summary,
    page: { page, pageSize: query.pageSize, total: filtered.length, pageCount },
    options: loaded.options,
  };
}

export async function exportQuizReportRows(
  organizationId: string,
  actor: QuizReportActor,
  query: ReportQuery & { includeAbsent: boolean },
) {
  const loaded = await loadQuizReport(organizationId, actor);
  const filtered = sortReportRows(filterReportRows(loaded.rows, query), query.sort, query.dir);
  const rows = query.includeAbsent
    ? filtered
    : filtered.filter((row) => row.attemptStatus === 'completed');
  const quiz =
    query.activityId != null
      ? loaded.options.quizzes.find((item) => item.id === query.activityId)
      : undefined;
  return { rows, quizName: quiz?.name ?? null };
}

export async function getQuizReportDetail(
  organizationId: string,
  actor: QuizReportActor,
  registrationId: string,
  attemptId?: string,
) {
  assertQuiz(actor, 'view');
  const registration = await prisma.registration.findFirst({
    where: {
      organizationId,
      id: registrationId,
      status: 'assigned',
      activity: { kind: 'quiz' },
    },
    select: {
      id: true,
      assignedAt: true,
      createdAt: true,
      activityId: true,
      participantId: true,
      participant: { select: { code: true, name: true, email: true, phone: true } },
      activity: {
        select: {
          id: true,
          name: true,
          status: true,
          startsAt: true,
          endsAt: true,
          passingPercent: true,
          settings: true,
          contest: { select: { name: true } },
        },
      },
    },
  });
  if (!registration) throw notFound('Registration not found.');

  const attempts = await prisma.attempt.findMany({
    where: {
      organizationId,
      activityId: registration.activityId,
      participantId: registration.participantId,
      status: { not: 'voided' },
    },
    orderBy: { startedAt: 'asc' },
    select: {
      id: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      createdAt: true,
      disqualified: true,
      autoSubmitReason: true,
      questionOrder: true,
      result: { select: { id: true, score: true, maxScore: true } },
    },
  });

  const settings = parseQuizSettings(registration.activity.settings);
  const displayStatus = activityStatusDisplay(
    registration.activity.status,
    registration.activity.startsAt,
    registration.activity.endsAt,
  );
  const source: ReportSource = {
    registrationId: registration.id,
    registeredAt: (registration.assignedAt ?? registration.createdAt).toISOString(),
    code: registration.participant.code,
    name: registration.participant.name,
    email: registration.participant.email,
    phone: registration.participant.phone,
    activityId: registration.activity.id,
    quizName: registration.activity.name,
    contestId: null,
    contestName: registration.activity.contest?.name ?? null,
    displayStatus,
    passingPercent:
      registration.activity.passingPercent == null
        ? null
        : toNumber(registration.activity.passingPercent),
    scoreRelease: settings.scoreRelease,
    resultsPublishedAt: null,
    maxAttempts: settings.maxAttempts,
    grantCount: await prisma.reattemptGrant.count({
      where: {
        organizationId,
        activityId: registration.activityId,
        participantId: registration.participantId,
      },
    }),
    quizQuestionCount: 0,
    quizMaxScore: 0,
    attempts: attempts.map((attempt) => ({
      id: attempt.id,
      status: attempt.status as ReportSource['attempts'][number]['status'],
      startedAt: attempt.startedAt.toISOString(),
      submittedAt: attempt.submittedAt?.toISOString() ?? null,
      createdAt: attempt.createdAt.toISOString(),
      disqualified: attempt.disqualified,
      autoSubmitReason: attempt.autoSubmitReason,
      score: attempt.result ? toNumber(attempt.result.score) : null,
      maxScore: attempt.result ? toNumber(attempt.result.maxScore) : null,
      questionCount: attempt.questionOrder.length,
      resultId: attempt.result?.id ?? null,
    })),
  };
  const summaryRow = buildReportRow(source);
  const selected =
    attempts.find((attempt) => attempt.id === attemptId && attempt.status !== 'in_progress') ??
    attempts.find((attempt) => attempt.id === summaryRow.bestAttemptId) ??
    null;

  let answers: ReturnType<typeof buildAttemptReview> | null = null;
  if (selected && selected.status !== 'in_progress') {
    const responses = await prisma.attemptResponse.findMany({
      where: { organizationId, attemptId: selected.id },
      select: { questionVersionId: true, answer: true },
    });
    const versionIds =
      selected.questionOrder.length > 0
        ? selected.questionOrder
        : responses.map((response) => response.questionVersionId);
    const versions =
      versionIds.length === 0
        ? []
        : await prisma.questionVersion.findMany({
            where: { organizationId, id: { in: versionIds } },
            include: {
              passage: { select: { body: true } },
              options: {
                orderBy: { sortOrder: 'asc' },
                select: { label: true, body: true, isCorrect: true },
              },
            },
          });
    const reviewVersions: ReviewVersion[] = versions.map((version) => ({
      id: version.id,
      question: version.question,
      type: version.type,
      points: version.points,
      answerKey: version.answerKey,
      passageId: version.passageId,
      passageText: version.passage?.body ?? null,
      options: version.options.map((option) => ({
        label: option.label,
        body: option.body,
        isCorrect: option.isCorrect,
      })),
    }));
    answers = buildAttemptReview(
      selected.questionOrder,
      responses.map((response) => ({
        questionVersionId: response.questionVersionId,
        answer: response.answer,
      })),
      reviewVersions,
      {
        enabled: settings.negativeMarkingEnabled,
        penalty: settings.negativeMarkPoints,
      },
    );
  }

  return {
    registrationId: registration.id,
    registeredAt: source.registeredAt,
    code: source.code,
    name: source.name,
    email: source.email,
    phone: source.phone,
    quizName: source.quizName,
    contestName: source.contestName,
    passingPercent: source.passingPercent,
    attemptStatus: summaryRow.attemptStatus,
    attemptsStarted: summaryRow.attemptsStarted,
    attemptsAllowed: summaryRow.attemptsAllowed,
    countedAttemptId: summaryRow.bestAttemptId,
    resultId: summaryRow.resultId,
    note:
      summaryRow.attemptStatus === 'not_started'
        ? ('not_started' as const)
        : summaryRow.attemptStatus === 'in_progress'
          ? ('in_progress' as const)
          : null,
    attempts: source.attempts.map((attempt, index) => {
      const percent =
        attempt.status === 'in_progress' || attempt.score == null || attempt.maxScore == null
          ? null
          : wholePercent(attempt.score, attempt.maxScore);
      const passing = source.passingPercent;
      return {
        id: attempt.id,
        number: index + 1,
        counted: attempt.id === summaryRow.bestAttemptId,
        score: percent == null ? null : attempt.score,
        maxScore: attempt.status === 'in_progress' ? null : attempt.maxScore,
        percent,
        result:
          percent == null || passing == null
            ? null
            : percent >= passing
              ? ('pass' as const)
              : ('fail' as const),
        timeTakenSeconds:
          attempt.submittedAt == null
            ? null
            : Math.max(
                0,
                Math.round(
                  (Date.parse(attempt.submittedAt) - Date.parse(attempt.startedAt)) / 1000,
                ),
              ),
        submittedAt: attempt.submittedAt,
        autoSubmitted: attempt.status === 'auto_submitted',
        autoSubmitReason: attempt.status === 'auto_submitted' ? attempt.autoSubmitReason : null,
        attemptStatus:
          attempt.status === 'in_progress' ? ('in_progress' as const) : ('completed' as const),
        selectable: attempt.status !== 'in_progress',
        disqualified: attempt.disqualified,
      };
    }),
    answers,
    selectedAttemptId: selected?.id ?? null,
    showSelectPrompt:
      source.attempts.filter((attempt) => attempt.status !== 'in_progress').length > 1,
  };
}

export async function publishQuizResults(
  organizationId: string,
  actor: QuizReportActor,
  activityId: string,
) {
  assertQuiz(actor, 'full');
  const activity = await prisma.activity.findFirst({
    where: { organizationId, id: activityId, kind: 'quiz' },
  });
  if (!activity) throw notFound('Quiz not found.');
  const settings = parseQuizSettings(activity.settings);
  if (settings.scoreRelease !== 'after_publish') {
    throw badRequest('This quiz shows scores as soon as a student submits.');
  }
  if (activity.resultsPublishedAt) {
    return { resultsPublishedAt: activity.resultsPublishedAt.toISOString() };
  }
  const now = new Date();
  await prisma.$transaction([
    prisma.activity.update({
      where: { id: activityId },
      data: { resultsPublishedAt: now },
    }),
    prisma.result.updateMany({
      where: { organizationId, activityId, releaseStatus: 'withheld' },
      data: { releaseStatus: 'published', publishedAt: now },
    }),
  ]);
  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId: actor.userId,
    action: 'quiz.results_publish',
    targetType: 'activity',
    targetId: activityId,
  });
  return { resultsPublishedAt: now.toISOString() };
}
