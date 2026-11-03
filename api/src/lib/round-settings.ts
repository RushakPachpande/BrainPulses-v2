import type { Prisma } from '#prisma';
import type { ScoreRelease } from './quiz-settings.js';

export type PassMode = 'percent' | 'score';

export type RoundBehaviourSettings = {
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  scoreRelease: ScoreRelease;
  answersVisibleToParticipant: boolean;
  allowPrevious: boolean;
  showQuestionPanel: boolean;
  questionsCompulsory: boolean;
  negativeMarkingEnabled: boolean;
  negativeMarkPoints: number;
  /** Null means unlimited submissions. */
  maxAttempts: number | null;
  /** Null means every active question. */
  questionLimit: number | null;
};

export type RoundSettings = RoundBehaviourSettings & {
  durationMode: 'overall' | 'per_question';
  durationMinutes: number | null;
  perQuestionSeconds: number | null;
  presentation: 'one_at_a_time' | 'all_on_page';
  passMode: PassMode;
  passingPercent: number | null;
  passingScore: number | null;
};

export const defaultRoundBehaviour: RoundBehaviourSettings = {
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

export const defaultRoundSettings: RoundSettings = {
  ...defaultRoundBehaviour,
  durationMode: 'overall',
  durationMinutes: 60,
  perQuestionSeconds: null,
  presentation: 'one_at_a_time',
  passMode: 'percent',
  passingPercent: 40,
  passingScore: null,
};

/** Question types that withhold results until an admin publishes. */
export const MANUAL_RESULT_TYPES = new Set(['numeric', 'short_text', 'long_text']);

function parseMaxAttempts(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 100) {
    return value;
  }
  return defaultRoundBehaviour.maxAttempts;
}

function parseQuestionLimit(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 500) {
    return value;
  }
  return null;
}

function parseScoreRelease(value: unknown): ScoreRelease {
  return value === 'after_publish' ? 'after_publish' : 'after_submit';
}

function parsePassMode(value: unknown): PassMode {
  return value === 'score' ? 'score' : 'percent';
}

function parseBehaviour(raw: Record<string, unknown> | null | undefined): RoundBehaviourSettings {
  const q = raw ?? {};
  const negativeMarkingEnabled =
    typeof q.negativeMarkingEnabled === 'boolean'
      ? q.negativeMarkingEnabled
      : defaultRoundBehaviour.negativeMarkingEnabled;
  const questionsCompulsoryRaw =
    typeof q.questionsCompulsory === 'boolean'
      ? q.questionsCompulsory
      : defaultRoundBehaviour.questionsCompulsory;
  return {
    shuffleQuestions:
      typeof q.shuffleQuestions === 'boolean'
        ? q.shuffleQuestions
        : defaultRoundBehaviour.shuffleQuestions,
    shuffleOptions:
      typeof q.shuffleOptions === 'boolean'
        ? q.shuffleOptions
        : defaultRoundBehaviour.shuffleOptions,
    scoreRelease: parseScoreRelease(q.scoreRelease),
    answersVisibleToParticipant:
      typeof q.answersVisibleToParticipant === 'boolean'
        ? q.answersVisibleToParticipant
        : defaultRoundBehaviour.answersVisibleToParticipant,
    allowPrevious:
      typeof q.allowPrevious === 'boolean' ? q.allowPrevious : defaultRoundBehaviour.allowPrevious,
    showQuestionPanel:
      typeof q.showQuestionPanel === 'boolean'
        ? q.showQuestionPanel
        : defaultRoundBehaviour.showQuestionPanel,
    questionsCompulsory: negativeMarkingEnabled ? false : questionsCompulsoryRaw,
    negativeMarkingEnabled,
    negativeMarkPoints:
      typeof q.negativeMarkPoints === 'number' &&
      Number.isFinite(q.negativeMarkPoints) &&
      q.negativeMarkPoints >= 0
        ? q.negativeMarkPoints
        : defaultRoundBehaviour.negativeMarkPoints,
    maxAttempts: parseMaxAttempts(q.maxAttempts),
    questionLimit: parseQuestionLimit(q.questionLimit),
  };
}

export function parseRoundSettings(round: {
  durationMinutes?: number | null;
  durationMode?: string | null;
  perQuestionSeconds?: number | null;
  presentation?: string | null;
  passMode?: string | null;
  passingPercent?: Prisma.Decimal | number | null;
  passingScore?: Prisma.Decimal | number | null;
  settings?: Prisma.JsonValue | null;
}): RoundSettings {
  const behaviour =
    round.settings && typeof round.settings === 'object' && !Array.isArray(round.settings)
      ? parseBehaviour(round.settings as Record<string, unknown>)
      : { ...defaultRoundBehaviour };

  const durationMode =
    round.durationMode === 'per_question' ? 'per_question' : ('overall' as const);
  const presentation =
    round.presentation === 'all_on_page' ? 'all_on_page' : ('one_at_a_time' as const);

  const passingPercent =
    round.passingPercent === null || round.passingPercent === undefined
      ? defaultRoundSettings.passingPercent
      : Number(round.passingPercent);
  const passingScore =
    round.passingScore === null || round.passingScore === undefined
      ? null
      : Number(round.passingScore);

  return {
    ...behaviour,
    durationMode,
    durationMinutes:
      round.durationMinutes === undefined
        ? defaultRoundSettings.durationMinutes
        : round.durationMinutes,
    perQuestionSeconds: round.perQuestionSeconds ?? null,
    presentation: durationMode === 'per_question' ? 'one_at_a_time' : presentation,
    passMode: parsePassMode(round.passMode),
    passingPercent,
    passingScore,
    allowPrevious: durationMode === 'per_question' ? false : behaviour.allowPrevious,
    showQuestionPanel: durationMode === 'per_question' ? false : behaviour.showQuestionPanel,
  };
}

export function behaviourToJson(settings: RoundBehaviourSettings): Prisma.InputJsonObject {
  return {
    shuffleQuestions: settings.shuffleQuestions,
    shuffleOptions: settings.shuffleOptions,
    scoreRelease: settings.scoreRelease,
    answersVisibleToParticipant: settings.answersVisibleToParticipant,
    allowPrevious: settings.allowPrevious,
    showQuestionPanel: settings.showQuestionPanel,
    questionsCompulsory: settings.questionsCompulsory,
    negativeMarkingEnabled: settings.negativeMarkingEnabled,
    negativeMarkPoints: settings.negativeMarkPoints,
    maxAttempts: settings.maxAttempts,
    questionLimit: settings.questionLimit,
  };
}

export function meetsPassRule(settings: RoundSettings, score: number, percent: number): boolean {
  if (settings.passMode === 'score') {
    const needed = settings.passingScore;
    if (needed == null) return true;
    return score >= needed;
  }
  const needed = settings.passingPercent;
  if (needed == null) return true;
  return percent >= needed;
}

export function roundNeedsManualPublish(questionTypes: Iterable<string>): boolean {
  for (const type of questionTypes) {
    if (MANUAL_RESULT_TYPES.has(type)) return true;
  }
  return false;
}
