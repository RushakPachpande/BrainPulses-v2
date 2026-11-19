import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  blocksFromItems,
  buildDisplayOrder,
  orderBlocks,
  selectAttemptItems,
  servedQuestionCount,
  type QuestionOrderItem,
  type ShuffleFn,
} from '../src/lib/question-order.js';

function item(id: string, passageId: string | null, sortOrder = 0): QuestionOrderItem {
  return { id, passageId, sortOrder };
}

/** Deterministic “shuffle”: reverse the array copy. */
const reverseShuffle: ShuffleFn = (items) => [...items].reverse();

describe('question order', () => {
  it('keeps a passage together and shuffles only inside that block', () => {
    const blocks = blocksFromItems([
      item('n1', null, 0),
      item('c2', 'p', 2),
      item('n2', null, 1),
      item('c1', 'p', 1),
    ]);
    assert.deepEqual(
      blocks.map((block) => block.map((row) => row.id)),
      [['n1'], ['c1', 'c2'], ['n2']],
    );

    const ordered = orderBlocks(blocks, false);
    assert.deepEqual(ordered, ['n1', 'c1', 'c2', 'n2']);

    const shuffled = orderBlocks(blocks, true, reverseShuffle);
    const passageAt = shuffled.findIndex((id) => id === 'c1' || id === 'c2');
    assert.deepEqual(shuffled.slice(passageAt, passageAt + 2), ['c2', 'c1']);
    assert.equal(shuffled.filter((id) => id === 'n1' || id === 'n2').length, 2);
  });

  it('selects a stable bank-order prefix without shuffle', () => {
    const pool = [
      item('a', null, 0),
      item('c1', 'p', 0),
      item('c2', 'p', 1),
      item('c3', 'p', 2),
      item('b', null, 1),
    ];
    const selected = selectAttemptItems(pool, 2, false);
    assert.deepEqual(
      selected.map((row) => row.id),
      ['a', 'c1'],
    );
  });

  it('samples from the full pool when shuffle is on, not a fixed prefix', () => {
    const pool = [
      item('a', null, 0),
      item('b', null, 1),
      item('c', null, 2),
      item('d', null, 3),
      item('e', null, 4),
    ];
    // reverseShuffle makes the sample the last N in bank order.
    const selected = selectAttemptItems(pool, 2, true, reverseShuffle);
    assert.deepEqual(
      selected.map((row) => row.id),
      ['e', 'd'],
    );
    assert.notDeepEqual(
      selected.map((row) => row.id),
      ['a', 'b'],
    );
  });

  it('can pick a subset of a passage and display them contiguously once', () => {
    const pool = [
      item('n1', null, 0),
      item('p1', 'pass', 0),
      item('p2', 'pass', 1),
      item('p3', 'pass', 2),
      item('p4', 'pass', 3),
      item('p5', 'pass', 4),
      item('n2', null, 1),
    ];
    // Without shuffle, independent prefix can include only part of a passage.
    const selected = selectAttemptItems(pool, 3, false);
    assert.deepEqual(
      selected.map((row) => row.id),
      ['n1', 'p1', 'n2'],
    );

    // Explicit subset: two of five passage items plus one standalone.
    const subset = [item('p3', 'pass', 2), item('n2', null, 1), item('p1', 'pass', 0)];
    const display = buildDisplayOrder(subset, false);
    const passageStart = display.findIndex((id) => id === 'p1' || id === 'p3');
    assert.deepEqual(display.slice(passageStart, passageStart + 2), ['p1', 'p3']);
    assert.equal(display.filter((id) => id === 'p1' || id === 'p3').length, 2);
    assert.ok(display.includes('n2'));
  });

  it('serves min(limit, pool size) under independent sampling', () => {
    const pool = [
      item('q1', null, 0),
      item('p1', 'passage', 0),
      item('p2', 'passage', 1),
      item('p3', 'passage', 2),
      item('p4', 'passage', 3),
      item('p5', 'passage', 4),
      item('q2', null, 1),
    ];
    assert.equal(servedQuestionCount(pool, 5), 5);
    assert.equal(servedQuestionCount(pool, null), 7);
    assert.equal(servedQuestionCount(pool, 100), 7);
  });
});
