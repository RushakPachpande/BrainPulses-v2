import { Prisma } from '#prisma';
import { forbidden, notFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { parseQuizSettings } from '../../lib/quiz-settings.js';
import { toNumber } from '../attempts/scoring.js';

function startOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function assertBoardVisible(
  settings: ReturnType<typeof parseQuizSettings>,
  scope: 'daily' | 'overall',
  kind: 'individual' | 'group',
  asStudent: boolean,
) {
  if (!asStudent) return;
  if (settings.leaderboardReleasedAt) {
    const released = new Date(settings.leaderboardReleasedAt);
    if (Number.isFinite(released.getTime()) && released > new Date()) {
      throw forbidden('Leaderboard is not released yet.');
    }
  }
  const ok =
    kind === 'individual'
      ? scope === 'daily'
        ? settings.dailyLeaderboardVisible
        : settings.overallLeaderboardVisible
      : scope === 'daily'
        ? settings.dailyGroupLeaderboardVisible
        : settings.overallGroupLeaderboardVisible;
  if (!ok) throw forbidden('This leaderboard is not visible.');
}

export async function getActivityLeaderboard(
  organizationId: string,
  activityId: string,
  query: { scope: 'daily' | 'overall'; kind: 'individual' | 'group' },
  opts?: { asStudent?: boolean },
) {
  const activity = await prisma.activity.findFirst({ where: { organizationId, id: activityId } });
  if (!activity) throw notFound('Activity not found.');
  if (activity.kind !== 'quiz') throw forbidden('Leaderboards are only available for quizzes.');

  const settings = parseQuizSettings(activity.settings);
  assertBoardVisible(settings, query.scope, query.kind, Boolean(opts?.asStudent));

  const dayStart = startOfUtcDay();
  const results = await prisma.result.findMany({
    where: {
      organizationId,
      activityId,
      attempt: {
        isAuthoritative: true,
        disqualified: false,
        status: { in: ['submitted', 'auto_submitted'] },
        ...(query.scope === 'daily' ? { submittedAt: { gte: dayStart } } : {}),
      },
    },
    include: {
      student: { select: { id: true, name: true, code: true, cohort: true } },
      attempt: { select: { submittedAt: true } },
    },
    orderBy: [{ percent: 'desc' }, { createdAt: 'asc' }],
  });

  if (query.kind === 'individual') {
    return {
      activityId,
      activityName: activity.name,
      scope: query.scope,
      kind: query.kind,
      entries: results.map((r, i) => ({
        rank: i + 1,
        studentId: r.student.id,
        studentName: r.student.name,
        studentCode: r.student.code,
        cohort: r.student.cohort,
        score: toNumber(r.score),
        maxScore: toNumber(r.maxScore),
        percent: toNumber(r.percent),
        submittedAt: r.attempt.submittedAt,
      })),
    };
  }

  if (!settings.countsForGroupLeaderboard) {
    return {
      activityId,
      activityName: activity.name,
      scope: query.scope,
      kind: query.kind,
      entries: [] as {
        rank: number;
        cohort: string;
        members: number;
        avgPercent: number;
        bestPercent: number;
      }[],
    };
  }

  const byCohort = new Map<string, { totalPercent: number; best: number; members: number }>();
  for (const r of results) {
    const cohort = r.student.cohort?.trim();
    if (!cohort) continue;
    const pct = toNumber(r.percent);
    const cur = byCohort.get(cohort) ?? { totalPercent: 0, best: 0, members: 0 };
    cur.totalPercent += pct;
    cur.best = Math.max(cur.best, pct);
    cur.members += 1;
    byCohort.set(cohort, cur);
  }

  const entries = [...byCohort.entries()]
    .map(([cohort, v]) => ({
      cohort,
      members: v.members,
      avgPercent: v.members > 0 ? v.totalPercent / v.members : 0,
      bestPercent: v.best,
    }))
    .sort((a, b) => b.avgPercent - a.avgPercent || b.bestPercent - a.bestPercent)
    .map((e, i) => ({ rank: i + 1, ...e }));

  return {
    activityId,
    activityName: activity.name,
    scope: query.scope,
    kind: query.kind,
    entries,
  };
}

export async function getOrgQuizLeaderboard(
  organizationId: string,
  query: { scope: 'daily' | 'overall'; kind: 'individual' | 'group' },
  opts?: { asStudent?: boolean },
) {
  const dayStart = startOfUtcDay();
  const results = await prisma.result.findMany({
    where: {
      organizationId,
      activity: { kind: 'quiz', status: { in: ['active', 'completed'] } },
      attempt: {
        isAuthoritative: true,
        disqualified: false,
        status: { in: ['submitted', 'auto_submitted'] },
        ...(query.scope === 'daily' ? { submittedAt: { gte: dayStart } } : {}),
      },
    },
    include: {
      student: { select: { id: true, name: true, code: true, cohort: true } },
      activity: { select: { id: true, name: true, settings: true } },
      attempt: { select: { submittedAt: true } },
    },
  });

  // Filter by each activity's visibility when student
  const filtered = results.filter((r) => {
    if (!opts?.asStudent) return true;
    const settings = parseQuizSettings(r.activity.settings as Prisma.JsonValue);
    try {
      assertBoardVisible(settings, query.scope, query.kind, true);
      return true;
    } catch {
      return false;
    }
  });

  if (query.kind === 'individual') {
    const byStudent = new Map<
      string,
      {
        studentId: string;
        studentName: string;
        studentCode: string;
        cohort: string | null;
        totalPercent: number;
        count: number;
        best: number;
      }
    >();
    for (const r of filtered) {
      const pct = toNumber(r.percent);
      const cur = byStudent.get(r.student.id) ?? {
        studentId: r.student.id,
        studentName: r.student.name,
        studentCode: r.student.code,
        cohort: r.student.cohort,
        totalPercent: 0,
        count: 0,
        best: 0,
      };
      cur.totalPercent += pct;
      cur.count += 1;
      cur.best = Math.max(cur.best, pct);
      byStudent.set(r.student.id, cur);
    }
    const entries = [...byStudent.values()]
      .map((s) => ({
        studentId: s.studentId,
        studentName: s.studentName,
        studentCode: s.studentCode,
        cohort: s.cohort,
        avgPercent: s.count > 0 ? s.totalPercent / s.count : 0,
        bestPercent: s.best,
        attempts: s.count,
      }))
      .sort((a, b) => b.avgPercent - a.avgPercent || b.bestPercent - a.bestPercent)
      .map((e, i) => ({ rank: i + 1, ...e }));

    return { scope: query.scope, kind: query.kind, entries };
  }

  const byCohort = new Map<string, { totalPercent: number; best: number; members: Set<string> }>();
  for (const r of filtered) {
    const settings = parseQuizSettings(r.activity.settings as Prisma.JsonValue);
    if (!settings.countsForGroupLeaderboard) continue;
    const cohort = r.student.cohort?.trim();
    if (!cohort) continue;
    const pct = toNumber(r.percent);
    const cur = byCohort.get(cohort) ?? {
      totalPercent: 0,
      best: 0,
      members: new Set<string>(),
    };
    cur.totalPercent += pct;
    cur.best = Math.max(cur.best, pct);
    cur.members.add(r.student.id);
    byCohort.set(cohort, cur);
  }

  const entries = [...byCohort.entries()]
    .map(([cohort, v]) => ({
      cohort,
      members: v.members.size,
      avgPercent: v.members.size > 0 ? v.totalPercent / Math.max(v.members.size, 1) : 0,
      bestPercent: v.best,
    }))
    .sort((a, b) => b.avgPercent - a.avgPercent || b.bestPercent - a.bestPercent)
    .map((e, i) => ({ rank: i + 1, ...e }));

  return { scope: query.scope, kind: query.kind, entries };
}
