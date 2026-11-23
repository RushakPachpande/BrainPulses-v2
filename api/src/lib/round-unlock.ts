import type { Prisma } from '#prisma';
import { holdsScoreUntilPublish } from './quiz-settings.js';
import { meetsPassRule, parseRoundSettings, type RoundSettings } from './round-settings.js';

function toNumber(d: Prisma.Decimal | number): number {
  return typeof d === 'number' ? d : Number(d);
}

type ResultLike = {
  score: Prisma.Decimal | number;
  percent: Prisma.Decimal | number;
  passed: boolean | null;
  releaseStatus: string;
};

type AttemptLike = {
  id: string;
  status: string;
  roundId: string | null;
  result: ResultLike | null;
};

export function authoritativeRoundAttempts(attempts: AttemptLike[], roundId: string) {
  return attempts.filter(
    (a) =>
      a.roundId === roundId &&
      (a.status === 'submitted' || a.status === 'auto_submitted' || Boolean(a.result)),
  );
}

export function resultClearsRound(
  result: ResultLike | null | undefined,
  settings: RoundSettings,
  needsPublish: boolean,
): boolean {
  if (!result) return false;
  if (needsPublish && result.releaseStatus !== 'published') return false;
  if (result.passed != null) return result.passed;
  return meetsPassRule(settings, toNumber(result.score), toNumber(result.percent));
}

/** True when the participant has cleared this round (passed, and published when required). */
export function roundIsCleared(
  attempts: AttemptLike[],
  roundId: string,
  settings: RoundSettings,
  needsPublish: boolean,
): boolean {
  return authoritativeRoundAttempts(attempts, roundId).some((a) =>
    resultClearsRound(a.result, settings, needsPublish),
  );
}

export function bestOrLatestResult(attempts: AttemptLike[], roundId: string): ResultLike | null {
  const done = authoritativeRoundAttempts(attempts, roundId);
  for (const a of done) {
    if (a.result) return a.result;
  }
  return null;
}

/**
 * Whether this round unlocks the next one.
 * A required pass uses the published passing result. Otherwise one submitted attempt is enough.
 */
export function roundGateSatisfied(
  attempts: AttemptLike[],
  roundId: string,
  settings: RoundSettings,
  needsPublish: boolean,
): boolean {
  if (settings.passRequired) return roundIsCleared(attempts, roundId, settings, needsPublish);
  return attempts.some(
    (attempt) =>
      attempt.roundId === roundId &&
      (attempt.status === 'submitted' || attempt.status === 'auto_submitted'),
  );
}

export function roundAttemptCount(attempts: AttemptLike[], roundId: string): number {
  return authoritativeRoundAttempts(attempts, roundId).length;
}

/**
 * Whether the participant may start another attempt on this round.
 * Attempt budget only — a published pass does not burn unused attempts.
 */
export function canRetryRound(
  attempts: AttemptLike[],
  roundId: string,
  settings: RoundSettings,
  _needsPublish?: boolean,
): boolean {
  const used = roundAttemptCount(attempts, roundId);
  if (settings.maxAttempts == null) return true;
  return used < settings.maxAttempts;
}

export function parseRoundRow(round: {
  durationMinutes?: number | null;
  durationMode?: string | null;
  perQuestionSeconds?: number | null;
  presentation?: string | null;
  passMode?: string | null;
  passingPercent?: Prisma.Decimal | number | null;
  passingScore?: Prisma.Decimal | number | null;
  settings?: Prisma.JsonValue | null;
}): RoundSettings {
  return parseRoundSettings(round);
}

/** Gate unlock on publish only when the round is configured to hold scores. */
export function roundNeedsPublish(settings: RoundSettings): boolean {
  return holdsScoreUntilPublish(settings);
}

export type ParticipantRoundUiState = 'locked' | 'available' | 'in_progress' | 'completed';

/**
 * Participant-facing round state.
 * Attempt budget wins over "cleared" so unused attempts stay startable.
 */
export function resolveParticipantRoundState(input: {
  hasOpenAttempt: boolean;
  activityOpen: boolean;
  previousGateSatisfied: boolean;
  canRetry: boolean;
  cleared: boolean;
}): ParticipantRoundUiState {
  if (input.hasOpenAttempt) return 'in_progress';
  if (!input.activityOpen || !input.previousGateSatisfied) return 'locked';
  if (input.canRetry) return 'available';
  if (input.cleared) return 'completed';
  return 'locked';
}

/**
 * Assessment-level progress for library cards.
 * Stays in progress while any round can still be started or resumed.
 */
export function assessmentAttemptState(input: {
  hasOpenAttempt: boolean;
  hasAnyAttempt: boolean;
  roundStates: ParticipantRoundUiState[];
}): 'not_started' | 'in_progress' | 'submitted' {
  if (input.hasOpenAttempt) return 'in_progress';
  if (input.roundStates.some((state) => state === 'available' || state === 'in_progress')) {
    return 'in_progress';
  }
  if (input.roundStates.length > 0 && input.roundStates.every((state) => state === 'completed')) {
    return 'submitted';
  }
  if (input.hasAnyAttempt) return 'in_progress';
  return 'not_started';
}

export { meetsPassRule };
