import { Prisma } from '#prisma';
import { notFound } from '../../lib/errors.js';
import { buildPage, listEnvelope, prismaCursorArgs } from '../../lib/pagination.js';
import { prisma } from '../../lib/prisma.js';
import { scoreObjective, toNumber } from '../attempts/scoring.js';
import type { z } from 'zod';
import type {
  patchProfileSchema,
  studentActivitiesQuerySchema,
  studentResultsQuerySchema,
} from './schema.js';

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
            attempts: {
              where: { studentId },
              orderBy: { startedAt: 'desc' },
              take: 1,
              include: { result: true },
            },
          },
        },
      },
      ...prismaCursorArgs(query),
    }),
  ]);

  const { items, page } = buildPage(rows, query.limit, total);
  return listEnvelope(
    items.map((row) => {
      const activity = row.activity;
      const questionCount = activity.activityBanks.reduce(
        (n, ab) => n + ab.bank._count.questions,
        0,
      );
      const latest = activity.attempts[0];
      let attemptState: 'not_started' | 'in_progress' | 'submitted' = 'not_started';
      if (latest) {
        if (latest.status === 'in_progress') attemptState = 'in_progress';
        else if (
          latest.status === 'submitted' ||
          latest.status === 'auto_submitted' ||
          latest.result
        ) {
          attemptState = 'submitted';
        }
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
        openAttemptId: latest?.status === 'in_progress' ? latest.id : null,
        latestResultId: latest?.result?.id ?? null,
        latestPercent: latest?.result ? toNumber(latest.result.percent) : null,
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
        activity: { select: { id: true, name: true, kind: true, code: true } },
        attempt: { select: { id: true, startedAt: true, submittedAt: true, status: true } },
      },
      ...prismaCursorArgs(query),
    }),
  ]);

  const { items, page } = buildPage(rows, query.limit, total);
  return listEnvelope(
    items.map((r) => {
      const published = r.releaseStatus === 'published';
      return {
        id: r.id,
        activityId: r.activity.id,
        activityCode: r.activity.code,
        title: r.activity.name,
        kind: r.activity.kind,
        attemptId: r.attempt.id,
        score: published ? toNumber(r.score) : null,
        maxScore: published ? toNumber(r.maxScore) : null,
        percent: published ? toNumber(r.percent) : null,
        passed: published ? r.passed : null,
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

  const includeKeys = result.releaseStatus === 'published';

  const review = result.attempt.responses.map((response) => {
    const version = byId.get(response.questionVersionId);
    if (!version) {
      return {
        questionVersionId: response.questionVersionId,
        stem: 'Question unavailable',
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
      stem: version.stem,
      options: version.options.map((o) => ({
        label: o.label,
        body: o.body,
        ...(includeKeys ? { isCorrect: o.isCorrect } : {}),
      })),
      yourAnswer: response.answer,
      correct: includeKeys ? (earned === null ? null : earned > 0) : null,
      correctLabels,
      explanation: null,
    };
  });

  return {
    id: result.id,
    title: result.activity.name,
    kind: result.activity.kind,
    activityId: result.activity.id,
    attemptId: result.attempt.id,
    score: includeKeys ? toNumber(result.score) : null,
    maxScore: includeKeys ? toNumber(result.maxScore) : null,
    percent: includeKeys ? toNumber(result.percent) : null,
    passed: includeKeys ? result.passed : null,
    releaseStatus: result.releaseStatus,
    submittedAt: result.attempt.submittedAt ?? result.createdAt,
    review,
  };
}
