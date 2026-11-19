import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyQuestionLimit,
  blocksFromItems,
  orderBlocks,
  servedQuestionCount,
  type QuestionOrderItem,
} from '../src/lib/question-order.js';

function item(id: string, passageId: string | null, sortOrder = 0): QuestionOrderItem {
  return { id, passageId, sortOrder };
}

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

    const shuffled = orderBlocks(blocks, true);
    const passageAt = shuffled.findIndex((id) => id === 'c1' || id === 'c2');
    const passageIds = shuffled.filter((id) => id === 'c1' || id === 'c2');
    assert.equal(passageIds.length, 2);
    assert.deepEqual(shuffled.slice(passageAt, passageAt + 2).sort(), ['c1', 'c2']);
    assert.equal(shuffled.filter((id) => id === 'n1' || id === 'n2').length, 2);
  });

  it('skips a passage that does not fit and keeps filling the limit', () => {
    const blocks = blocksFromItems([
      item('a', null),
      item('c1', 'p', 0),
      item('c2', 'p', 1),
      item('c3', 'p', 2),
      item('b', null),
    ]);
    const limited = applyQuestionLimit(blocks, 2);
    assert.deepEqual(
      limited.map((block) => block.map((row) => row.id)),
      [['a'], ['b']],
    );

    const oversized = applyQuestionLimit(blocksFromItems([item('c1', 'p'), item('c2', 'p')]), 1);
    assert.equal(oversized.flat().length, 2);
  });

  it('serves the limit when the next passage is larger than the remaining slots', () => {
    const blocks = blocksFromItems([
      item('q1', null, 0),
      item('p1', 'passage', 0),
      item('p2', 'passage', 1),
      item('p3', 'passage', 2),
      item('p4', 'passage', 3),
      item('p5', 'passage', 4),
      item('p6', 'passage', 5),
      item('p7', 'passage', 6),
      item('q2', null, 1),
      item('q3', null, 2),
      item('q4', null, 3),
      item('q5', null, 4),
    ]);
    assert.equal(servedQuestionCount(blocks.flat(), 5), 5);
  });
});
