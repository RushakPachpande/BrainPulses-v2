import { format, subDays } from 'date-fns';

export type DateRangePreset = 'all' | 'today' | 'last7' | 'custom';

export type DateRangeValue = {
  preset: DateRangePreset;
  from?: string;
  to?: string;
};

export const ALL_DATE_RANGE: DateRangeValue = { preset: 'all' };

export function ymdFromPicker(day: Date) {
  return format(day, 'yyyy-MM-dd');
}

export function pickerDate(ymd: string) {
  return new Date(`${ymd}T12:00:00`);
}

export function todayYmd() {
  return ymdFromPicker(new Date());
}

export function rangeForPreset(preset: Exclude<DateRangePreset, 'custom' | 'all'>): DateRangeValue {
  const today = new Date();
  if (preset === 'today') {
    const ymd = ymdFromPicker(today);
    return { preset, from: ymd, to: ymd };
  }
  const from = ymdFromPicker(subDays(today, 6));
  const to = ymdFromPicker(today);
  return { preset: 'last7', from, to };
}

function formatDisplayRange(from: string, to: string) {
  const start = pickerDate(from);
  const end = pickerDate(to);
  if (from === to) return format(start, 'd MMM yyyy');
  if (start.getFullYear() === end.getFullYear()) {
    return `${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy')}`;
  }
  return `${format(start, 'd MMM yyyy')} – ${format(end, 'd MMM yyyy')}`;
}

export function dateRangeLabel(value: DateRangeValue) {
  if (value.preset === 'all') return 'Date Range: All';
  if (value.preset === 'today') return 'Date Range: Today';
  if (value.preset === 'last7') return 'Date Range: Last 7 days';
  if (value.from && value.to) return formatDisplayRange(value.from, value.to);
  return 'Date Range: Custom';
}

/** Parse fixture dates like "03 Sep 2026" or "15 Oct 2026" to yyyy-MM-dd. */
export function parseFixtureDate(label: string): string | null {
  const match = label.trim().match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const monthName = match[2];
  const year = Number(match[3]);
  const months: Record<string, number> = {
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Aug: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dec: 11,
  };
  const month = months[monthName];
  if (month === undefined || Number.isNaN(day) || Number.isNaN(year)) return null;
  return ymdFromPicker(new Date(year, month, day, 12, 0, 0));
}

export function isDateInRange(ymd: string | null, range: DateRangeValue) {
  if (range.preset === 'all' || !range.from || !range.to || !ymd) return true;
  return ymd >= range.from && ymd <= range.to;
}

export function customRangeValid(from?: string, to?: string) {
  if (!from || !to) return false;
  return from <= to;
}
