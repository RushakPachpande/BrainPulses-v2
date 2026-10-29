/**
 * One-shot: report attempt/result mismatch, then remove orphaned attempts
 * so students show Not started when there is no result.
 *
 * Usage:
 *   npx tsx --conditions=development scripts/audit-orphan-attempts.ts
 *   npx tsx --conditions=development scripts/audit-orphan-attempts.ts --fix
 */
import '../src/config/load-env.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '#prisma';

const fix = process.argv.includes('--fix');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const byStatus = await prisma.attempt.groupBy({ by: ['status'], _count: true });
  const results = await prisma.result.count();
  const inProgress = await prisma.attempt.findMany({
    where: { status: 'in_progress' },
    select: {
      id: true,
      organizationId: true,
      activityId: true,
      studentId: true,
      roundId: true,
      startedAt: true,
      deadlineAt: true,
      activity: { select: { name: true, kind: true, code: true } },
      student: { select: { name: true, code: true } },
    },
    orderBy: { startedAt: 'desc' },
  });
  const submittedNoResult = await prisma.attempt.findMany({
    where: {
      status: { in: ['submitted', 'auto_submitted'] },
      result: null,
    },
    select: {
      id: true,
      organizationId: true,
      activityId: true,
      studentId: true,
      status: true,
      activity: { select: { name: true, kind: true } },
      student: { select: { name: true, code: true } },
    },
  });
  const openGrants = await prisma.reattemptGrant.count({ where: { consumedAt: null } });

  console.log(
    JSON.stringify(
      {
        mode: fix ? 'fix' : 'audit',
        results,
        byStatus,
        inProgressCount: inProgress.length,
        submittedNoResultCount: submittedNoResult.length,
        openGrants,
        inProgress: inProgress.map((a) => ({
          id: a.id,
          student: `${a.student.name} (${a.student.code})`,
          activity: `${a.activity.name} [${a.activity.kind}]`,
          roundId: a.roundId,
          startedAt: a.startedAt,
          deadlineAt: a.deadlineAt,
        })),
        submittedNoResult: submittedNoResult.map((a) => ({
          id: a.id,
          status: a.status,
          student: `${a.student.name} (${a.student.code})`,
          activity: `${a.activity.name} [${a.activity.kind}]`,
        })),
      },
      null,
      2,
    ),
  );

  if (!fix) {
    console.log('\nRe-run with --fix to delete these orphaned attempts.');
    return;
  }

  const ids = [...inProgress.map((a) => a.id), ...submittedNoResult.map((a) => a.id)];
  if (ids.length === 0) {
    console.log('Nothing to fix.');
    return;
  }

  const orgIds = [...new Set([...inProgress, ...submittedNoResult].map((a) => a.organizationId))];

  const removed = await prisma.$transaction(async (tx) => {
    const delAttempts = await tx.attempt.deleteMany({ where: { id: { in: ids } } });
    let grantsRemoved = 0;
    for (const orgId of orgIds) {
      const pairs = await tx.reattemptGrant.findMany({
        where: { organizationId: orgId },
        select: { id: true, activityId: true, studentId: true },
      });
      for (const g of pairs) {
        const still = await tx.attempt.count({
          where: {
            organizationId: orgId,
            activityId: g.activityId,
            studentId: g.studentId,
          },
        });
        if (still === 0) {
          await tx.reattemptGrant.delete({ where: { id: g.id } });
          grantsRemoved += 1;
        }
      }
    }
    return { attempts: delAttempts.count, grants: grantsRemoved };
  });

  const after = {
    results: await prisma.result.count(),
    byStatus: await prisma.attempt.groupBy({ by: ['status'], _count: true }),
    inProgress: await prisma.attempt.count({ where: { status: 'in_progress' } }),
  };

  console.log(JSON.stringify({ removed, after }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
