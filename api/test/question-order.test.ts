import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyQuestionLimit,
  blocksFromItems,
  orderBlocks,
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

  it('does not split a passage to meet the question limit', () => {
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
      [['a']],
    );

    const oversized = applyQuestionLimit(blocksFromItems([item('c1', 'p'), item('c2', 'p')]), 1);
    assert.equal(oversized.flat().length, 2);
  });
});
