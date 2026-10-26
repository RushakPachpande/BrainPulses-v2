const memory = new Map<string, Set<string>>();

export function readSelection(key: string): Set<string> {
  const stored = memory.get(key);
  return stored ? new Set(stored) : new Set();
}

export function writeSelection(key: string, ids: ReadonlySet<string>) {
  if (ids.size === 0) {
    memory.delete(key);
    return;
  }
  memory.set(key, new Set(ids));
}

export function clearAllListSelections() {
  memory.clear();
}

function covers(ids: readonly string[], selected: ReadonlySet<string>) {
  return ids.length > 0 && ids.every((id) => selected.has(id));
}

/** Page, then every filtered id, then clear. A page that is the whole filter skips the middle step. */
export function cycleSelection(
  selected: ReadonlySet<string>,
  pageIds: readonly string[],
  filteredIds: readonly string[],
): Set<string> {
  if (!covers(pageIds, selected)) {
    const next = new Set(selected);
    for (const id of pageIds) next.add(id);
    return next;
  }
  if (!covers(filteredIds, selected)) {
    const next = new Set(selected);
    for (const id of filteredIds) next.add(id);
    return next;
  }
  return new Set();
}

export function selectionFlags(
  noun: string,
  selected: ReadonlySet<string>,
  pageIds: readonly string[],
  filteredIds: readonly string[],
) {
  const pageComplete = covers(pageIds, selected);
  const allComplete = covers(filteredIds, selected);
  let allLabel = `Select all ${noun} on this page`;
  if (allComplete) allLabel = `Unselect all ${noun}`;
  else if (pageComplete) allLabel = `Select all ${filteredIds.length} ${noun}`;
  return {
    allSelected: allComplete,
    someSelected: selected.size > 0 && !allComplete,
    allLabel,
  };
}
