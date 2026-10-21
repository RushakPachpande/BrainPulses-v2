import type { Prisma } from '#prisma';

export type QuizSettings = {
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  scoreVisibleToStudent: boolean;
  answersVisibleToStudent: boolean;
  dailyLeaderboardVisible: boolean;
  overallLeaderboardVisible: boolean;
  dailyGroupLeaderboardVisible: boolean;
  overallGroupLeaderboardVisible: boolean;
  countsForGroupLeaderboard: boolean;
  leaderboardReleasedAt: string | null;
};

export const defaultQuizSettings: QuizSettings = {
  shuffleQuestions: true,
  shuffleOptions: true,
  scoreVisibleToStudent: false,
  answersVisibleToStudent: false,
  dailyLeaderboardVisible: true,
  overallLeaderboardVisible: true,
  dailyGroupLeaderboardVisible: true,
  overallGroupLeaderboardVisible: true,
  countsForGroupLeaderboard: true,
  leaderboardReleasedAt: null,
};

export function parseQuizSettings(settings: Prisma.JsonValue | null | undefined): QuizSettings {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return { ...defaultQuizSettings };
  }
  const quiz = (settings as Record<string, unknown>).quiz;
  if (!quiz || typeof quiz !== 'object' || Array.isArray(quiz)) {
    return { ...defaultQuizSettings };
  }
  const q = quiz as Record<string, unknown>;
  return {
    shuffleQuestions:
      typeof q.shuffleQuestions === 'boolean'
        ? q.shuffleQuestions
        : defaultQuizSettings.shuffleQuestions,
    shuffleOptions:
      typeof q.shuffleOptions === 'boolean' ? q.shuffleOptions : defaultQuizSettings.shuffleOptions,
    scoreVisibleToStudent:
      typeof q.scoreVisibleToStudent === 'boolean'
        ? q.scoreVisibleToStudent
        : defaultQuizSettings.scoreVisibleToStudent,
    answersVisibleToStudent:
      typeof q.answersVisibleToStudent === 'boolean'
        ? q.answersVisibleToStudent
        : defaultQuizSettings.answersVisibleToStudent,
    dailyLeaderboardVisible:
      typeof q.dailyLeaderboardVisible === 'boolean'
        ? q.dailyLeaderboardVisible
        : defaultQuizSettings.dailyLeaderboardVisible,
    overallLeaderboardVisible:
      typeof q.overallLeaderboardVisible === 'boolean'
        ? q.overallLeaderboardVisible
        : defaultQuizSettings.overallLeaderboardVisible,
    dailyGroupLeaderboardVisible:
      typeof q.dailyGroupLeaderboardVisible === 'boolean'
        ? q.dailyGroupLeaderboardVisible
        : defaultQuizSettings.dailyGroupLeaderboardVisible,
    overallGroupLeaderboardVisible:
      typeof q.overallGroupLeaderboardVisible === 'boolean'
        ? q.overallGroupLeaderboardVisible
        : defaultQuizSettings.overallGroupLeaderboardVisible,
    countsForGroupLeaderboard:
      typeof q.countsForGroupLeaderboard === 'boolean'
        ? q.countsForGroupLeaderboard
        : defaultQuizSettings.countsForGroupLeaderboard,
    leaderboardReleasedAt:
      typeof q.leaderboardReleasedAt === 'string'
        ? q.leaderboardReleasedAt
        : q.leaderboardReleasedAt === null
          ? null
          : defaultQuizSettings.leaderboardReleasedAt,
  };
}

export function shuffleInPlace<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}
