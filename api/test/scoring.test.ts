import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { scoreObjective } from '../src/modules/attempts/scoring.js';

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
