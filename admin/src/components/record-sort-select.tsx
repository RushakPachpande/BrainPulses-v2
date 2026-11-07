import { useId } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';

const SORT_IDLE = '__record_sort_idle__';

export function RecordSortSelect({
  columns,
  activeKey,
  direction,
  onSort,
}: {
  columns: { key: string; label: string }[];
  activeKey: string | null;
  direction: 'asc' | 'desc';
  onSort: (key: string) => void;
}) {
  const triggerId = useId();
  const active = columns.find((column) => column.key === activeKey);
  const directionText = direction === 'asc' ? 'A–Z' : 'Z–A';
  const summary = active ? `${active.label} (${directionText})` : 'Default';
  const accessibleName = active
    ? `Sort, ${active.label}, ${direction === 'asc' ? 'ascending' : 'descending'}`
    : 'Sort, default order';

  return (
    <div className="flex w-full flex-col gap-1.5 sm:w-56">
      <Label htmlFor={triggerId} className="text-muted-foreground">
        Sort
      </Label>
      <Select
        value={SORT_IDLE}
        onValueChange={(value) => {
          if (value === SORT_IDLE) return;
          onSort(value);
        }}
      >
        <SelectTrigger id={triggerId} aria-label={accessibleName} className="w-full">
          <span className="truncate">{summary}</span>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {columns.map((column) => (
              <SelectItem key={column.key} value={column.key}>
                {column.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
