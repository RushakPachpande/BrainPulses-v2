import { SearchIcon } from 'lucide-react';
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
  searchPlaceholder = 'Search',
  searchValue,
  onSearchChange,
}: {
  filters: string[] | ToolbarFilter[];
  actions?: ReactNode;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
}) {
  const structured = isFilterDefs(filters);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <InputGroup className="w-full sm:w-64">
        <InputGroupAddon align="inline-start">
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          autoComplete="off"
          value={searchValue}
          onChange={onSearchChange ? (event) => onSearchChange(event.target.value) : undefined}
        />
      </InputGroup>
      {structured
        ? filters.map((filter) => (
            <Select key={filter.name} value={filter.value} onValueChange={filter.onValueChange}>
              <SelectTrigger aria-label={filter.name} className="w-full sm:w-40">
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
              <SelectTrigger aria-label={name} className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={name}>{name}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          ))}
      {actions ? (
        <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">{actions}</div>
      ) : null}
    </div>
  );
}
