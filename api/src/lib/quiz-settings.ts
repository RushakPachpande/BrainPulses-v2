import type { Prisma } from '#prisma';

export type ScoreRelease = 'after_submit' | 'after_publish';

export type QuizSettings = {
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  scoreRelease: ScoreRelease;
  answersVisibleToParticipant: boolean;
  allowPrevious: boolean;
  showQuestionPanel: boolean;
  /** When true, participants must answer before Next/Submit. */
  questionsCompulsory: boolean;
  negativeMarkingEnabled: boolean;
  negativeMarkPoints: number;
  /** Null means unlimited submissions. */
  maxAttempts: number | null;
  /** Null means every active question. */
  questionLimit: number | null;
};

export const defaultQuizSettings: QuizSettings = {
  shuffleQuestions: true,
  shuffleOptions: true,
  scoreRelease: 'after_submit',
  answersVisibleToParticipant: false,
  allowPrevious: true,
  showQuestionPanel: true,
  questionsCompulsory: true,
  negativeMarkingEnabled: false,
  negativeMarkPoints: 0,
  maxAttempts: 1,
  questionLimit: null,
};

function parseScoreRelease(q: Record<string, unknown>): ScoreRelease {
  if (q.scoreRelease === 'after_submit' || q.scoreRelease === 'after_publish') {
    return q.scoreRelease;
  }
  if (q.scoreVisibleToParticipant === true) return 'after_publish';
  return 'after_submit';
}

function parseMaxAttempts(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 100) {
    return value;
  }
  return defaultQuizSettings.maxAttempts;
}

function parseQuestionLimit(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 500) {
    return value;
  }
  return null;
}

export function parseQuizSettings(settings: Prisma.JsonValue | null | undefined): QuizSettings {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return { ...defaultQuizSettings };
  }
  const quiz = (settings as Record<string, unknown>).quiz;
  if (!quiz || typeof quiz !== 'object' || Array.isArray(quiz)) {
    return { ...defaultQuizSettings };
  }
  const q = quiz as Record<string, unknown>;
  const negativeMarkingEnabled =
    typeof q.negativeMarkingEnabled === 'boolean'
      ? q.negativeMarkingEnabled
      : defaultQuizSettings.negativeMarkingEnabled;
  const questionsCompulsoryRaw =
    typeof q.questionsCompulsory === 'boolean'
      ? q.questionsCompulsory
      : defaultQuizSettings.questionsCompulsory;
  return {
    shuffleQuestions:
      typeof q.shuffleQuestions === 'boolean'
        ? q.shuffleQuestions
        : defaultQuizSettings.shuffleQuestions,
    shuffleOptions:
      typeof q.shuffleOptions === 'boolean' ? q.shuffleOptions : defaultQuizSettings.shuffleOptions,
    scoreRelease: parseScoreRelease(q),
    answersVisibleToParticipant:
      typeof q.answersVisibleToParticipant === 'boolean'
        ? q.answersVisibleToParticipant
        : defaultQuizSettings.answersVisibleToParticipant,
    allowPrevious:
      typeof q.allowPrevious === 'boolean' ? q.allowPrevious : defaultQuizSettings.allowPrevious,
    showQuestionPanel:
      typeof q.showQuestionPanel === 'boolean'
        ? q.showQuestionPanel
        : defaultQuizSettings.showQuestionPanel,
    questionsCompulsory: negativeMarkingEnabled ? false : questionsCompulsoryRaw,
    negativeMarkingEnabled,
    negativeMarkPoints:
      typeof q.negativeMarkPoints === 'number' &&
      Number.isFinite(q.negativeMarkPoints) &&
      q.negativeMarkPoints >= 0
        ? q.negativeMarkPoints
        : defaultQuizSettings.negativeMarkPoints,
    maxAttempts: parseMaxAttempts(q.maxAttempts),
    questionLimit: parseQuestionLimit(q.questionLimit),
  };
}

/** Assessments pass null and still require a published result. */
export function isQuizScoreVisible(
  settings: { scoreRelease: ScoreRelease } | null,
  published: boolean,
): boolean {
  if (!settings) return published;
  if (settings.scoreRelease === 'after_submit') return true;
  return published;
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
