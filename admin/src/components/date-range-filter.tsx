import { useEffect, useState } from 'react';
import { type DateRange } from 'react-day-picker';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  ALL_DATE_RANGE,
  customRangeValid,
  dateRangeLabel,
  pickerDate,
  rangeForPreset,
  todayYmd,
  ymdFromPicker,
  type DateRangePreset,
  type DateRangeValue,
} from '@/lib/date-range';
import { cn } from '@/lib/utils';

const PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'custom', label: 'Custom' },
];

export function DateRangeFilter({
  value,
  onApply,
  className,
}: {
  value: DateRangeValue;
  onApply: (next: DateRangeValue) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const applyEnabled = draft.preset !== 'custom' || customRangeValid(draft.from, draft.to);

  function customRange(current: DateRangeValue): DateRange | undefined {
    if (!current.from) return undefined;
    return {
      from: pickerDate(current.from),
      to: current.to ? pickerDate(current.to) : pickerDate(current.from),
    };
  }

  function applyCustomRange(range: DateRange | undefined) {
    if (!range?.from) {
      setDraft((current) => ({ ...current, from: undefined, to: undefined }));
      return;
    }
    const from = ymdFromPicker(range.from);
    const to = range.to ? ymdFromPicker(range.to) : from;
    setDraft({ preset: 'custom', from, to });
  }

  function selectPreset(preset: DateRangePreset) {
    if (preset === 'all') {
      setDraft(ALL_DATE_RANGE);
      return;
    }
    if (preset === 'custom') {
      setDraft((current) => ({
        preset: 'custom',
        from: current.from ?? todayYmd(),
        to: current.to ?? todayYmd(),
      }));
      return;
    }
    setDraft(rangeForPreset(preset));
  }

  function apply() {
    if (!applyEnabled) return;
    onApply(draft);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label="Date Range"
          aria-expanded={open}
          className={cn(
            'h-(--control-h) min-h-(--control-h) w-full justify-start overflow-hidden px-2.5 text-left text-base font-normal sm:w-56',
            className,
          )}
        >
          <CalendarIcon className="size-4 shrink-0" />
          <span className="min-w-0 truncate">{dateRangeLabel(value)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className={cn('gap-0 p-0', draft.preset === 'custom' ? 'w-auto' : 'w-72')}
      >
        <div className="border-b border-border bg-muted/40 px-4 py-2.5">
          <p className="text-center text-sm font-medium">Date Range</p>
        </div>
        <div className="flex flex-col gap-3 px-4 py-3">
          <RadioGroup
            value={draft.preset}
            onValueChange={(next) => selectPreset(next as DateRangePreset)}
            className="gap-2.5"
          >
            {PRESETS.map((option) => (
              <div key={option.value} className="flex items-center gap-2">
                <RadioGroupItem value={option.value} id={`date-range-${option.value}`} />
                <Label htmlFor={`date-range-${option.value}`} className="font-normal">
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
          {draft.preset === 'custom' ? (
            <Calendar
              mode="range"
              numberOfMonths={2}
              defaultMonth={draft.from ? pickerDate(draft.from) : new Date()}
              selected={customRange(draft)}
              onSelect={(range) => applyCustomRange(range)}
              className="rounded-lg border border-border p-2"
            />
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button type="button" variant="secondary" onClick={() => setDraft(ALL_DATE_RANGE)}>
            Reset
          </Button>
          <Button type="button" onClick={apply} disabled={!applyEnabled}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
