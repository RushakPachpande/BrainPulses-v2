import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SortHeader({
  label,
  active,
  direction,
  onSort,
}: {
  label: string;
  active: boolean;
  direction: 'asc' | 'desc';
  onSort: () => void;
}) {
  const Icon = !active ? ArrowUpDownIcon : direction === 'asc' ? ArrowUpIcon : ArrowDownIcon;
  const nextHint = !active
    ? `Sort by ${label} ascending`
    : direction === 'asc'
      ? `Sort by ${label} descending`
      : `Clear ${label} sort`;
  return (
    <Button
      type="button"
      variant="ghost"
      className="-ml-2 h-auto gap-1 px-2 font-medium text-foreground hover:bg-transparent"
      onClick={onSort}
      aria-label={nextHint}
      title={nextHint}
    >
      {label}
      <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
    </Button>
  );
}
