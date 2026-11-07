import type { AccessLevel, MembershipRole } from '#prisma';
import { writeAudit } from '../../lib/audit.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { meetsPassRule, parseRoundRow } from '../../lib/round-unlock.js';
import { assertActivityAccess } from '../activities/service.js';
import { settleOpenAssessmentAttempts } from '../attempts/service.js';
import { hasSubmittedAnswer, scoreObjective, toNumber } from '../attempts/scoring.js';
import { buildAttemptReview, type ReviewVersion } from '../quiz-reports/review.js';
import { wholePercent } from '../quiz-reports/rows.js';
import {
  assessmentDisplayStatus,
  buildAssessmentRow,
  filterAssessmentRows,
  sortAssessmentRows,
  summarizeAssessmentRows,
  type AssessmentQuery,
  type AssessmentReportRow,
  type AssessmentSource,
} from './rows.js';

export type AssessmentReportActor = {
  userId: string;
  role: MembershipRole;
  assessmentAccess: AccessLevel;
  quizAccess: AccessLevel;
};

function assertAssessment(actor: AssessmentReportActor, min: 'view' | 'full') {
  assertActivityAccess(actor.role, actor.assessmentAccess, actor.quizAccess, 'assessment', min);
}

type RoundOption = {
  id: string;
  name: string;
  activityId: string;
  assessmentName: string;
  sortOrder: number;
  scoreRelease: 'after_submit' | 'after_publish';
  resultsPublishedAt: string | null;
  withheldCount: number;
};

function pairKey(roundId: string, participantId: string) {
  return `${roundId}:${participantId}`;
}

