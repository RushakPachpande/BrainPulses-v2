import { SearchIcon } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
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
  value: string;
  onValueChange: (value: string) => void;
};

function optionValue(option: ToolbarFilterOption) {
  return typeof option === 'string' ? option : option.value;
}

function optionLabel(option: ToolbarFilterOption) {
  return typeof option === 'string' ? option : option.label;
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
            const selectedLabel = optionLabel(
              filter.options.find((option) => optionValue(option) === filter.value) ?? filter.value,
            );
            return (
              <div key={filter.name} className="flex w-full shrink-0 flex-col gap-1.5 sm:w-40">
                <Label htmlFor={triggerId} className="text-muted-foreground">
                  {filter.name}
                </Label>
                <Select
                  value={filter.value}
                  onValueChange={filter.onValueChange}
                  disabled={disabled}
                >
                  <SelectTrigger id={triggerId} aria-label={filter.name} className="w-full">
                    <span className="truncate">{selectedLabel}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {filter.options.map((option) => (
                        <SelectItem key={optionValue(option)} value={optionValue(option)}>
                          {optionLabel(option)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
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
