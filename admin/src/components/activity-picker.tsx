import { useState } from 'react';
import { ChevronDownIcon, SearchIcon, TriangleAlertIcon, XIcon } from 'lucide-react';
import { StatusPill } from '@/components/status-pill';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { availabilityTone, endsBeforeClose, type ContestFormQuiz } from '@/lib/contest-form';
import { cn } from '@/lib/utils';

export function KindTag({ kind }: { kind?: 'quiz' | 'assessment' }) {
  return (
    <Badge variant={kind === 'assessment' ? 'outline' : 'secondary'} className="shrink-0">
      {kind === 'assessment' ? 'Assessment' : 'Quiz'}
    </Badge>
  );
}

/** Searchable multi-pick of the contest's quizzes and assessments, each tagged with its kind. */
export function ActivityPicker({
  label,
  activities,
  selectedIds,
  closesAt,
  invalid,
  onChange,
}: {
  label: string;
  activities: ContestFormQuiz[];
  selectedIds: string[];
  closesAt: string | null;
  invalid?: boolean;
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query);
  const byId = new Map(activities.map((activity) => [activity.id, activity]));
  const q = debouncedQuery.trim().toLowerCase();
  const list = activities.filter((activity) => !q || activity.name.toLowerCase().includes(q));

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {selectedIds.length ? (
        <ul className="flex flex-wrap gap-1.5" aria-label={`${label}: chosen`}>
          {selectedIds.map((id) => {
            const activity = byId.get(id);
            return (
              <li
                key={id}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted py-0.5 pr-1 pl-1.5 text-sm"
              >
                <KindTag kind={activity?.kind} />
                <span className="min-w-0 break-words">{activity?.name ?? 'Removed activity'}</span>
                <button
                  type="button"
                  className="inline-flex size-6 items-center justify-center rounded-full hover:bg-background"
                  aria-label={`Remove ${activity?.name ?? 'activity'}`}
                  onClick={() => onChange(selectedIds.filter((item) => item !== id))}
                >
                  <XIcon className="size-3.5" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              'w-full justify-between font-normal text-muted-foreground',
              invalid && 'border-destructive',
            )}
            aria-label={label}
            aria-invalid={invalid || undefined}
          >
            {selectedIds.length ? 'Add or remove' : 'Choose quizzes and assessments'}
            <ChevronDownIcon data-icon="inline-end" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(26rem,calc(100vw-2rem))] p-2" align="start">
          <div className="relative">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              className="pl-9"
              placeholder="Search…"
              aria-label="Search activities"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="mt-2 flex max-h-72 flex-col overflow-y-auto">
            {list.length === 0 ? (
              <p className="p-2 text-sm text-muted-foreground">
                {activities.length
                  ? 'Nothing matches.'
                  : 'This contest has no quizzes or assessments yet.'}
              </p>
            ) : (
              list.map((activity) => {
                const ended = activity.availability === 'Ended';
                const checked = selectedIds.includes(activity.id);
                return (
                  <label
                    key={activity.id}
                    className={cn(
                      'flex min-h-11 items-center gap-2 rounded-md px-2 text-sm hover:bg-muted',
                      ended && !checked && 'opacity-60',
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={ended && !checked}
                      onCheckedChange={(next) =>
                        onChange(
                          next === true
                            ? [...selectedIds, activity.id]
                            : selectedIds.filter((id) => id !== activity.id),
                        )
                      }
                    />
                    <KindTag kind={activity.kind} />
                    <span className="min-w-0 flex-1 break-words">
                      {activity.name}
                      {!ended && endsBeforeClose(activity, closesAt) ? (
                        <TriangleAlertIcon
                          className="ml-1 inline size-4 text-warning"
                          aria-label="Ends before registration closes"
                        />
                      ) : null}
                    </span>
                    <StatusPill
                      value={activity.availability}
                      tone={availabilityTone(activity.availability)}
                    />
                  </label>
                );
              })
            )}
          </div>
          <div className="mt-2 flex justify-end">
            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
