import type { AccessLevel, ActivityKind, MembershipRole } from '#prisma';
import { badRequest } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { assertActivityAccess } from '../activities/service.js';

export type WipeActor = {
  userId: string;
  role: MembershipRole;
  assessmentAccess: AccessLevel;
  quizAccess: AccessLevel;
};

/** Extended Prisma client used inside `$transaction` callbacks. */
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Deletes all attempts for a student on an activity (quiz) or round (assessment),
 * cascading responses/results, and clearing quiz reattempt grants.
 */
export async function wipeStudentActivityAttempts(
  tx: Tx,
  input: {
    organizationId: string;
    activityId: string;
    studentId: string;
    attemptId: string;
    roundId: string | null;
    activityKind: ActivityKind;
    resultId?: string | null;
  },
): Promise<number> {
  const isQuiz = input.activityKind === 'quiz';
  const removed = await tx.attempt.deleteMany({
    where: {
      organizationId: input.organizationId,
      activityId: input.activityId,
      studentId: input.studentId,
      ...(isQuiz ? {} : input.roundId ? { roundId: input.roundId } : { id: input.attemptId }),
    },
  });

  await tx.attempt.deleteMany({
    where: { organizationId: input.organizationId, id: input.attemptId },
  });

  await tx.result.deleteMany({
    where: {
      organizationId: input.organizationId,
      activityId: input.activityId,
      studentId: input.studentId,
      ...(isQuiz ? {} : input.resultId ? { id: input.resultId } : {}),
    },
  });

  if (isQuiz) {
    await tx.reattemptGrant.deleteMany({
      where: {
        organizationId: input.organizationId,
        activityId: input.activityId,
        studentId: input.studentId,
      },
    });
  }

  const leftoverOpen = await tx.attempt.count({
    where: {
      organizationId: input.organizationId,
      activityId: input.activityId,
      studentId: input.studentId,
      status: 'in_progress',
      ...(isQuiz ? {} : input.roundId ? { roundId: input.roundId } : {}),
    },
  });
  if (leftoverOpen > 0) {
    throw badRequest('Could not clear all open attempts for this student.');
  }

  return removed.count;
}

export function assertCanWipeActivity(actor: WipeActor, kind: ActivityKind): void {
  assertActivityAccess(actor.role, actor.assessmentAccess, actor.quizAccess, kind, 'full');
}
