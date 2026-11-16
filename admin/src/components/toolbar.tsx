import { ChevronDownIcon, SearchIcon } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

export type ToolbarFilterOption = string | { value: string; label: string };

export type ToolbarFilter = {
  name: string;
  options: ToolbarFilterOption[];
  values: string[];
  onValuesChange: (values: string[]) => void;
};

function optionValue(option: ToolbarFilterOption) {
  return typeof option === 'string' ? option : option.value;
}

function optionLabel(option: ToolbarFilterOption) {
  return typeof option === 'string' ? option : option.label;
}

function selectionSummary(filter: ToolbarFilter) {
  const options = filter.options;
  if (filter.values.length === 0 || filter.values.length === options.length) return 'All';
  if (filter.values.length === 1) {
    const match = options.find((option) => optionValue(option) === filter.values[0]);
    return match ? optionLabel(match) : filter.values[0]!;
  }
  return `${filter.values.length} selected`;
}

function FilterMultiSelect({
  filter,
  triggerId,
  disabled,
}: {
  filter: ToolbarFilter;
  triggerId: string;
  disabled: boolean;
}) {
  const values = filter.options.map(optionValue);
  const selected = new Set(filter.values);
  const allSelected = values.length > 0 && values.every((value) => selected.has(value));
  const someSelected = values.some((value) => selected.has(value));

  function toggle(value: string, on: boolean) {
    const next = on
      ? [...filter.values, value].filter((item, index, list) => list.indexOf(item) === index)
      : filter.values.filter((item) => item !== value);
    filter.onValuesChange(next);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={triggerId}
          type="button"
          variant="outline"
          className="w-full justify-between font-normal"
          disabled={disabled}
          aria-label={filter.name}
        >
          <span className="truncate">{selectionSummary(filter)}</span>
          <ChevronDownIcon data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-44 gap-0 p-0"
      >
        <div className="border-b border-border px-2.5 py-2">
          <label className="flex min-h-11 cursor-pointer items-center gap-2">
            <Checkbox
              checked={allSelected ? true : someSelected ? 'indeterminate' : false}
              disabled={disabled || values.length === 0}
              onCheckedChange={(checked) => {
                filter.onValuesChange(checked === true ? values : []);
              }}
            />
            <span>Select all</span>
          </label>
        </div>
        <div className="flex max-h-64 flex-col overflow-y-auto px-2.5 py-1">
          {filter.options.map((option) => {
            const value = optionValue(option);
            return (
              <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2">
                <Checkbox
                  checked={selected.has(value)}
                  disabled={disabled}
                  onCheckedChange={(checked) => toggle(value, checked === true)}
                />
                <span className="truncate">{optionLabel(option)}</span>
              </label>
            );
          })}
        </div>
        <div className="border-t border-border p-1.5">
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={disabled || filter.values.length === 0}
            onClick={() => filter.onValuesChange([])}
          >
            Clear selection
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function isFilterDefs(filters: string[] | ToolbarFilter[]): filters is ToolbarFilter[] {
  return filters.length > 0 && typeof filters[0] !== 'string';
}

export function Toolbar({
  filters,
  actions,
  dateRange,
  searchPlaceholder = 'Search',
  searchValue,
  onSearchChange,
  disabled = false,
}: {
  filters: string[] | ToolbarFilter[];
  actions?: ReactNode;
  dateRange?: ReactNode;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  disabled?: boolean;
}) {
  const structured = isFilterDefs(filters);
  const idPrefix = useId();
  const [inputValue, setInputValue] = useState(searchValue ?? '');
  const debouncedInput = useDebouncedValue(inputValue, 300);

  // Keep typing immediate in the input while delaying expensive filtering/API work.
  useEffect(() => {
    setInputValue(searchValue ?? '');
  }, [searchValue]);

  useEffect(() => {
    if (!onSearchChange) return;
    if (debouncedInput !== inputValue) return;
    const committedValue = searchValue ?? '';
    if (debouncedInput === committedValue) return;
    onSearchChange(debouncedInput);
  }, [debouncedInput, inputValue, onSearchChange, searchValue]);

  const searchId = `${idPrefix}-search`;

  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex w-full min-w-0 flex-col gap-1.5 sm:min-w-48 sm:flex-1 sm:basis-64">
        <Label htmlFor={searchId} className="text-muted-foreground">
          Search
        </Label>
        <InputGroup className="w-full">
          <InputGroupAddon align="inline-start">
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            id={searchId}
            type="search"
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            autoComplete="off"
            value={inputValue}
            disabled={disabled}
            onChange={(event) => setInputValue(event.target.value)}
          />
        </InputGroup>
      </div>
      {structured
        ? filters.map((filter, index) => {
            const triggerId = `${idPrefix}-filter-${index}`;
            return (
              <div key={filter.name} className="flex w-full shrink-0 flex-col gap-1.5 sm:w-44">
                <Label htmlFor={triggerId} className="text-muted-foreground">
                  {filter.name}
                </Label>
                <FilterMultiSelect filter={filter} triggerId={triggerId} disabled={disabled} />
              </div>
            );
          })
        : filters.map((name, index) => {
            const triggerId = `${idPrefix}-filter-${index}`;
            return (
              <div key={name} className="flex w-full shrink-0 flex-col gap-1.5 sm:w-40">
                <Label htmlFor={triggerId} className="text-muted-foreground">
                  {name}
                </Label>
                <Select defaultValue={name}>
                  <SelectTrigger id={triggerId} aria-label={name} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={name}>{name}</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            );
          })}
      {dateRange ? <div className="w-full shrink-0 sm:w-56">{dateRange}</div> : null}
      {actions ? (
        <div
          className="flex w-full flex-wrap items-end gap-2 sm:w-auto sm:shrink-0 [&>button]:flex-1 sm:[&>button]:flex-none"
          onClickCapture={(event) => {
            const button = (event.target as HTMLElement | null)?.closest('button');
            if (!button) return;
            const label = button.textContent?.replace(/\s+/g, ' ').trim() ?? '';
            if (!/^Clear Filters$/i.test(label)) return;
            // Clear the visible search immediately (including uncommitted debounce text).
            setInputValue('');
            if ((searchValue ?? '') !== '') onSearchChange?.('');
          }}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}
