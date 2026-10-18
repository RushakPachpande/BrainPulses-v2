/**
 * BrainPulses DateTimePicker — maintained locally by the Client app.
 * Theme colors come from this app's src/styles/tokens.css.
 * No shadcn, React Hook Form, Zod, or app-specific dependencies required.
 *
 * Uses the same calendar + scrollable hour / minute / AM-PM columns as the supplied reference.
 * Dates are local Date objects; persist with date.toISOString() when using the API.
 */
import { useCallback, useEffect, useLayoutEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  X,
} from 'lucide-react';
import './date-time-picker.css';

export type DateTimePickerProps = {
  /** Unique field identifier for accessibility and label associations. */
  id: string;
  value: Date | null | undefined;
  /** Called only when Apply is pressed. */
  onChange: (date: Date) => void;
  /** Supply to enable Clear for optional fields. */
  onClear?: () => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  /** Time selection interval in minutes. Defaults to 5 (reference design). */
  minuteStep?: 1 | 5 | 10 | 15 | 30;
  /** Instant-level boundary, validated when Apply is pressed. */
  minDate?: Date;
  maxDate?: Date;
  /** Accessible name when no external label is present. */
  ariaLabel?: string;
};

type CalendarMonth = { year: number; month: number };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

function valid(value: Date | null | undefined): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}
function dateKey(value: Date) {
  return value.getFullYear() * 10_000 + (value.getMonth() + 1) * 100 + value.getDate();
}
function monthOf(value: Date): CalendarMonth {
  return { year: value.getFullYear(), month: value.getMonth() };
}
function moveMonth(value: CalendarMonth, amount: number): CalendarMonth {
  return monthOf(new Date(value.year, value.month + amount, 1, 12));
}
function monthLabel(value: CalendarMonth) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(
    new Date(value.year, value.month, 1, 12),
  );
}
function showDate(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(value);
}
function dateLabel(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).format(value);
}
function gridDays(month: CalendarMonth): Date[] {
  const first = new Date(month.year, month.month, 1, 12);
  return Array.from({ length: 42 }, (_, index) =>
    new Date(month.year, month.month, index + 1 - first.getDay(), 12),
  );
}
function selectable(date: Date, minDate?: Date, maxDate?: Date) {
  // Calendar checks whole days. Instant-level checks happen on Apply.
  if (valid(minDate) && dateKey(date) < dateKey(minDate)) return false;
  if (valid(maxDate) && dateKey(date) > dateKey(maxDate)) return false;
  return true;
}
function setClock(date: Date, hours: number, minutes: number) {
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

export function DateTimePicker({
  id,
  value,
  onChange,
  onClear,
  placeholder = 'MM/DD/YYYY hh:mm aa',
  required = false,
  disabled = false,
  className = '',
  minuteStep = 5,
  minDate,
  maxDate,
  ariaLabel,
}: DateTimePickerProps) {
  const uniqueId = useId();
  const dialogId = `${uniqueId}-dialog`;
  const titleId = `${uniqueId}-title`;
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const hourList = useRef<HTMLDivElement>(null);
  const minuteList = useRef<HTMLDivElement>(null);
  const ampmList = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => new Date(valid(value) ? value : new Date()));
  const [visibleMonth, setVisibleMonth] = useState(() => monthOf(valid(value) ? value : new Date()));
  const [position, setPosition] = useState<CSSProperties>({});
  const [error, setError] = useState('');

  const selectedHour = draft.getHours() % 12 || 12;
  const isPm = draft.getHours() >= 12;
  // Keep a previously saved odd minute visible so editing does not silently lose precision.
  const minutes = useMemo(() => {
    const steps = Array.from({ length: 60 / minuteStep }, (_, i) => i * minuteStep);
    if (!steps.includes(draft.getMinutes())) steps.push(draft.getMinutes());
    return steps.sort((a, b) => a - b);
  }, [minuteStep, draft]);
  const calendarDays = useMemo(() => gridDays(visibleMonth), [visibleMonth]);
  const todayKey = dateKey(new Date());

  const layout = useCallback(() => {
    const anchor = trigger.current;
    if (!anchor || typeof window === 'undefined') return;
    if (window.innerWidth <= 700) {
      setPosition({});
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(652, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    const gap = 8;
    const edge = 12;
    const spaceBelow = window.innerHeight - rect.bottom - edge;
    const spaceAbove = rect.top - edge;
    const panelHeight = panel.current?.offsetHeight ?? 0;
    const placeAbove =
      spaceAbove > spaceBelow &&
      (panelHeight === 0 || spaceBelow < panelHeight);
    const maxHeight = placeAbove
      ? Math.max(0, spaceAbove - gap)
      : Math.max(0, spaceBelow - gap);
    const heightForTop = panelHeight > 0 ? Math.min(panelHeight, maxHeight) : maxHeight;
    const top = placeAbove
      ? Math.max(edge, rect.top - gap - heightForTop)
      : rect.bottom + gap;
    setPosition({ top, left, width, maxHeight });
  }, []);

  const dismiss = useCallback((restoreFocus = false) => {
    setOpen(false);
    setError('');
    if (restoreFocus) window.requestAnimationFrame(() => trigger.current?.focus());
  }, []);

  function openPicker() {
    if (disabled) return;
    const current = new Date(valid(value) ? value : new Date());
    setDraft(current);
    setVisibleMonth(monthOf(current));
    setError('');
    setOpen(true);
  }

  useLayoutEffect(() => {
    if (!open) return;
    layout();
    const focusFrame = window.requestAnimationFrame(() => panel.current?.focus({ preventScroll: true }));
    function outside(event: PointerEvent) {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !trigger.current?.contains(target)) dismiss();
    }
    function keyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        dismiss(true);
      }
      if (event.key !== 'Tab' || !panel.current) return;
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex="0"]',
      )).filter((item) => item.getClientRects().length > 0);
      if (items.length === 0) return;
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault(); items[items.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === items[items.length - 1]) {
        event.preventDefault(); items[0].focus();
      } else if (document.activeElement === panel.current) {
        event.preventDefault(); (event.shiftKey ? items[items.length - 1] : items[0]).focus();
      }
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', keyboard);
    window.addEventListener('resize', layout);
    window.addEventListener('scroll', layout, true);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', keyboard);
      window.removeEventListener('resize', layout);
      window.removeEventListener('scroll', layout, true);
    };
  }, [open, layout, dismiss]);

  useEffect(() => {
    if (!open) return;
    // Scroll the three columns to the selected time, without scrolling the document.
    const columns = [hourList, minuteList, ampmList];
    const keys = [String(selectedHour), String(draft.getMinutes()), isPm ? 'PM' : 'AM'];
    const raf = window.requestAnimationFrame(() => {
      columns.forEach((ref, i) => {
        const el = ref.current;
        const selected = Array.from(el?.querySelectorAll<HTMLButtonElement>('button') ?? [])
          .find((button) => button.dataset.value === keys[i]);
        if (selected && el) {
          el.scrollTop = selected.offsetTop - (el.clientHeight - selected.offsetHeight) / 2;
        }
      });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [open, selectedHour, draft, isPm]);

  function chooseDay(date: Date) {
    const next = new Date(draft);
    // setFullYear avoids date rollover when choosing a shorter month (e.g. Jan 31 to Feb 1).
    next.setDate(1);
    next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
    setDraft(next);
    setVisibleMonth(monthOf(date));
    setError('');
  }
  function chooseHour(hour12: number) {
    // In a 12-hour clock, 12 AM=00 and 12 PM=12.
    setDraft(setClock(draft, (hour12 % 12) + (isPm ? 12 : 0), draft.getMinutes()));
    setError('');
  }
  function chooseMinute(minute: number) {
    setDraft(setClock(draft, draft.getHours(), minute));
    setError('');
  }
  function chooseAmPm(ampm: 'AM' | 'PM') {
    const newHour = (draft.getHours() % 12) + (ampm === 'PM' ? 12 : 0);
    setDraft(setClock(draft, newHour, draft.getMinutes()));
    setError('');
  }
  function apply() {
    if (!valid(draft)) { setError('Select a valid date and time.'); return; }
    if (valid(minDate) && draft.getTime() < minDate.getTime()) {
      setError(`Select a date and time on or after ${showDate(minDate)}.`); return;
    }
    if (valid(maxDate) && draft.getTime() > maxDate.getTime()) {
      setError(`Select a date and time on or before ${showDate(maxDate)}.`); return;
    }
    onChange(new Date(draft));
    dismiss(true);
  }
  const selectedDay = dateKey(draft);

  return (
    <div className={`bp-dtp ${className}`}>
      <button
        ref={trigger}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-required={required || undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        className={`bp-dtp__trigger ${open ? 'bp-dtp__trigger--open' : ''}`}
        onClick={open ? () => dismiss() : openPicker}
      >
        <CalendarDays size={17} aria-hidden="true" />
        <span className={valid(value) ? 'bp-dtp__text' : 'bp-dtp__placeholder'}>
          {valid(value) ? showDate(value) : placeholder}
        </span>
        <ChevronDown size={17} aria-hidden="true" className="bp-dtp__chevron" />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div className="bp-dtp__portal">
          <div className="bp-dtp__backdrop" aria-hidden="true" onClick={() => dismiss()} />
          <div
            ref={panel}
            id={dialogId}
            role="dialog"
            aria-labelledby={titleId}
            aria-modal={typeof window !== 'undefined' && window.innerWidth <= 700}
            className="bp-dtp__panel"
            tabIndex={-1}
            style={position}
          >
            <div className="bp-dtp__mobile-title">
              <span id={titleId}>Choose date &amp; time</span>
              <button type="button" aria-label="Close picker" className="bp-dtp__nav" onClick={() => dismiss(true)}><X size={18} /></button>
            </div>
            {/* Screen readers require a dialog label even when the heading is hidden on desktop. */}
            <div className="bp-dtp__main">
              <section aria-label="Calendar" className="bp-dtp__calendar">
                <div className="bp-dtp__calendar-head">
                  <button className="bp-dtp__nav" type="button" aria-label="Previous month" onClick={() => setVisibleMonth(moveMonth(visibleMonth, -1))}><ChevronLeft size={19} /></button>
                  <span className="bp-dtp__month">{monthLabel(visibleMonth)}</span>
                  <button className="bp-dtp__nav" type="button" aria-label="Next month" onClick={() => setVisibleMonth(moveMonth(visibleMonth, 1))}><ChevronRight size={19} /></button>
                </div>
                <div className="bp-dtp__weekdays" aria-hidden="true">{DAYS.map((day) => <span key={day}>{day}</span>)}</div>
                <div className="bp-dtp__days" role="group" aria-label="Choose calendar date">
                  {calendarDays.map((date) => {
                    const selected = dateKey(date) === selectedDay;
                    const outside = date.getMonth() !== visibleMonth.month;
                    const isToday = dateKey(date) === todayKey;
                    return (
                      <button
                        key={dateKey(date)}
                        type="button"
                        aria-label={dateLabel(date)}
                        aria-pressed={selected}
                        aria-current={isToday ? 'date' : undefined}
                        disabled={!selectable(date, minDate, maxDate)}
                        className={[
                          'bp-dtp__day',
                          outside && 'bp-dtp__day--outside',
                          isToday && 'bp-dtp__day--today',
                          selected && 'bp-dtp__day--selected',
                        ].filter(Boolean).join(' ')}
                        onClick={() => chooseDay(date)}
                      >{date.getDate()}</button>
                    );
                  })}
                </div>
              </section>
              <section className="bp-dtp__times" aria-label="Choose a time">
                <div className="bp-dtp__time-head"><Clock3 size={16} aria-hidden="true" /> Select time</div>
                <div className="bp-dtp__time-grid">
                  <div className="bp-dtp__time-section">
                    <div className="bp-dtp__time-label">Hour</div>
                    <div className="bp-dtp__scroll" ref={hourList} role="group" aria-label="Hour">
                      {HOURS.map((hour) => (
                        <button type="button" key={hour} data-value={hour} aria-pressed={hour === selectedHour}
                          className={`bp-dtp__option ${hour === selectedHour ? 'bp-dtp__option--active' : ''}`}
                          onClick={() => chooseHour(hour)}>{hour}</button>
                      ))}
                    </div>
                  </div>
                  <div className="bp-dtp__time-section">
                    <div className="bp-dtp__time-label">Minute</div>
                    <div className="bp-dtp__scroll" ref={minuteList} role="group" aria-label="Minute">
                      {minutes.map((minute) => (
                        <button type="button" key={minute} data-value={minute} aria-pressed={minute === draft.getMinutes()}
                          className={`bp-dtp__option ${minute === draft.getMinutes() ? 'bp-dtp__option--active' : ''}`}
                          onClick={() => chooseMinute(minute)}>{String(minute).padStart(2, '0')}</button>
                      ))}
                    </div>
                  </div>
                  <div className="bp-dtp__time-section">
                    <div className="bp-dtp__time-label">AM / PM</div>
                    <div className="bp-dtp__scroll" ref={ampmList} role="group" aria-label="AM or PM">
                      {(['AM', 'PM'] as const).map((ampm) => (
                        <button type="button" key={ampm} data-value={ampm} aria-pressed={(ampm === 'PM') === isPm}
                          className={`bp-dtp__option ${(ampm === 'PM') === isPm ? 'bp-dtp__option--active' : ''}`}
                          onClick={() => chooseAmPm(ampm)}>{ampm}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="bp-dtp__selected-time" aria-live="polite">
                  {String(selectedHour).padStart(2, '0')}:{String(draft.getMinutes()).padStart(2, '0')} {isPm ? 'PM' : 'AM'}
                </div>
              </section>
            </div>
            {error && <p role="alert" className="bp-dtp__error">{error}</p>}
            <footer className="bp-dtp__footer">
              <div className="bp-dtp__footer-start">
                <button type="button" className="bp-dtp__footer-button bp-dtp__footer-button--tonal" onClick={() => {
                  const now = new Date(); setDraft(now); setVisibleMonth(monthOf(now)); setError('');
                }}><Clock3 size={15} />Now</button>
                {onClear && !required && <button type="button" className="bp-dtp__footer-button bp-dtp__footer-button--outline" onClick={() => {
                  onClear(); dismiss(true);
                }}>Clear</button>}
              </div>
              <div className="bp-dtp__footer-end">
                <button type="button" className="bp-dtp__footer-button bp-dtp__footer-button--outline" onClick={() => dismiss(true)}>Cancel</button>
                <button type="button" className="bp-dtp__footer-button bp-dtp__footer-button--primary" onClick={apply}><Check size={15} />Apply</button>
              </div>
            </footer>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
