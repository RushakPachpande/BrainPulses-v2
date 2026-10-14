import { SearchIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type ToolbarFilter = {
  name: string;
  options: string[];
  value: string;
  onValueChange: (value: string) => void;
};

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
}: {
  filters: string[] | ToolbarFilter[];
  actions?: ReactNode;
  dateRange?: ReactNode;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
}) {
  const structured = isFilterDefs(filters);
  const [inputValue, setInputValue] = useState(searchValue ?? '');

  // Keep typing immediate in the input while delaying expensive filtering/API work.
  useEffect(() => {
    setInputValue(searchValue ?? '');
  }, [searchValue]);

  useEffect(() => {
    const committedValue = searchValue ?? '';
    if (!onSearchChange || inputValue === committedValue) return;

    const timeoutId = window.setTimeout(() => onSearchChange(inputValue), 300);
    return () => window.clearTimeout(timeoutId);
  }, [inputValue, onSearchChange, searchValue]);

  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <InputGroup className="w-full min-w-0 sm:min-w-[12rem] sm:flex-1 sm:basis-64">
        <InputGroupAddon align="inline-start">
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          autoComplete="off"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
        />
      </InputGroup>
      {structured
        ? filters.map((filter) => (
            <Select key={filter.name} value={filter.value} onValueChange={filter.onValueChange}>
              <SelectTrigger aria-label={filter.name} className="w-full shrink-0 sm:w-40">
                <span className="truncate">
                  {filter.name}: {filter.value}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {filter.options.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ))
        : filters.map((name) => (
            <Select key={name} defaultValue={name}>
              <SelectTrigger aria-label={name} className="w-full shrink-0 sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={name}>{name}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          ))}
      {dateRange ? <div className="w-full shrink-0 sm:w-56">{dateRange}</div> : null}
      {actions ? (
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0 [&>button]:flex-1 sm:[&>button]:flex-none">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
