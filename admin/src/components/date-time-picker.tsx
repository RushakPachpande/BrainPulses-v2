import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
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
import { cn } from '@/lib/utils';

type DateTimePickerProps = {
  id: string;
  value: Date;
  onChange: (value: Date) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function DateTimePicker({
  id,
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder = 'Pick date and time',
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const hours = value.getHours();
  const minutes = value.getMinutes();

  const hourOptions = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minuteOptions = useMemo(() => [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55], []);

  function setDatePart(day?: Date) {
    if (!day) return;
    const next = new Date(day);
    next.setHours(hours, minutes, 0, 0);
    onChange(next);
  }

  function setTimePart(nextHours: number, nextMinutes: number) {
    const next = new Date(value);
    next.setHours(nextHours, nextMinutes, 0, 0);
    onChange(next);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-required={required || undefined}
          aria-expanded={open}
          className={cn(
            'h-(--control-h) min-h-(--control-h) w-full min-w-0 justify-start overflow-hidden px-2.5 text-left text-base font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="size-4 shrink-0" />
          <span className="min-w-0 truncate">
            {value ? format(value, 'd MMM yyyy, hh:mm a') : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[calc(7*var(--cell-size)+1rem)] max-w-[calc(100vw-1.5rem)] gap-0 overflow-hidden p-0 [--cell-size:--spacing(7)]"
      >
        <Calendar
          mode="single"
          selected={value}
          onSelect={setDatePart}
          defaultMonth={value}
          className="w-full bg-transparent p-2"
          classNames={{
            root: 'w-full',
            months: 'relative w-full',
            month: 'w-full',
            month_grid: 'w-full',
            weekdays: 'flex w-full',
            week: 'mt-2 flex w-full',
          }}
        />
        <div className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2 border-t border-border p-2.5">
          <div className="flex min-w-0 flex-col gap-1">
            <Label className="text-xs font-normal text-muted-foreground">Hour</Label>
            <Select value={String(hours)} onValueChange={(v) => setTimePart(Number(v), minutes)}>
              <SelectTrigger size="sm" className="w-full" aria-label="Hour">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {hourOptions.map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {pad(h)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <Label className="text-xs font-normal text-muted-foreground">Minute</Label>
            <Select
              value={String(minutes - (minutes % 5))}
              onValueChange={(v) => setTimePart(hours, Number(v))}
            >
              <SelectTrigger size="sm" className="w-full" aria-label="Minute">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {minuteOptions.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {pad(m)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <Button type="button" size="sm" className="shrink-0" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
