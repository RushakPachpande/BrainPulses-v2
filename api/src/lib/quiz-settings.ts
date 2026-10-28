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
  allowPrevious: boolean;
  showQuestionPanel: boolean;
  negativeMarkingEnabled: boolean;
  negativeMarkPoints: number;
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
  allowPrevious: true,
  showQuestionPanel: true,
  negativeMarkingEnabled: false,
  negativeMarkPoints: 0,
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
    allowPrevious:
      typeof q.allowPrevious === 'boolean' ? q.allowPrevious : defaultQuizSettings.allowPrevious,
    showQuestionPanel:
      typeof q.showQuestionPanel === 'boolean'
        ? q.showQuestionPanel
        : defaultQuizSettings.showQuestionPanel,
    negativeMarkingEnabled:
      typeof q.negativeMarkingEnabled === 'boolean'
        ? q.negativeMarkingEnabled
        : defaultQuizSettings.negativeMarkingEnabled,
    negativeMarkPoints:
      typeof q.negativeMarkPoints === 'number' &&
      Number.isFinite(q.negativeMarkPoints) &&
      q.negativeMarkPoints >= 0
        ? q.negativeMarkPoints
        : defaultQuizSettings.negativeMarkPoints,
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
