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
  const active = columns.find((column) => column.key === activeKey);
  const directionText = direction === 'asc' ? 'A–Z' : 'Z–A';
  const summary = active ? `Sort: ${active.label} (${directionText})` : 'Sort: Default';
  const accessibleName = active
    ? `Sort, ${active.label}, ${direction === 'asc' ? 'ascending' : 'descending'}`
    : 'Sort, default order';

  return (
    <Select
      value={SORT_IDLE}
      onValueChange={(value) => {
        if (value === SORT_IDLE) return;
        onSort(value);
      }}
    >
      <SelectTrigger aria-label={accessibleName} className="w-full sm:w-56">
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
  );
}
