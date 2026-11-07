import type { Prisma } from '#prisma';
import {
  meetsPassRule,
  parseRoundSettings,
  roundNeedsManualPublish,
  type RoundSettings,
} from './round-settings.js';

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

export function roundAttemptCount(attempts: AttemptLike[], roundId: string): number {
  return authoritativeRoundAttempts(attempts, roundId).length;
}

export function canRetryRound(
  attempts: AttemptLike[],
  roundId: string,
  settings: RoundSettings,
  needsPublish: boolean,
): boolean {
  if (roundIsCleared(attempts, roundId, settings, needsPublish)) return false;
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

export { roundNeedsManualPublish, meetsPassRule };
