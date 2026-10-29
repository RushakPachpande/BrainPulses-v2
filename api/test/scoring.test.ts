import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyNegativeMarking,
  clampScore,
  hasSubmittedAnswer,
  scoreObjective,
} from '../src/modules/attempts/scoring.js';

describe('scoreObjective', () => {
  it('scores single_mcq by label', () => {
    assert.equal(scoreObjective('single_mcq', { correctLabels: ['B'] }, { label: 'B' }, 2), 2);
    assert.equal(scoreObjective('single_mcq', { correctLabels: ['B'] }, { label: 'A' }, 2), 0);
  });

  it('scores true_false and comprehension like single', () => {
    assert.equal(scoreObjective('true_false', { correctLabels: ['A'] }, { label: 'A' }, 1), 1);
    assert.equal(
      scoreObjective('comprehension_mcq', { correctLabels: ['C'] }, { label: 'C' }, 3),
      3,
    );
  });

  it('scores multiple_mcq and image_selection by set', () => {
    assert.equal(
      scoreObjective('multiple_mcq', { correctLabels: ['A', 'C'] }, { labels: ['C', 'A'] }, 1),
      1,
    );
    assert.equal(
      scoreObjective('multiple_mcq', { correctLabels: ['A', 'C'] }, { labels: ['A'] }, 1),
      0,
    );
    assert.equal(
      scoreObjective('image_selection', { correctLabels: ['a', 'b'] }, { labels: ['a', 'b'] }, 1),
      1,
    );
  });

  it('scores numeric with tolerance', () => {
    assert.equal(
      scoreObjective('numeric', { value: 10, numericTolerance: 0.5 }, { value: 10.4 }, 1),
      1,
    );
    assert.equal(scoreObjective('numeric', { value: 10 }, { value: 11 }, 1), 0);
  });

  it('exact-matches short and long text when reference set', () => {
    assert.equal(scoreObjective('short_text', { value: 'Paris' }, { text: ' paris ' }, 1), 1);
    assert.equal(scoreObjective('long_text', { value: 'Hello' }, { text: 'hello' }, 2), 2);
    assert.equal(scoreObjective('long_text', { value: 'Hello' }, { text: 'nope' }, 2), 0);
  });

  it('returns null for text without reference so maxScore can skip', () => {
    assert.equal(scoreObjective('short_text', {}, { text: 'anything' }, 1), null);
    assert.equal(scoreObjective('long_text', { value: '' }, { text: 'x' }, 1), null);
  });
});

describe('negative marking helpers', () => {
  it('detects submitted vs empty answers', () => {
    assert.equal(hasSubmittedAnswer('single_mcq', { label: 'A' }), true);
    assert.equal(hasSubmittedAnswer('single_mcq', { label: '' }), false);
    assert.equal(hasSubmittedAnswer('multiple_mcq', { labels: ['A'] }), true);
    assert.equal(hasSubmittedAnswer('multiple_mcq', { labels: [] }), false);
    assert.equal(hasSubmittedAnswer('numeric', { value: 3 }), true);
    assert.equal(hasSubmittedAnswer('short_text', { text: '' }), false);
  });

  it('deducts only for wrong answered items and clamps at zero', () => {
    let score = 0;
    score = applyNegativeMarking(score, {
      enabled: true,
      penalty: 0.25,
      earned: 1,
      answered: true,
    });
    assert.equal(score, 1);
    score = applyNegativeMarking(score, {
      enabled: true,
      penalty: 0.25,
      earned: 0,
      answered: true,
    });
    assert.equal(score, 0.75);
    score = applyNegativeMarking(score, {
      enabled: true,
      penalty: 0.25,
      earned: 0,
      answered: false,
    });
    assert.equal(score, 0.75);
    score = applyNegativeMarking(score, {
      enabled: true,
      penalty: 2,
      earned: 0,
      answered: true,
    });
    assert.equal(clampScore(score), 0);
  });
});
