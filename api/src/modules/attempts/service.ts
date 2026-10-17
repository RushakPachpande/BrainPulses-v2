import { Prisma } from '#prisma';
import { writeAudit } from '../../lib/audit.js';
import { invalidateDashboard } from '../../lib/cache.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { scoreObjective, toNumber } from './scoring.js';

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

function mapAttempt(a: {
  id: string;
  status: string;
  revision: number;
  startedAt: Date;
  deadlineAt: Date;
  submittedAt: Date | null;
  activityId: string;
  studentId: string;
  responses?: {
    questionVersionId: string;
    answer: Prisma.JsonValue;
    revision: number;
  }[];
}) {
  return {
    id: a.id,
    status: a.status,
    revision: a.revision,
    startedAt: a.startedAt,
    deadlineAt: a.deadlineAt,
    submittedAt: a.submittedAt,
    activityId: a.activityId,
    studentId: a.studentId,
    responses: (a.responses ?? []).map((r) => ({
      questionVersionId: r.questionVersionId,
      answer: r.answer,
      revision: r.revision,
    })),
  };
}

export async function startAttempt(organizationId: string, studentId: string, activityId: string) {
  const activity = await prisma.activity.findFirst({
    where: { organizationId, id: activityId },
    include: {
      activityBanks: {
        include: {
          bank: {
            include: {
              questions: {
                where: { isActive: true },
                include: {
                  versions: { orderBy: { version: 'desc' }, take: 1 },
                },
              },
            },
          },
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

  const open = await prisma.attempt.findFirst({
    where: { organizationId, activityId, studentId, status: 'in_progress' },
  });
  if (open) {
    const refreshed = await autoSubmitIfExpired(open);
    if (refreshed && 'status' in refreshed && refreshed.status === 'in_progress') {
      throw conflict('An open attempt already exists. Resume it instead.');
    }
  }

  const durationMs = (activity.durationMinutes ?? 60) * 60_000;
  let deadlineAt = new Date(now.getTime() + durationMs);
  if (activity.endsAt && activity.endsAt < deadlineAt) {
    deadlineAt = activity.endsAt;
  }

  const versionIds = activity.activityBanks.flatMap((ab) =>
    ab.bank.questions.map((q) => q.versions[0]?.id).filter((id): id is string => Boolean(id)),
  );

  const attempt = await prisma.attempt.create({
    data: {
      organizationId,
      activityId,
      studentId,
      status: 'in_progress',
      revision: 0,
      startedAt: now,
      deadlineAt,
      responses: {
        create: versionIds.map((questionVersionId) => ({
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

  const versions = await prisma.questionVersion.findMany({
    where: { organizationId, id: { in: versionIds } },
    include: {
      options: {
        orderBy: { sortOrder: 'asc' },
        select: { id: true, label: true, body: true, sortOrder: true },
      },
    },
  });

  return {
    attempt: mapAttempt(attempt),
    questions: versions.map((v) => ({
      questionVersionId: v.id,
      type: v.type,
      stem: v.stem,
      points: toNumber(v.points),
      options: v.options,
    })),
  };
}

export async function resumeAttempt(organizationId: string, studentId: string, attemptId: string) {
  const attempt = await prisma.attempt.findFirst({
    where: { organizationId, id: attemptId, studentId },
    include: { responses: true },
  });
  if (!attempt) throw notFound('Attempt not found.');

  const maybe = await autoSubmitIfExpired(attempt);
  if (maybe && 'result' in maybe) {
    return { attempt: maybe.attempt, submitted: true, result: maybe.result };
  }

  const live = await prisma.attempt.findFirst({
    where: { organizationId, id: attemptId },
    include: { responses: true },
  });
  if (!live || live.status !== 'in_progress') {
    throw conflict('Attempt is no longer in progress.');
  }

  const versionIds = live.responses.map((r) => r.questionVersionId);
  const versions = await prisma.questionVersion.findMany({
    where: { organizationId, id: { in: versionIds } },
    include: {
      options: {
        orderBy: { sortOrder: 'asc' },
        select: { id: true, label: true, body: true, sortOrder: true },
      },
    },
  });

  return {
    attempt: mapAttempt(live),
    questions: versions.map((v) => ({
      questionVersionId: v.id,
      type: v.type,
      stem: v.stem,
      points: toNumber(v.points),
      options: v.options,
    })),
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
    include: { result: true, responses: true },
  });
  if (existingByKey?.result) {
    return {
      attempt: mapAttempt(existingByKey),
      result: existingByKey.result,
    };
  }

  const attempt = await prisma.attempt.findFirst({
    where: { organizationId, id: attemptId, studentId },
    include: {
      responses: true,
      activity: true,
      result: true,
    },
  });
  if (!attempt) throw notFound('Attempt not found.');

  if (
    attempt.submitIdempotencyKey &&
    attempt.submitIdempotencyKey === opts.idempotencyKey &&
    attempt.result
  ) {
    return { attempt: mapAttempt(attempt), result: attempt.result };
  }

  if (attempt.status !== 'in_progress' && attempt.result) {
    if (attempt.submitIdempotencyKey === opts.idempotencyKey) {
      return { attempt: mapAttempt(attempt), result: attempt.result };
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
    maxScore += pts;
    const earned = scoreObjective(version.type, version.answerKey, response.answer, pts);
    if (earned !== null) score += earned;
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

  return { attempt: mapAttempt(updated), result };
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
