/**
 * Wipe every quiz attempt (all students), cascading results/responses,
 * and clear reattempt grants. Assessment attempts are left alone.
 *
 *   npx tsx --conditions=development scripts/wipe-quiz-attempts.ts
 */
import '../src/config/load-env.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '#prisma';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const before = {
    quizAttempts: await prisma.attempt.count({ where: { activity: { kind: 'quiz' } } }),
    quizResults: await prisma.result.count({ where: { activity: { kind: 'quiz' } } }),
    grants: await prisma.reattemptGrant.count(),
    assessmentAttempts: await prisma.attempt.count({
      where: { activity: { kind: 'assessment' } },
    }),
  };
  console.log(JSON.stringify({ before }, null, 2));

  const result = await prisma.$transaction(async (tx) => {
    const attempts = await tx.attempt.deleteMany({
      where: { activity: { kind: 'quiz' } },
    });
    const grants = await tx.reattemptGrant.deleteMany({});
    // Orphan quiz results should already cascade; clear any leftover.
    const results = await tx.result.deleteMany({
      where: { activity: { kind: 'quiz' } },
    });
    return {
      attemptsRemoved: attempts.count,
      grantsRemoved: grants.count,
      resultsRemoved: results.count,
    };
  });

  const after = {
    quizAttempts: await prisma.attempt.count({ where: { activity: { kind: 'quiz' } } }),
    quizResults: await prisma.result.count({ where: { activity: { kind: 'quiz' } } }),
    grants: await prisma.reattemptGrant.count(),
    assessmentAttempts: await prisma.attempt.count({
      where: { activity: { kind: 'assessment' } },
    }),
    allAttemptsByStatus: await prisma.attempt.groupBy({ by: ['status'], _count: true }),
  };

  console.log(JSON.stringify({ result, after }, null, 2));
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