export async function loadAssessmentReport(organizationId: string, actor: AssessmentReportActor) {
  assertAssessment(actor, 'view');
  await settleOpenAssessmentAttempts(organizationId);

  const [registrations, rounds, attempts] = await Promise.all([
    prisma.registration.findMany({
      where: { organizationId, status: 'assigned', activity: { kind: 'assessment' } },
      select: {
        id: true,
        assignedAt: true,
        createdAt: true,
        activityId: true,
        participantId: true,
        participant: { select: { code: true, name: true, email: true, phone: true } },
        activity: {
          select: { id: true, name: true, status: true, startsAt: true, endsAt: true },
        },
      },
    }),
    prisma.activityRound.findMany({
      where: { organizationId, activity: { kind: 'assessment' } },
      select: {
        id: true,
        activityId: true,
        name: true,
        sortOrder: true,
        durationMinutes: true,
        durationMode: true,
        perQuestionSeconds: true,
        presentation: true,
        passMode: true,
        passingPercent: true,
        passingScore: true,
        settings: true,
        resultsPublishedAt: true,
        localBankId: true,
        banks: { select: { bankId: true } },
      },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.attempt.findMany({
      where: {
        organizationId,
        status: { not: 'voided' },
        activity: { kind: 'assessment' },
        roundId: { not: null },
      },
      select: {
        id: true,
        roundId: true,
        participantId: true,
        status: true,
        startedAt: true,
        submittedAt: true,
        createdAt: true,
        disqualified: true,
        autoSubmitReason: true,
        questionOrder: true,
        result: { select: { id: true, score: true, maxScore: true, releaseStatus: true } },
      },
    }),
  ]);

  const bankIds = [
    ...new Set(
      rounds.flatMap((round) => [
        ...(round.localBankId ? [round.localBankId] : []),
        ...round.banks.map((bank) => bank.bankId),
      ]),
    ),
  ];
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

  const attemptsByPair = new Map<string, typeof attempts>();
  const withheldByRound = new Map<string, number>();
  for (const attempt of attempts) {
    if (!attempt.roundId) continue;
    const key = pairKey(attempt.roundId, attempt.participantId);
    const list = attemptsByPair.get(key) ?? [];
    list.push(attempt);
    attemptsByPair.set(key, list);
    if (attempt.result?.releaseStatus === 'withheld') {
      withheldByRound.set(attempt.roundId, (withheldByRound.get(attempt.roundId) ?? 0) + 1);
    }
  }

  const roundsByActivity = new Map<string, typeof rounds>();
  for (const round of rounds) {
    const list = roundsByActivity.get(round.activityId) ?? [];
    list.push(round);
    roundsByActivity.set(round.activityId, list);
  }

  const sources: AssessmentSource[] = [];
  for (const registration of registrations) {
    const displayStatus = assessmentDisplayStatus(
      registration.activity.status,
      registration.activity.startsAt,
      registration.activity.endsAt,
    );
    for (const round of roundsByActivity.get(registration.activityId) ?? []) {
      const settings = parseRoundRow(round);
      const bankList = [
        ...(round.localBankId ? [round.localBankId] : []),
        ...round.banks.map((bank) => bank.bankId),
      ];
      const unique = new Map<string, (typeof questions)[number]>();
      for (const bankId of bankList) {
        for (const question of questionsByBank.get(bankId) ?? []) unique.set(question.id, question);
      }
      const ordered = [...unique.values()].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
      );
      const taken =
        settings.questionLimit == null ? ordered : ordered.slice(0, settings.questionLimit);
      const pairAttempts = attemptsByPair.get(pairKey(round.id, registration.participantId)) ?? [];
      sources.push({
        registrationId: registration.id,
        roundId: round.id,
        roundName: round.name,
        roundOrder: round.sortOrder,
        registeredAt: (registration.assignedAt ?? registration.createdAt).toISOString(),
        code: registration.participant.code,
        name: registration.participant.name,
        email: registration.participant.email,
        phone: registration.participant.phone,
        activityId: registration.activity.id,
        assessmentName: registration.activity.name,
        displayStatus,
        roundSettings: settings,
        resultsPublishedAt: round.resultsPublishedAt?.toISOString() ?? null,
        questionCount: taken.length,
        maxScore: taken.reduce((sum, question) => sum + toNumber(question.points), 0),
        attempts: pairAttempts.map((attempt) => ({
          id: attempt.id,
          status: attempt.status as AssessmentSource['attempts'][number]['status'],
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
      });
    }
  }

  const negativeByRound = new Map(
    sources.map((source) => [
      source.roundId,
      {
        enabled: source.roundSettings.negativeMarkingEnabled,
        penalty: source.roundSettings.negativeMarkPoints,
      },
    ]),
  );
  const bestIds = sources.flatMap((source) => {
    const id = buildAssessmentRow(source).bestAttemptId;
    return id ? [id] : [];
  });
  const breakdowns = await loadBreakdowns(organizationId, bestIds, sources, negativeByRound);
  const rows = sources.map((source) => {
    const bestId = buildAssessmentRow(source).bestAttemptId;
    return buildAssessmentRow(source, bestId ? (breakdowns.get(bestId) ?? null) : null);
  });

  const assessments = new Map<
    string,
    { id: string; name: string; activityStatus: AssessmentReportRow['activityStatus'] }
  >();
  const roundOptions = new Map<string, RoundOption>();
  for (const row of rows) {
    if (!assessments.has(row.activityId)) {
      assessments.set(row.activityId, {
        id: row.activityId,
        name: row.assessmentName,
        activityStatus: row.activityStatus,
      });
    }
    if (!roundOptions.has(row.roundId)) {
      roundOptions.set(row.roundId, {
        id: row.roundId,
        name: row.roundName,
        activityId: row.activityId,
        assessmentName: row.assessmentName,
        sortOrder: row.roundOrder,
        scoreRelease: row.scoreRelease,
        resultsPublishedAt: row.resultsPublishedAt,
        withheldCount: withheldByRound.get(row.roundId) ?? 0,
      });
    }
  }

  return {
    rows,
    options: {
      assessments: [...assessments.values()].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      ),
      rounds: [...roundOptions.values()].sort(
        (a, b) => a.assessmentName.localeCompare(b.assessmentName) || a.sortOrder - b.sortOrder,
      ),
    },
  };
}

async function loadBreakdowns(
  organizationId: string,
  attemptIds: string[],
  sources: AssessmentSource[],
  negativeByRound: Map<string, { enabled: boolean; penalty: number }>,
) {
  const result = new Map<
    string,
    { correct: number; wrong: number; skipped: number; negative: number }
  >();
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
  const roundOfAttempt = new Map<string, string>();
  for (const source of sources) {
    for (const attempt of source.attempts) roundOfAttempt.set(attempt.id, source.roundId);
  }
  for (const attemptId of attemptIds) {
    const negative = negativeByRound.get(roundOfAttempt.get(attemptId) ?? '') ?? {
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
      if (earned > 0) correct += 1;
      else {
        wrong += 1;
        if (negative.enabled && negative.penalty > 0) negativeMarks += negative.penalty;
      }
    }
    result.set(attemptId, { correct, wrong, skipped, negative: negativeMarks });
  }
  return result;
}

export async function listAssessmentReports(
  organizationId: string,
  actor: AssessmentReportActor,
  query: AssessmentQuery & { page: number; pageSize: number },
) {
  const loaded = await loadAssessmentReport(organizationId, actor);
  const filtered = sortAssessmentRows(
    filterAssessmentRows(loaded.rows, query),
    query.sort,
    query.dir,
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / query.pageSize));
  const page = Math.min(query.page, pageCount);
  const start = (page - 1) * query.pageSize;
  return {
    rows: filtered.slice(start, start + query.pageSize),
    summary: summarizeAssessmentRows(filtered),
    page: { page, pageSize: query.pageSize, total: filtered.length, pageCount },
    options: loaded.options,
  };
}

export async function exportAssessmentRows(
  organizationId: string,
  actor: AssessmentReportActor,
  query: AssessmentQuery & { includeAbsent: boolean },
) {
  const loaded = await loadAssessmentReport(organizationId, actor);
  const filtered = sortAssessmentRows(
    filterAssessmentRows(loaded.rows, query),
    query.sort,
    query.dir,
  );
  const rows = query.includeAbsent
    ? filtered
    : filtered.filter((row) => row.attemptStatus === 'completed');
  const assessment = query.activityId
    ? loaded.options.assessments.find((item) => item.id === query.activityId)
    : undefined;
  const round = query.roundId
    ? loaded.options.rounds.find((item) => item.id === query.roundId)
    : undefined;
  return {
    rows,
    assessmentName: assessment?.name ?? null,
    roundName: round && (!assessment || round.activityId === assessment.id) ? round.name : null,
  };
}

export async function getAssessmentReportDetail(
  organizationId: string,
  actor: AssessmentReportActor,
  registrationId: string,
  roundId: string,
  attemptId?: string,
) {
  assertAssessment(actor, 'view');
  const registration = await prisma.registration.findFirst({
    where: {
      organizationId,
      id: registrationId,
      status: 'assigned',
      activity: { kind: 'assessment' },
    },
    select: {
      id: true,
      assignedAt: true,
      createdAt: true,
      activityId: true,
      participantId: true,
      participant: { select: { code: true, name: true, email: true, phone: true } },
      activity: { select: { id: true, name: true, status: true, startsAt: true, endsAt: true } },
    },
  });
  if (!registration) throw notFound('Registration not found.');
  const round = await prisma.activityRound.findFirst({
    where: { organizationId, id: roundId, activityId: registration.activityId },
  });
  if (!round) throw notFound('Round not found.');
  const settings = parseRoundRow(round);
  const attempts = await prisma.attempt.findMany({
    where: {
      organizationId,
      activityId: registration.activityId,
      participantId: registration.participantId,
      roundId,
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
  const source: AssessmentSource = {
    registrationId: registration.id,
    roundId: round.id,
    roundName: round.name,
    roundOrder: round.sortOrder,
    registeredAt: (registration.assignedAt ?? registration.createdAt).toISOString(),
    code: registration.participant.code,
    name: registration.participant.name,
    email: registration.participant.email,
    phone: registration.participant.phone,
    activityId: registration.activity.id,
    assessmentName: registration.activity.name,
    displayStatus: assessmentDisplayStatus(
      registration.activity.status,
      registration.activity.startsAt,
      registration.activity.endsAt,
    ),
    roundSettings: settings,
    resultsPublishedAt: round.resultsPublishedAt?.toISOString() ?? null,
    questionCount: 0,
    maxScore: 0,
    attempts: attempts.map((attempt) => ({
      id: attempt.id,
      status: attempt.status as AssessmentSource['attempts'][number]['status'],
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
  const summaryRow = buildAssessmentRow(source);
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
    answers = buildAttemptReview(selected.questionOrder, responses, reviewVersions, {
      enabled: settings.negativeMarkingEnabled,
      penalty: settings.negativeMarkPoints,
    });
  }
  return {
    registrationId: registration.id,
    roundId: round.id,
    roundName: round.name,
    registeredAt: source.registeredAt,
    code: source.code,
    name: source.name,
    email: source.email,
    phone: source.phone,
    quizName: source.assessmentName,
    contestName: null as string | null,
    passingPercent: summaryRow.passLinePercent,
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
      const passed =
        percent == null || attempt.score == null
          ? null
          : meetsPassRule(settings, attempt.score, percent)
            ? ('pass' as const)
            : ('fail' as const);
      return {
        id: attempt.id,
        number: index + 1,
        counted: attempt.id === summaryRow.bestAttemptId,
        score: percent == null ? null : attempt.score,
        maxScore: attempt.status === 'in_progress' ? null : attempt.maxScore,
        percent,
        result: passed,
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

export async function publishRoundResults(
  organizationId: string,
  actor: AssessmentReportActor,
  roundId: string,
) {
  assertAssessment(actor, 'full');
  const round = await prisma.activityRound.findFirst({
    where: { organizationId, id: roundId, activity: { kind: 'assessment' } },
  });
  if (!round) throw notFound('Round not found.');
  const settings = parseRoundRow(round);
  const withheld = await prisma.result.count({
    where: {
      organizationId,
      releaseStatus: 'withheld',
      attempt: { roundId, organizationId },
    },
  });
  if (settings.scoreRelease !== 'after_publish' && withheld === 0 && !round.resultsPublishedAt) {
    throw badRequest('This round shows scores as soon as a student submits.');
  }
  if (round.resultsPublishedAt && withheld === 0) {
    return { resultsPublishedAt: round.resultsPublishedAt.toISOString() };
  }
  const now = round.resultsPublishedAt ?? new Date();
  const held = await prisma.result.findMany({
    where: { organizationId, releaseStatus: 'withheld', attempt: { roundId } },
    select: { id: true },
  });
  await prisma.$transaction([
    prisma.activityRound.update({
      where: { id: roundId },
      data: { resultsPublishedAt: now },
    }),
    ...(held.length > 0
      ? [
          prisma.result.updateMany({
            where: { organizationId, id: { in: held.map((row) => row.id) } },
            data: { releaseStatus: 'published', publishedAt: now },
          }),
        ]
      : []),
  ]);
  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId: actor.userId,
    action: 'assessment.round_results_publish',
    targetType: 'activity_round',
    targetId: roundId,
  });
  return { resultsPublishedAt: now.toISOString() };
}
