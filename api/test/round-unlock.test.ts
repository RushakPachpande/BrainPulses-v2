import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  defaultRoundSettings,
  meetsPassRule,
  parseRoundSettings,
} from '../src/lib/round-settings.js';
import {
  assessmentAttemptState,
  canRetryRound,
  resolveParticipantRoundState,
  resultClearsRound,
  roundGateSatisfied,
  roundIsCleared,
  roundNeedsPublish,
} from '../src/lib/round-unlock.js';

describe('round unlock helpers', () => {
  it('holds scores until publish only for after_publish rounds', () => {
    assert.equal(
      roundNeedsPublish({ ...defaultRoundSettings, scoreRelease: 'after_submit' }),
      false,
    );
    assert.equal(
      roundNeedsPublish({ ...defaultRoundSettings, scoreRelease: 'after_publish' }),
      true,
    );
  });

  it('evaluates percent and score pass rules', () => {
    const percent = { ...defaultRoundSettings, passMode: 'percent' as const, passingPercent: 60 };
    assert.equal(meetsPassRule(percent, 30, 59.9), false);
    assert.equal(meetsPassRule(percent, 30, 60), true);

    const score = {
      ...defaultRoundSettings,
      passMode: 'score' as const,
      passingScore: 30,
      passingPercent: null,
    };
    assert.equal(meetsPassRule(score, 29, 90), false);
    assert.equal(meetsPassRule(score, 30, 40), true);
  });

  it('requires a published passing result to clear a round', () => {
    const settings = { ...defaultRoundSettings, passMode: 'percent' as const, passingPercent: 50 };
    const withheld = {
      score: 80,
      percent: 80,
      passed: true,
      releaseStatus: 'withheld',
    };
    const published = { ...withheld, releaseStatus: 'published' };
    assert.equal(resultClearsRound(withheld, settings, true), false);
    assert.equal(resultClearsRound(published, settings, true), true);
    assert.equal(resultClearsRound(withheld, settings, false), true);
  });

  it('allows retries until the attempt cap after a failing published result', () => {
    const settings = {
      ...defaultRoundSettings,
      passMode: 'percent' as const,
      passingPercent: 80,
      maxAttempts: 2,
    };
    const attempts = [
      {
        id: 'a1',
        status: 'submitted',
        roundId: 'r1',
        result: { score: 10, percent: 40, passed: false, releaseStatus: 'published' },
      },
    ];
    assert.equal(roundIsCleared(attempts, 'r1', settings, true), false);
    assert.equal(canRetryRound(attempts, 'r1', settings, true), true);

    attempts.push({
      id: 'a2',
      status: 'submitted',
      roundId: 'r1',
      result: { score: 10, percent: 40, passed: false, releaseStatus: 'published' },
    });
    assert.equal(canRetryRound(attempts, 'r1', settings, true), false);
  });

  it('allows another attempt after a published pass while attempts remain', () => {
    const settings = {
      ...defaultRoundSettings,
      passMode: 'percent' as const,
      passingPercent: 50,
      maxAttempts: 2,
    };
    const passedOnce = [
      {
        id: 'a1',
        status: 'submitted',
        roundId: 'r1',
        result: { score: 80, percent: 80, passed: true, releaseStatus: 'published' },
      },
    ];
    assert.equal(roundIsCleared(passedOnce, 'r1', settings, true), true);
    assert.equal(canRetryRound(passedOnce, 'r1', settings, true), true);
    assert.equal(roundGateSatisfied(passedOnce, 'r1', settings, true), true);

    const passedTwice = [
      ...passedOnce,
      {
        id: 'a2',
        status: 'submitted',
        roundId: 'r1',
        result: { score: 90, percent: 90, passed: true, releaseStatus: 'published' },
      },
    ];
    assert.equal(canRetryRound(passedTwice, 'r1', settings, true), false);
  });

  it('blocks retries when the attempt budget is exhausted even if withheld', () => {
    const settings = {
      ...defaultRoundSettings,
      maxAttempts: 1,
      passMode: 'percent' as const,
      passingPercent: 50,
    };
    const withheld = [
      {
        id: 'a1',
        status: 'submitted',
        roundId: 'r1',
        result: { score: 80, percent: 80, passed: true, releaseStatus: 'withheld' },
      },
    ];
    assert.equal(canRetryRound(withheld, 'r1', settings, true), false);
    assert.equal(roundIsCleared(withheld, 'r1', settings, true), false);
  });

  it('keeps the next round locked when a required pass is missed', () => {
    const settings = { ...defaultRoundSettings, passRequired: true, passingPercent: 40 };
    const failed = [
      {
        id: 'a1',
        status: 'submitted',
        roundId: 'r1',
        result: { score: 1, percent: 20, passed: false, releaseStatus: 'published' },
      },
    ];
    assert.equal(roundGateSatisfied(failed, 'r1', settings, true), false);

    const passed = [
      {
        id: 'a1',
        status: 'submitted',
        roundId: 'r1',
        result: { score: 8, percent: 80, passed: true, releaseStatus: 'published' },
      },
    ];
    assert.equal(roundGateSatisfied(passed, 'r1', settings, true), true);
  });

  it('opens the next round after a submitted attempt when a pass is not required', () => {
    const settings = { ...defaultRoundSettings, passRequired: false };
    const failed = [
      {
        id: 'a1',
        status: 'submitted',
        roundId: 'r1',
        result: { score: 0, percent: 0, passed: false, releaseStatus: 'published' },
      },
    ];
    assert.equal(roundGateSatisfied(failed, 'r1', settings, true), true);
    assert.equal(roundIsCleared(failed, 'r1', settings, true), false);
    assert.equal(canRetryRound(failed, 'r1', { ...settings, maxAttempts: 2 }, true), true);
  });

  it('does not treat an in-progress attempt as finishing a round', () => {
    const settings = { ...defaultRoundSettings, passRequired: false };
    const open = [
      {
        id: 'a1',
        status: 'in_progress',
        roundId: 'r1',
        result: null,
      },
    ];
    assert.equal(roundGateSatisfied(open, 'r1', settings, true), false);
  });

  it('treats a missing pass flag as required', () => {
    const settings = parseRoundSettings({ passingPercent: 40, settings: {} });
    assert.equal(settings.passRequired, true);
  });

  it('keeps an assessment in progress while any round is still actionable', () => {
    assert.equal(
      assessmentAttemptState({
        hasOpenAttempt: false,
        hasAnyAttempt: true,
        roundStates: ['completed', 'available', 'locked'],
      }),
      'in_progress',
    );
    assert.equal(
      assessmentAttemptState({
        hasOpenAttempt: false,
        hasAnyAttempt: true,
        roundStates: ['completed', 'completed', 'completed'],
      }),
      'submitted',
    );
    assert.equal(
      assessmentAttemptState({
        hasOpenAttempt: false,
        hasAnyAttempt: true,
        roundStates: ['completed', 'locked', 'locked'],
      }),
      'in_progress',
    );
  });

  it('keeps a cleared round available while attempts remain', () => {
    assert.equal(
      resolveParticipantRoundState({
        hasOpenAttempt: false,
        activityOpen: true,
        previousGateSatisfied: true,
        canRetry: true,
        cleared: true,
      }),
      'available',
    );
    assert.equal(
      resolveParticipantRoundState({
        hasOpenAttempt: false,
        activityOpen: true,
        previousGateSatisfied: true,
        canRetry: false,
        cleared: true,
      }),
      'completed',
    );
    assert.equal(
      resolveParticipantRoundState({
        hasOpenAttempt: false,
        activityOpen: true,
        previousGateSatisfied: true,
        canRetry: false,
        cleared: false,
      }),
      'locked',
    );
    assert.equal(
      resolveParticipantRoundState({
        hasOpenAttempt: false,
        activityOpen: true,
        previousGateSatisfied: false,
        canRetry: true,
        cleared: false,
      }),
      'locked',
    );
  });
});
