import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defaultRoundSettings, meetsPassRule } from '../src/lib/round-settings.js';
import {
  canRetryRound,
  resultClearsRound,
  roundIsCleared,
  roundNeedsManualPublish,
} from '../src/lib/round-unlock.js';

describe('round unlock helpers', () => {
  it('detects numerical and text types as needing publish', () => {
    assert.equal(roundNeedsManualPublish(['single_mcq']), false);
    assert.equal(roundNeedsManualPublish(['numeric']), true);
    assert.equal(roundNeedsManualPublish(['short_text', 'single_mcq']), true);
    assert.equal(roundNeedsManualPublish(['long_text']), true);
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
});
