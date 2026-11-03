import { shuffleInPlace } from './quiz-settings.js';

export type QuestionOrderItem = {
  id: string;
  passageId: string | null;
  sortOrder: number;
};

/** Passage questions stay in one block. Other questions are blocks of one. */
export function blocksFromItems(items: QuestionOrderItem[]): QuestionOrderItem[][] {
  const groups = new Map<string, QuestionOrderItem[]>();
  for (const item of items) {
    if (!item.passageId) continue;
    const list = groups.get(item.passageId) ?? [];
    list.push(item);
    groups.set(item.passageId, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  }

  const emitted = new Set<string>();
  const blocks: QuestionOrderItem[][] = [];
  for (const item of items) {
    if (emitted.has(item.id)) continue;
    const group = item.passageId ? groups.get(item.passageId) : undefined;
    const batch = group && group.length > 0 ? group : [item];
    const block: QuestionOrderItem[] = [];
    for (const sibling of batch) {
      if (emitted.has(sibling.id)) continue;
      block.push(sibling);
      emitted.add(sibling.id);
    }
    if (block.length > 0) blocks.push(block);
  }
  return blocks;
}

/**
 * Take whole blocks until the next block would pass the limit.
 * A passage larger than the limit is served whole when it is the first block taken.
 */
export function applyQuestionLimit(
  blocks: QuestionOrderItem[][],
  limit: number | null,
): QuestionOrderItem[][] {
  if (limit == null) return blocks;
  const chosen: QuestionOrderItem[][] = [];
  let count = 0;
  for (const block of blocks) {
    if (chosen.length === 0 && block.length > limit) {
      chosen.push(block);
      break;
    }
    if (count + block.length > limit) break;
    chosen.push(block);
    count += block.length;
  }
  return chosen;
}

export function servedQuestionCount(items: QuestionOrderItem[], limit: number | null): number {
  return applyQuestionLimit(blocksFromItems(items), limit).reduce(
    (sum, block) => sum + block.length,
    0,
  );
}

/** Shuffle block order, then shuffle only inside a passage block. */
export function orderBlocks(blocks: QuestionOrderItem[][], shuffleQuestions: boolean): string[] {
  const arranged = shuffleQuestions ? shuffleInPlace(blocks) : blocks;
  const ids: string[] = [];
  for (const block of arranged) {
    const passage = Boolean(block[0]?.passageId) && block.length > 1;
    const items = shuffleQuestions && passage ? shuffleInPlace(block) : block;
    for (const item of items) ids.push(item.id);
  }
  return ids;
}
