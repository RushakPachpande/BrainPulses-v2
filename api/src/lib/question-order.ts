import { shuffleInPlace } from './quiz-settings.js';

export type QuestionOrderItem = {
  id: string;
  passageId: string | null;
  sortOrder: number;
};

export type ShuffleFn = <T>(items: T[]) => T[];

function stableSort(items: QuestionOrderItem[]): QuestionOrderItem[] {
  // Equal sortOrder keeps the bank's createdAt order already loaded into `items`.
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

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
    list.sort((a, b) => a.sortOrder - b.sortOrder);
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
 * Pick up to `limit` questions independently from the pool.
 * Shuffle samples from the full set; without shuffle, takes a stable bank-order prefix.
 */
export function selectAttemptItems(
  items: QuestionOrderItem[],
  limit: number | null,
  shuffleQuestions: boolean,
  shuffle: ShuffleFn = shuffleInPlace,
): QuestionOrderItem[] {
  const pool = stableSort(items);
  const ordered = shuffleQuestions ? shuffle(pool) : pool;
  if (limit == null) return ordered;
  return ordered.slice(0, Math.min(limit, ordered.length));
}

/**
 * Present selected items so chosen passage siblings run contiguously once,
 * then shuffle block order (and within-passage order) when enabled.
 */
export function buildDisplayOrder(
  selected: QuestionOrderItem[],
  shuffleQuestions: boolean,
  shuffle: ShuffleFn = shuffleInPlace,
): string[] {
  return orderBlocks(blocksFromItems(selected), shuffleQuestions, shuffle);
}

/** How many questions an attempt with this limit will serve. */
export function servedQuestionCount(items: { length: number }, limit: number | null): number {
  const total = items.length;
  if (limit == null) return total;
  return Math.min(limit, total);
}

/** Shuffle block order, then shuffle only inside a multi-item passage block. */
export function orderBlocks(
  blocks: QuestionOrderItem[][],
  shuffleQuestions: boolean,
  shuffle: ShuffleFn = shuffleInPlace,
): string[] {
  const arranged = shuffleQuestions ? shuffle(blocks) : blocks;
  const ids: string[] = [];
  for (const block of arranged) {
    const passage = Boolean(block[0]?.passageId) && block.length > 1;
    const items = shuffleQuestions && passage ? shuffle(block) : block;
    for (const item of items) ids.push(item.id);
  }
  return ids;
}
