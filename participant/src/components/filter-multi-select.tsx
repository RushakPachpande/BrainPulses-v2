import { ChevronDown } from 'lucide-react';
import { Popover } from 'radix-ui';

export function FilterMultiSelect({
  label,
  options,
  values,
  onValuesChange,
  disabled = false,
}: {
  label: string;
  options: readonly string[];
  values: string[];
  onValuesChange: (values: string[]) => void;
  disabled?: boolean;
}) {
  const selected = new Set(values);
  const allSelected = options.length > 0 && options.every((option) => selected.has(option));
  const someSelected = options.some((option) => selected.has(option));
  const summary =
    values.length === 0 || values.length === options.length
      ? 'All'
      : values.length === 1
        ? values[0]
        : `${values.length} selected`;

  function toggle(option: string, on: boolean) {
    onValuesChange(on ? [...values, option] : values.filter((item) => item !== option));
  }

  return (
    <Popover.Root>
      <Popover.Trigger className="results-type-filter" disabled={disabled} aria-label={label}>
        <span>
          {label}: {summary}
        </span>
        <ChevronDown aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="filter-multi" align="end" sideOffset={4}>
          <label className="filter-multi-all">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(node) => {
                if (node) node.indeterminate = !allSelected && someSelected;
              }}
              disabled={disabled || options.length === 0}
              onChange={(event) => onValuesChange(event.target.checked ? [...options] : [])}
            />
            Select all
          </label>
          {options.map((option) => (
            <label key={option}>
              <input
                type="checkbox"
                checked={selected.has(option)}
                disabled={disabled}
                onChange={(event) => toggle(option, event.target.checked)}
              />
              {option}
            </label>
          ))}
          <button
            type="button"
            className="filter-multi-clear"
            disabled={disabled || values.length === 0}
            onClick={() => onValuesChange([])}
          >
            Clear selection
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
