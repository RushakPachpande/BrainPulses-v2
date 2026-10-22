import { Prisma } from '#prisma';
import { notFound } from '../../lib/errors.js';
import { buildPage, listEnvelope, prismaCursorArgs } from '../../lib/pagination.js';
import { prisma } from '../../lib/prisma.js';
import { parseQuizSettings } from '../../lib/quiz-settings.js';
import { scoreObjective, toNumber } from '../attempts/scoring.js';
import type { z } from 'zod';
import type {
  patchProfileSchema,
  studentActivitiesQuerySchema,
  studentResultsQuerySchema,
} from './schema.js';

function explanationFromAnswerKey(answerKey: Prisma.JsonValue): string | null {
  if (!answerKey || typeof answerKey !== 'object' || Array.isArray(answerKey)) return null;
  const value = (answerKey as Record<string, unknown>).explanation;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function getMe(organizationId: string, studentId: string) {
  const student = await prisma.student.findFirst({
    where: { organizationId, id: studentId, isActive: true },
    include: { organization: { select: { id: true, name: true, slug: true } } },
  });
  if (!student) throw notFound('Student not found.');
  return {
    id: student.id,
    code: student.code,
    name: student.name,
    email: student.email,
    phone: student.phone,
    course: student.course,
    city: student.city,
    organization: student.organization,
  };
}

export async function patchMe(
  organizationId: string,
  studentId: string,
  input: z.infer<typeof patchProfileSchema>,
) {
  const existing = await prisma.student.findFirst({
    where: { organizationId, id: studentId, isActive: true },
  });
  if (!existing) throw notFound('Student not found.');

  await prisma.student.updateMany({
    where: { organizationId, id: studentId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
    },
  });

  return getMe(organizationId, studentId);
}

export async function listMyActivities(
  organizationId: string,
  studentId: string,
  query: z.infer<typeof studentActivitiesQuerySchema>,
) {
  const where: Prisma.RegistrationWhereInput = {
    organizationId,
    studentId,
    status: 'assigned',
    activity: {
      status: { in: ['active', 'completed'] },
      ...(query.kind !== 'all' ? { kind: query.kind } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { subtitle: { contains: query.q, mode: 'insensitive' } },
              { code: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
  };

  const [total, rows] = await Promise.all([
    prisma.registration.count({ where }),
    prisma.registration.findMany({
      where,
      include: {
        activity: {
          include: {
            activityBanks: {
              include: {
                bank: {
                  include: {
                    _count: { select: { questions: { where: { isActive: true } } } },
                  },
                },
              },
            },
            rounds: {
              orderBy: { sortOrder: 'asc' },
              include: {
                banks: {
                  include: {
                    bank: {
                      include: {
                        _count: { select: { questions: { where: { isActive: true } } } },
                      },
                    },
                  },
                },
                localBank: {
                  include: {
                    _count: { select: { questions: { where: { isActive: true } } } },
                  },
                },
              },
            },
            attempts: {
              where: { studentId },
              orderBy: { startedAt: 'desc' },
              include: { result: true },
            },
          },
        },
      },
      ...prismaCursorArgs(query),
    }),
  ]);

  const { items, page } = buildPage(rows, query.limit, total);
  const now = new Date();
  return listEnvelope(
    items.map((row) => {
      const activity = row.activity;
      const isAssessment = activity.kind === 'assessment';

      const questionCount = isAssessment
        ? activity.rounds.reduce((n, round) => {
            const fromBanks = round.banks.reduce((m, b) => m + b.bank._count.questions, 0);
            const fromLocal = round.localBank?._count.questions ?? 0;
            return n + fromBanks + fromLocal;
          }, 0)
        : activity.activityBanks.reduce((n, ab) => n + ab.bank._count.questions, 0);

      const attempts = activity.attempts;
      const openAttempt = attempts.find((a) => a.status === 'in_progress');
      const latest = attempts[0];

      let attemptState: 'not_started' | 'in_progress' | 'submitted' = 'not_started';
      if (isAssessment && activity.rounds.length > 0) {
        const allDone = activity.rounds.every((round) =>
          attempts.some(
            (a) =>
              a.roundId === round.id &&
              (a.status === 'submitted' || a.status === 'auto_submitted' || Boolean(a.result)),
          ),
        );
        if (openAttempt) attemptState = 'in_progress';
        else if (allDone) attemptState = 'submitted';
        else if (attempts.length > 0) attemptState = 'in_progress';
      } else if (latest) {
        if (latest.status === 'in_progress') attemptState = 'in_progress';
        else if (
          latest.status === 'submitted' ||
          latest.status === 'auto_submitted' ||
          latest.result
        ) {
          attemptState = 'submitted';
        }
      }

      // Mirrors startAttempt guards so the client does not offer Start → 403.
      let canAttempt = activity.status === 'active';
      let attemptBlockedReason: string | null = null;
      if (activity.status !== 'active') {
        attemptBlockedReason =
          activity.status === 'completed'
            ? 'This activity is closed.'
            : 'Activity is not open for attempts.';
      } else if (activity.startsAt && activity.startsAt > now) {
        canAttempt = false;
        attemptBlockedReason = 'Activity has not started yet.';
      } else if (activity.endsAt && activity.endsAt < now) {
        canAttempt = false;
        attemptBlockedReason = 'Activity window has ended.';
      }

      const rounds = isAssessment
        ? activity.rounds.map((round, index) => {
            const roundAttempts = attempts.filter((a) => a.roundId === round.id);
            const open = roundAttempts.find((a) => a.status === 'in_progress');
            const done = roundAttempts.find(
              (a) => a.status === 'submitted' || a.status === 'auto_submitted' || Boolean(a.result),
            );
            let state: 'locked' | 'available' | 'in_progress' | 'completed';
            if (done) {
              state = 'completed';
            } else if (open) {
              state = 'in_progress';
            } else if (!canAttempt) {
              state = 'locked';
            } else if (index === 0) {
              state = 'available';
            } else {
              const prev = activity.rounds[index - 1];
              const prevDone = prev
                ? attempts.some(
                    (a) =>
                      a.roundId === prev.id &&
                      (a.status === 'submitted' ||
                        a.status === 'auto_submitted' ||
                        Boolean(a.result)),
                  )
                : false;
              state = prevDone ? 'available' : 'locked';
            }
            const qCount =
              round.banks.reduce((n, b) => n + b.bank._count.questions, 0) +
              (round.localBank?._count.questions ?? 0);
            return {
              id: round.id,
              name: round.name,
              sortOrder: round.sortOrder,
              durationMinutes: round.durationMinutes ?? activity.durationMinutes,
              questionCount: qCount,
              state,
              openAttemptId: open?.id ?? null,
              latestResultId: done?.result?.id ?? null,
            };
          })
        : undefined;

      const latestCompleted = attempts.find(
        (a) => a.status === 'submitted' || a.status === 'auto_submitted' || Boolean(a.result),
      );

      const quizSettings = activity.kind === 'quiz' ? parseQuizSettings(activity.settings) : null;
      let leaderboardAvailable = false;
      if (quizSettings) {
        const released =
          !quizSettings.leaderboardReleasedAt ||
          new Date(quizSettings.leaderboardReleasedAt) <= new Date();
        leaderboardAvailable =
          released &&
          (quizSettings.dailyLeaderboardVisible ||
            quizSettings.overallLeaderboardVisible ||
            quizSettings.dailyGroupLeaderboardVisible ||
            quizSettings.overallGroupLeaderboardVisible);
      }

      return {
        registrationId: row.id,
        activityId: activity.id,
        code: activity.code,
        name: activity.name,
        subtitle: activity.subtitle,
        kind: activity.kind,
        status: activity.status,
        durationMinutes: activity.durationMinutes,
        startsAt: activity.startsAt,
        endsAt: activity.endsAt,
        questionCount,
        attemptState,
        canAttempt,
        attemptBlockedReason,
        openAttemptId: openAttempt?.id ?? null,
        latestResultId: latestCompleted?.result?.id ?? null,
        latestPercent: latestCompleted?.result ? toNumber(latestCompleted.result.percent) : null,
        leaderboardAvailable,
        ...(rounds ? { rounds } : {}),
      };
    }),
    page,
  );
}

export async function listMyResults(
  organizationId: string,
  studentId: string,
  query: z.infer<typeof studentResultsQuerySchema>,
) {
  const activityFilter: Prisma.ActivityWhereInput = {
    ...(query.kind !== 'all' ? { kind: query.kind } : {}),
    ...(query.q ? { name: { contains: query.q, mode: 'insensitive' } } : {}),
  };
  const where: Prisma.ResultWhereInput = {
    organizationId,
    studentId,
    ...(Object.keys(activityFilter).length > 0 ? { activity: activityFilter } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.result.count({ where }),
    prisma.result.findMany({
      where,
      include: {
        activity: { select: { id: true, name: true, kind: true, code: true, settings: true } },
        attempt: {
          select: {
            id: true,
            startedAt: true,
            submittedAt: true,
            status: true,
            roundId: true,
            round: { select: { id: true, name: true, sortOrder: true } },
          },
        },
      },
      ...prismaCursorArgs(query),
    }),
  ]);

  const { items, page } = buildPage(rows, query.limit, total);
  return listEnvelope(
    items.map((r) => {
      const published = r.releaseStatus === 'published';
      const quizSettings =
        r.activity.kind === 'quiz' ? parseQuizSettings(r.activity.settings) : null;
      const scoreOk = published && (quizSettings?.scoreVisibleToStudent ?? true);
      return {
        id: r.id,
        activityId: r.activity.id,
        activityCode: r.activity.code,
        title: r.activity.name,
        kind: r.activity.kind,
        attemptId: r.attempt.id,
        roundId: r.attempt.roundId,
        roundName: r.attempt.round?.name ?? null,
        score: scoreOk ? toNumber(r.score) : null,
        maxScore: scoreOk ? toNumber(r.maxScore) : null,
        percent: scoreOk ? toNumber(r.percent) : null,
        passed: scoreOk ? r.passed : null,
        releaseStatus: r.releaseStatus,
        submittedAt: r.attempt.submittedAt ?? r.createdAt,
        durationMinutes:
          r.attempt.startedAt && r.attempt.submittedAt
            ? Math.max(
                1,
                Math.round(
                  (r.attempt.submittedAt.getTime() - r.attempt.startedAt.getTime()) / 60_000,
                ),
              )
            : null,
      };
    }),
    page,
  );
}

export async function getMyResult(organizationId: string, studentId: string, resultId: string) {
  const result = await prisma.result.findFirst({
    where: { organizationId, id: resultId, studentId },
    include: {
      activity: true,
      attempt: {
        include: {
          responses: true,
        },
      },
    },
  });
  if (!result) throw notFound('Result not found.');

  const versionIds = result.attempt.responses.map((r) => r.questionVersionId);
  const versions = await prisma.questionVersion.findMany({
    where: { organizationId, id: { in: versionIds } },
    include: {
      options: {
        orderBy: { sortOrder: 'asc' },
        select: { id: true, label: true, body: true, sortOrder: true, isCorrect: true },
      },
    },
  });
  const byId = new Map(versions.map((v) => [v.id, v]));

  const quizSettings =
    result.activity.kind === 'quiz' ? parseQuizSettings(result.activity.settings) : null;
  const published = result.releaseStatus === 'published';
  const scoreOk = published && (quizSettings?.scoreVisibleToStudent ?? true);
  const includeKeys = published && (quizSettings?.answersVisibleToStudent ?? published);

  const review = result.attempt.responses.map((response) => {
    const version = byId.get(response.questionVersionId);
    if (!version) {
      return {
        questionVersionId: response.questionVersionId,
        question: 'Question unavailable',
        options: [] as { label: string; body: string }[],
        yourAnswer: response.answer,
        correct: null as boolean | null,
        correctLabels: [] as string[],
        explanation: null as string | null,
      };
    }
    const pts = toNumber(version.points);
    const earned = includeKeys
      ? scoreObjective(version.type, version.answerKey, response.answer, pts)
      : null;
    const correctLabels = includeKeys
      ? version.options.filter((o) => o.isCorrect).map((o) => o.label)
      : [];
    return {
      questionVersionId: version.id,
      question: version.question,
      options: version.options.map((o) => ({
        label: o.label,
        body: o.body,
        ...(includeKeys ? { isCorrect: o.isCorrect } : {}),
      })),
      yourAnswer: response.answer,
      correct: includeKeys ? (earned === null ? null : earned > 0) : null,
      correctLabels,
      explanation: includeKeys ? explanationFromAnswerKey(version.answerKey) : null,
    };
  });

  return {
    id: result.id,
    title: result.activity.name,
    kind: result.activity.kind,
    activityId: result.activity.id,
    attemptId: result.attempt.id,
    score: scoreOk ? toNumber(result.score) : null,
    maxScore: scoreOk ? toNumber(result.maxScore) : null,
    percent: scoreOk ? toNumber(result.percent) : null,
    passed: scoreOk ? result.passed : null,
    releaseStatus: result.releaseStatus,
    answersVisible: includeKeys,
    submittedAt: result.attempt.submittedAt ?? result.createdAt,
    review: includeKeys ? review : [],
  };
}
