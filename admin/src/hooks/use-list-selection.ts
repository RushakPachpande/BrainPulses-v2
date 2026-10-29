import { useState } from 'react';
import {
  cycleSelection,
  readSelection,
  selectionFlags,
  writeSelection,
} from '@/lib/list-selection';

export function useRecordSelection(
  orgId: string,
  list: string,
  noun: string,
  pageIds: readonly string[],
  filteredIds: readonly string[],
) {
  const key = `${orgId}:${list}`;
  const [state, setState] = useState(() => ({ key, selected: readSelection(key) }));

  let selected = state.selected;
  if (state.key !== key) {
    selected = readSelection(key);
    setState({ key, selected });
  }

  function commit(next: Set<string>) {
    writeSelection(key, next);
    setState({ key, selected: next });
  }

  const flags = selectionFlags(noun, selected, pageIds, filteredIds);

  return {
    selected,
    selectedCount: selected.size,
    allSelected: flags.allSelected,
    someSelected: flags.someSelected,
    allLabel: flags.allLabel,
    onToggleAll() {
      commit(cycleSelection(selected, pageIds, filteredIds));
    },
    onToggleOne(id: string, checked: boolean) {
      const next = new Set(selected);
      if (checked) next.add(id);
      else next.delete(id);
      commit(next);
    },
    onClear() {
      commit(new Set());
    },
  };
}
