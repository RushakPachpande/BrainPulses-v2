import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { activityRoundInputSchema } from '../src/modules/activities/schema.js';

const round = {
  name: 'Round 1',
  sortOrder: 0,
  passingPercent: 40,
};

describe('round instructions', () => {
  it('keeps trimmed instructions on a round', () => {
    const parsed = activityRoundInputSchema.parse({
      ...round,
      instructions: '  <p>Read each question carefully.</p>  ',
    });
    assert.equal(parsed.instructions, '<p>Read each question carefully.</p>');
  });

  it('allows a round with no instructions', () => {
    const parsed = activityRoundInputSchema.parse(round);
    assert.equal(parsed.instructions ?? null, null);
  });
});
