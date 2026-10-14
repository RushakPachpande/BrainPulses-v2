import { Prisma } from '#prisma';
import { writeAudit } from '../../lib/audit.js';
import { notFound } from '../../lib/errors.js';
import { buildPage, listEnvelope } from '../../lib/pagination.js';
import { prisma } from '../../lib/prisma.js';
import type { z } from 'zod';
import type { resultListQuerySchema } from './schema.js';

function mapResult(r: {
  id: string;
  score: Prisma.Decimal;
  maxScore: Prisma.Decimal;
  percent: Prisma.Decimal;
  passed: boolean | null;
  releaseStatus: string;
  publishedAt: Date | null;
  createdAt: Date;
  student: { name: string; code: string };
  activity: { name: string; kind: string };
  attempt: { id: string };
}) {
  return {
    id: r.id,
    student: r.student.name,
    studentCode: r.student.code,
    activity: r.activity.name,
    activityKind: r.activity.kind,
    attemptId: r.attempt.id,
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
  query: z.infer<typeof resultListQuerySchema>,
) {
  const where: Prisma.ResultWhereInput = {
    organizationId,
    ...(query.activityId ? { activityId: query.activityId } : {}),
    ...(query.kind ? { activity: { kind: query.kind } } : {}),
    ...(query.releaseStatus !== 'all' ? { releaseStatus: query.releaseStatus } : {}),
    ...(query.q
      ? {
          OR: [
            { student: { name: { contains: query.q, mode: 'insensitive' } } },
            { activity: { name: { contains: query.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
    ...(query.cursor ? { id: { lt: query.cursor } } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.result.count({ where: { ...where, id: undefined } }),
    prisma.result.findMany({
      where,
      include: { student: true, activity: true, attempt: true },
      orderBy: { createdAt: query.order },
      take: query.limit + 1,
    }),
  ]);

  const { items, page } = buildPage(rows, query.limit, total);
  return listEnvelope(items.map(mapResult), page);
}

export async function getResult(organizationId: string, id: string) {
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
  actorUserId: string,
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
      return getResult(organizationId, id);
    }
  }

  const existing = await prisma.result.findFirst({ where: { organizationId, id } });
  if (!existing) throw notFound('Result not found.');

  await prisma.result.update({
    where: { id },
    data: { releaseStatus: 'published', publishedAt: new Date() },
  });

  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId,
    action: 'result.publish',
    targetType: 'result',
    targetId: id,
    metadata: { idempotencyKey },
  });

  return getResult(organizationId, id);
}

export async function regradeResult(
  organizationId: string,
  actorUserId: string,
  id: string,
  input: { score: number; reason: string },
) {
  const existing = await prisma.result.findFirst({ where: { organizationId, id } });
  if (!existing) throw notFound('Result not found.');

  const maxScore = Number(existing.maxScore);
  const percent = maxScore > 0 ? (input.score / maxScore) * 100 : 0;

  await prisma.$transaction([
    prisma.result.update({
      where: { id },
      data: { score: input.score, percent },
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
    actorUserId,
    action: 'result.regrade',
    targetType: 'result',
    targetId: id,
    metadata: input,
  });

  return getResult(organizationId, id);
}
