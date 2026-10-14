import { cacheGet, cacheSet, dashboardCacheKey } from '../../lib/cache.js';
import { prisma } from '../../lib/prisma.js';

export async function getDashboardSummary(organizationId: string) {
  const key = dashboardCacheKey(organizationId);
  const cached = await cacheGet<unknown>(key);
  if (cached) return cached;

  const [
    totalStudents,
    activeAssessments,
    activeQuizzes,
    completedAttempts,
    recentAudit,
    registrationsByMonth,
  ] = await Promise.all([
    prisma.student.count({ where: { organizationId, isActive: true } }),
    prisma.activity.count({
      where: { organizationId, kind: 'assessment', status: 'active' },
    }),
    prisma.activity.count({
      where: { organizationId, kind: 'quiz', status: 'active' },
    }),
    prisma.attempt.count({
      where: {
        organizationId,
        status: { in: ['submitted', 'auto_submitted'] },
      },
    }),
    prisma.auditEvent.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { actorUser: { select: { name: true } } },
    }),
    prisma.$queryRaw<{ month: Date; count: bigint }[]>`
      SELECT date_trunc('month', created_at) AS month, COUNT(*)::bigint AS count
      FROM registrations
      WHERE organization_id = ${organizationId}::uuid
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT 6
    `,
  ]);

  const assessmentScores = await prisma.result.aggregate({
    where: { organizationId, activity: { kind: 'assessment' } },
    _avg: { percent: true },
  });
  const quizScores = await prisma.result.aggregate({
    where: { organizationId, activity: { kind: 'quiz' } },
    _avg: { percent: true },
  });

  const summary = {
    kpis: [
      { label: 'Total Students', value: totalStudents },
      { label: 'Active Assessments', value: activeAssessments },
      { label: 'Active Quizzes', value: activeQuizzes },
      { label: 'Completed Attempts', value: completedAttempts },
    ],
    charts: [
      {
        title: 'Registrations (monthly)',
        values: registrationsByMonth
          .slice()
          .reverse()
          .map((r) => Number(r.count)),
      },
      {
        title: 'Assessment performance (avg %)',
        values: [Number(assessmentScores._avg.percent ?? 0)],
      },
      {
        title: 'Quiz performance (avg %)',
        values: [Number(quizScores._avg.percent ?? 0)],
      },
    ],
    activity: recentAudit.map((e) => ({
      text: `${e.actorUser?.name ?? e.actorType} ${e.action}`,
      at: e.createdAt,
    })),
  };

  await cacheSet(key, summary);
  return summary;
}
