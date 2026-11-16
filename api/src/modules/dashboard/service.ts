import { activityStatusDisplay } from '../../lib/activity-status.js';
import { cacheGet, cacheSet, dashboardCacheKey } from '../../lib/cache.js';
import { prisma } from '../../lib/prisma.js';

const AUDIT_PHRASE: Record<string, string> = {
  'participant.session.replace': 'replaced an open sign-in',
  'participant.sign_in_by_code': 'signed in with a Registration ID',
  'participant.sign_in': 'signed in',
  'participant.create': 'added a participant',
  'participant.update': 'updated a participant',
  'participant.delete': 'removed a participant',
  'participant.import': 'imported participants',
  'user.invite': 'invited a user',
  'user.update': 'updated a user',
  'user.delete': 'removed a user',
  'user.password_change': 'changed their password',
  'user.password_reset': 'reset a password',
  'user.import': 'imported users',
  'registration.assign': 'assigned a registration',
  'registration.manual': 'added a registration',
  'registration.unassign': 'removed a registration',
  'registration.export': 'exported registrations',
  'quiz.results_publish': 'published quiz results',
  'assessment.round_results_publish': 'published round results',
  'result.publish': 'published a result',
  'result.regrade': 'regraded a result',
  'result.delete': 'deleted a result',
  'settings.update': 'updated settings',
  'contest_form.update': 'updated a registration form',
  'contest_form.regenerate_link': 'regenerated a registration link',
  'contest_form.give_quiz': 'gave a quiz from a registration form',
  'activity.import_questions': 'imported questions',
  'bank.create': 'created a question bank',
  'bank.update': 'updated a question bank',
  'bank.import': 'imported a question bank',
  'bank.export': 'exported a question bank',
  'question.create': 'added a question',
  'question.update': 'updated a question',
  'sponsor.create': 'created a sponsor',
  'sponsor.update': 'updated a sponsor',
  'sponsor.delete': 'removed a sponsor',
  'contest.create': 'created a contest',
  'contest.update': 'updated a contest',
};

function auditActor(actorType: string, actorName: string | null | undefined) {
  if (actorName?.trim()) return actorName.trim();
  if (actorType === 'participant') return 'A participant';
  if (actorType === 'user') return 'A user';
  return 'Someone';
}

function auditPhrase(action: string) {
  return AUDIT_PHRASE[action] ?? action.replaceAll('.', ' ').replaceAll('_', ' ').trim();
}

function monthLabel(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Month';
  return new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    year: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

export async function getDashboardSummary(organizationId: string) {
  const key = dashboardCacheKey(organizationId);
  const cached = await cacheGet<unknown>(key);
  if (cached) return cached;

  const [totalParticipants, activities, completedAttempts, recentAudit, registrationsByMonth] =
    await Promise.all([
      prisma.participant.count({ where: { organizationId, isActive: true } }),
      prisma.activity.findMany({
        where: { organizationId },
        select: { kind: true, status: true, startsAt: true, endsAt: true },
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

  const activeAssessments = activities.filter(
    (activity) =>
      activity.kind === 'assessment' &&
      activityStatusDisplay(activity.status, activity.startsAt, activity.endsAt) === 'Active',
  ).length;
  const activeQuizzes = activities.filter(
    (activity) =>
      activity.kind === 'quiz' &&
      activityStatusDisplay(activity.status, activity.startsAt, activity.endsAt) === 'Active',
  ).length;
  const registrationSeries = registrationsByMonth.slice().reverse();
  const assessmentAverage = Math.round(Number(assessmentScores._avg.percent ?? 0));
  const quizAverage = Math.round(Number(quizScores._avg.percent ?? 0));

  const summary = {
    kpis: [
      { label: 'Total Participants', value: totalParticipants },
      { label: 'Active Assessments', value: activeAssessments },
      { label: 'Active Quizzes', value: activeQuizzes },
      { label: 'Completed Attempts', value: completedAttempts },
    ],
    charts: [
      {
        title: 'Registrations (monthly)',
        values: registrationSeries.map((row) => Number(row.count)),
        labels: registrationSeries.map((row) => monthLabel(row.month)),
      },
      {
        title: 'Assessment performance (avg %)',
        values: [assessmentAverage],
        labels: ['Average'],
        scaleMax: 100,
      },
      {
        title: 'Quiz performance (avg %)',
        values: [quizAverage],
        labels: ['Average'],
        scaleMax: 100,
      },
    ],
    activity: recentAudit.map((event) => ({
      id: event.id,
      text: `${auditActor(event.actorType, event.actorUser?.name)} ${auditPhrase(event.action)}`,
      at: event.createdAt,
    })),
  };

  await cacheSet(key, summary);
  return summary;
}
