import { Prisma, type AccessLevel, type ActivityKind, type MembershipRole } from '#prisma';
import { writeAudit } from '../../lib/audit.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { buildPage, listEnvelope, prismaCursorArgs } from '../../lib/pagination.js';
import { prisma } from '../../lib/prisma.js';
import { assertActivityAccess } from '../activities/service.js';
import type { z } from 'zod';
import type { resultListQuerySchema } from './schema.js';

export type ResultsActor = {
  userId: string;
  role: MembershipRole;
  assessmentAccess: AccessLevel;
  quizAccess: AccessLevel;
};

function viewableKinds(actor: ResultsActor): ActivityKind[] {
  if (actor.role === 'super_admin') return ['assessment', 'quiz'];
  const kinds: ActivityKind[] = [];
  if (actor.assessmentAccess !== 'none') kinds.push('assessment');
  if (actor.quizAccess !== 'none') kinds.push('quiz');
  return kinds;
}

function mapResult(r: {
  id: string;
  activityId: string;
  studentId: string;
  score: Prisma.Decimal;
  maxScore: Prisma.Decimal;
  percent: Prisma.Decimal;
  passed: boolean | null;
  releaseStatus: string;
  publishedAt: Date | null;
  createdAt: Date;
  student: { name: string; code: string };
  activity: { name: string; kind: string };
  attempt: { id: string; disqualified: boolean };
}) {
  return {
    id: r.id,
    activityId: r.activityId,
    studentId: r.studentId,
    student: r.student.name,
    studentCode: r.student.code,
    activity: r.activity.name,
    activityKind: r.activity.kind,
    attemptId: r.attempt.id,
    disqualified: r.attempt.disqualified,
    score: Number(r.score),
    maxScore: Number(r.maxScore),
    percent: Number(r.percent),
    passed: r.passed,
    status: r.passed === null ? 'Pending' : r.passed ? 'Passed' : 'Failed',
    releaseStatus: r.releaseStatus,
    publishedAt: r.publishedAt,
    submitted: r.createdAt,
  };
}

export async function listResults(
  organizationId: string,
  actor: ResultsActor,
  query: z.infer<typeof resultListQuerySchema>,
) {
  const kinds = viewableKinds(actor);
  const allowedKinds =
    query.kind && kinds.includes(query.kind) ? [query.kind] : query.kind ? [] : kinds;

  const where: Prisma.ResultWhereInput = {
    organizationId,
    ...(query.activityId ? { activityId: query.activityId } : {}),
    activity:
      allowedKinds.length > 0
        ? { kind: { in: allowedKinds } }
        : { id: '00000000-0000-0000-0000-000000000000' },
    ...(query.releaseStatus !== 'all' ? { releaseStatus: query.releaseStatus } : {}),
    ...(query.q
      ? {
          OR: [
            { student: { name: { contains: query.q, mode: 'insensitive' } } },
            { activity: { name: { contains: query.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.result.count({ where }),
    prisma.result.findMany({
      where,
      include: { student: true, activity: true, attempt: true },
      ...prismaCursorArgs(query),
    }),
  ]);

  const { items, page } = buildPage(rows, query.limit, total);
  return listEnvelope(items.map(mapResult), page);
}

export async function getResult(organizationId: string, actor: ResultsActor, id: string) {
  const result = await prisma.result.findFirst({
    where: { organizationId, id },
    include: {
      student: true,
      activity: true,
      attempt: true,
      revisions: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!result) throw notFound('Result not found.');
  assertActivityAccess(
    actor.role,
    actor.assessmentAccess,
    actor.quizAccess,
    result.activity.kind,
    'view',
  );
  return {
    ...mapResult(result),
    revisions: result.revisions.map((rev) => ({
      id: rev.id,
      score: Number(rev.score),
      maxScore: Number(rev.maxScore),
      percent: Number(rev.percent),
      reason: rev.reason,
      createdAt: rev.createdAt,
    })),
  };
}

export async function publishResult(
  organizationId: string,
  actor: ResultsActor,
  id: string,
  idempotencyKey?: string,
) {
  if (idempotencyKey) {
    const prior = await prisma.auditEvent.findFirst({
      where: {
        organizationId,
        action: 'result.publish',
        targetId: id,
        metadata: { path: ['idempotencyKey'], equals: idempotencyKey },
      },
    });
    if (prior) {
      return getResult(organizationId, actor, id);
    }
  }

  const existing = await prisma.result.findFirst({
    where: { organizationId, id },
    include: { activity: true },
  });
  if (!existing) throw notFound('Result not found.');
  assertActivityAccess(
    actor.role,
    actor.assessmentAccess,
    actor.quizAccess,
    existing.activity.kind,
    'full',
  );

  await prisma.result.update({
    where: { id },
    data: { releaseStatus: 'published', publishedAt: new Date() },
  });

  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId: actor.userId,
    action: 'result.publish',
    targetType: 'result',
    targetId: id,
    metadata: { idempotencyKey },
  });

  return getResult(organizationId, actor, id);
}

export async function regradeResult(
  organizationId: string,
  actor: ResultsActor,
  id: string,
  input: { score: number; reason: string },
) {
  const existing = await prisma.result.findFirst({
    where: { organizationId, id },
    include: { activity: { select: { kind: true, passingPercent: true } } },
  });
  if (!existing) throw notFound('Result not found.');
  assertActivityAccess(
    actor.role,
    actor.assessmentAccess,
    actor.quizAccess,
    existing.activity.kind,
    'full',
  );

  const maxScore = Number(existing.maxScore);
  if (input.score > maxScore) {
    throw badRequest('Score cannot exceed max score.', { score: String(maxScore) });
  }
  const percent = maxScore > 0 ? (input.score / maxScore) * 100 : 0;
  const passing =
    existing.activity.passingPercent !== null ? Number(existing.activity.passingPercent) : null;
  const passed = passing === null ? existing.passed : percent >= passing;

  await prisma.$transaction([
    prisma.result.update({
      where: { id },
      data: { score: input.score, percent, passed },
    }),
    prisma.resultRevision.create({
      data: {
        organizationId,
        resultId: id,
        score: input.score,
        maxScore,
        percent,
        reason: input.reason,
      },
    }),
  ]);

  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId: actor.userId,
    action: 'result.regrade',
    targetType: 'result',
    targetId: id,
    metadata: input,
  });

  return getResult(organizationId, actor, id);
}
