---
name: Date time picker
overview: Polish create-form DateTimePicker (LevelUP UX + BP theme), fix calendar size/contrast, and add a PGDM-style DateRangeFilter on Assessments/Quizzes list and Reports toolbars.
todos:
  - id: add-calendar
    content: Install shadcn calendar (+ react-day-picker/date-fns) in admin/
    status: completed
  - id: datetime-picker
    content: Build DateTimePicker (Popover + Calendar + time InputGroup)
    status: completed
  - id: wire-create
    content: Replace Start/End Date Inputs on create-activity.tsx
    status: completed
  - id: verify
    content: Run typecheck, lint, format:check in admin/
    status: completed
  - id: fix-calendar-chrome
    content: Fix calendar cell size vs --control-h and light-mode day number contrast
    status: completed
  - id: polish-datetime
    content: Restyle DateTimePicker trigger + LevelUP hour/minute/Done UX (BP tokens)
    status: completed
  - id: date-range-filter
    content: Add PGDM-style DateRangeFilter + radio-group; extend Toolbar slot
    status: completed
  - id: wire-range-pages
    content: Wire DateRangeFilter on activity-list + reports (assessment and quiz)
    status: completed
  - id: verify-polish
    content: typecheck, lint, format touched files; check light/dark and ~375/768/1280
    status: completed
isProject: false
---

# Date/time and date-range polish

## Goals

1. Fix create-form datetime controls (height, trigger chrome, oversized popup, light-mode day numbers).
2. Replace every existing **Date Range / Date range** toolbar control with a PGDM-style range chooser (theme-compatible).
3. Keep BrainPulses tokens and `--control-h` for field triggers only — not calendar day cells.

## Root causes (current)

- Calendar day cells are `Button size="icon"` inside `sidebar-inset`, so [`admin/src/index.css`](admin/src/index.css) forces **44×44** (`--control-h`) and inflates the popover.
- Global ghost rule sets `color: muted-foreground`, so day digits look washed out in light mode.
- Create picker uses native `type="time"` instead of LevelUP’s Hour/Minute selects + Done.

## References

| Concern | Source |
| --- | --- |
| Create Start/End datetime UX | LevelUP [`date-time-picker.tsx`](references/reference-projects/LevelUP/levelup-admin/src/components/ui/date-time-picker.tsx) (calendar + Hour/Minute selects + Done; optional clear) |
| Toolbar date-range UX | PGDM [`filter-timeline.tsx`](references/reference-projects/PGDM Induction Program/admin/src/components/filter-timeline.tsx) / [`performance-range-filter.tsx`](references/reference-projects/PGDM Induction Program/admin/src/components/performance-range-filter.tsx) (popover, presets + custom `mode="range"` calendar, Reset/Apply) |
| Theme | BP [`admin/src/index.css`](admin/src/index.css) tokens only — no LevelUP/PGDM palettes |

## Part A — Calendar chrome

In [`admin/src/index.css`](admin/src/index.css), scope overrides under `[data-slot='calendar']`:

- Day/nav icon buttons: `height/min-height/width` follow `--cell-size` (not `--control-h`); no forced min-height from global button rules.
- Day button text: `color: var(--foreground)` (selected states keep primary / primary-foreground).
- No hover box-shadow on calendar day buttons.
- Keep cell size compact (`[--cell-size:--spacing(7)]` or equivalent) so single and range calendars stay dense.

## Part B — Create DateTimePicker (LevelUP UX, BP theme)

Rewrite [`admin/src/components/date-time-picker.tsx`](admin/src/components/date-time-picker.tsx):

- Trigger: outline Button, `w-full`, `font-normal`, `--control-h` height (global button rule), calendar icon, truncate label `d MMM yyyy, hh:mm a`.
- Popover: compact `Calendar` `mode="single"` + footer with Hour/Minute `Select`s (5-min steps) + Done (close). No native `type="time"`.
- Optional clear (X) only if value is clearable; create form keeps required values — no clear on create fields.
- Keep `id` / `aria-required` / FieldLabel wiring on create page.

## Part C — DateRangeFilter (PGDM pattern, simplified)

Add [`admin/src/components/date-range-filter.tsx`](admin/src/components/date-range-filter.tsx) adapted from PGDM FilterTimeline:

- Trigger: outline, calendar icon, truncate label; width `w-full sm:w-56` (toolbar-friendly).
- Popover: title “Date Range”; radio presets; custom shows `Calendar mode="range"` (`numberOfMonths={2}` like PGDM, compact cells from Part A); footer Reset + Apply.
- Presets (no PGDM program-window API): **All** (default), **Today**, **Last 7 days**, **Custom**.
- Labels: `Date Range: All` / `Date Range: Today` / `Date Range: Last 7 days` / `15 Oct – 30 Oct` (custom).
- Reset restores All. Apply commits draft and closes.
- Install shadcn `radio-group` if missing.

Value shape: `{ preset: 'all' | 'today' | 'last7' | 'custom'; from?: string; to?: string }` (ymd strings).

### Toolbar

Extend [`admin/src/components/toolbar.tsx`](admin/src/components/toolbar.tsx) with optional `dateRange?: ReactNode` rendered after the filter Selects (same wrap row, full width below `sm`, `sm:w-56`). Do not invent a second toolbar layout.

### Wire-up (exactly these places)

1. [`admin/src/pages/activity-list.tsx`](admin/src/pages/activity-list.tsx) — Assessments + Quizzes lists: remove Date Range from `ToolbarFilter[]`; pass `DateRangeFilter` via `dateRange`. Clear Filters resets to All. Client-filter rows where activity `start` date falls in `[from, to]` when not All (parse fixture `when()` strings).
2. [`admin/src/pages/reports.tsx`](admin/src/pages/reports.tsx) — Assessment + Quiz reports: drop string `'Date range'` from filters; pass `DateRangeFilter`. Filter result rows by `submitted` date when not All; other stub Selects unchanged.

No other pages in this pass. Future date-range spots reuse the same component via the Toolbar slot.

## Out of scope

- End-before-start validation on create
- Settings date/time format driving picker labels
- PGDM program-window / induction bounds / 92-day API clamping
- Notifications hover work
- Changing Status / Student / Quiz stub Selects beyond swapping out Date range

## Verify

`npm run typecheck`, `npm run lint`, format touched files. Spot-check create + list + reports in light and dark at ~375 / ~768 / ~1280: trigger height matches other toolbar controls; calendar digits readable; popover not oversized.
