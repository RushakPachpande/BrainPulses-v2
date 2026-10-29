import { describe, expect, it } from 'vitest';
import { cycleSelection, selectionFlags } from './list-selection';

const page = ['a', 'b'];
const filtered = ['a', 'b', 'c'];

describe('cycleSelection', () => {
  it('selects the page, then the filter, then clears', () => {
    const pageOnly = cycleSelection(new Set(), page, filtered);
    expect([...pageOnly].sort()).toEqual(['a', 'b']);

    const all = cycleSelection(pageOnly, page, filtered);
    expect([...all].sort()).toEqual(['a', 'b', 'c']);

    expect(cycleSelection(all, page, filtered).size).toBe(0);
  });

  it('clears on the next click when the page is the whole filter', () => {
    const selected = cycleSelection(new Set(), page, page);
    expect(cycleSelection(selected, page, page).size).toBe(0);
  });

  it('keeps ids from other pages when selecting this page', () => {
    const next = cycleSelection(new Set(['c']), ['a'], filtered);
    expect([...next].sort()).toEqual(['a', 'c']);
  });
});

describe('selectionFlags', () => {
  it('names the next step', () => {
    expect(selectionFlags('students', new Set(), page, filtered).allLabel).toBe(
      'Select all students on this page',
    );
    expect(selectionFlags('students', new Set(page), page, filtered).allLabel).toBe(
      'Select all 3 students',
    );
    expect(selectionFlags('students', new Set(filtered), page, filtered).allSelected).toBe(true);
    expect(selectionFlags('students', new Set(['a']), page, filtered).someSelected).toBe(true);
  });
});
