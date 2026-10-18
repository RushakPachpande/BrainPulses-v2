# BrainPulses — Shared Date & Time Picker

Use the provided calendar + vertically scrollable **Hour**, **Minute**, and **AM/PM** columns as the common date-time control. This replaces the old admin date-time picker without changing its callers.

## Where files live

| App | React component | Stylesheet | Tokens |
| --- | --- | --- | --- |
| Admin | `admin/src/components/date-time-picker.tsx` | `admin/src/components/date-time-picker.css` | `admin/src/styles/tokens.css` |
| Client | `client/src/components/date-time-picker.tsx` | `client/src/components/date-time-picker.css` | `client/src/styles/tokens.css` |

Both apps expose the same component API, but **neither app depends on the other**. Each DateTimePicker can be changed independently. The old `design:picker:sync` script was removed together with the repository-root `design-system/` directory. To intentionally keep behavior aligned, apply equivalent updates to each app's local component.

**Interactive specimen:** Admin → Settings → Design System → Date & time picker. The app-local dependency-free previews live in `admin/docs/design-system/preview.html` and `client/docs/design-system/preview.html`.

**Popup flicker fix:** The event/positioning effect uses `useLayoutEffect` so the portal coordinates are set before first paint, and panel focus uses `{ preventScroll: true }`.

## Why this is not your React Hook Form `Form` wrapper

The provided snippet uses `react-hook-form`, `zod`, Shadcn `Calendar`, `Popover` and `ScrollArea`, but **the client app doesn't have those dependencies**. The shared component reproduces the requested visual layout and behavior using dependencies already installed in both apps (`react`, `react-dom`, `lucide-react`). You can wrap it inside React Hook Form, use it in controlled React forms, or use it without a form. No new npm package or API code is required.

## Basic usage (Admin or Client)

```tsx
import { useState } from 'react';
import { DateTimePicker } from './components/date-time-picker';

export function ScheduleExample() {
  const [startAt, setStartAt] = useState<Date | null>(null);

  return (
    <div className="space-y-2">
      <label htmlFor="starts-at">Assessment start time</label>
      <DateTimePicker
        id="starts-at"
        value={startAt}
        onChange={setStartAt}
        onClear={() => setStartAt(null)}
        minuteStep={5}
        required={false}
      />
    </div>
  );
}
```

## With React Hook Form (in apps that already have it)

You **do not** need the full `DateTimePickerForm` from the example inside this shared component:

```tsx
import { Controller } from 'react-hook-form';
import { DateTimePicker } from '@/components/date-time-picker';

<Controller
  name="time"
  control={form.control}
  render={({ field, fieldState }) => (
    <div>
      <label htmlFor="time">Date & time</label>
      <DateTimePicker
        id="time"
        value={field.value ?? null}
        onChange={(date) => field.onChange(date)}
        onClear={() => field.onChange(null)}
        required
      />
      {fieldState.error && <p role="alert">{fieldState.error.message}</p>}
    </div>
  )}
/>
```

Schema validation should remain the form's responsibility. A required date needs an explicit valid `Date` (not null), and `onClear` is hidden when `required` is true.

## Visual and interaction contracts

- **Trigger height:** `var(--control-h, 44px)` (44px in both existing apps), not a hard-coded different size. All standard form input heights remain unchanged.
- **Colors:** no hard-coded brand hex values; `--popover`, `--foreground`, `--muted`, `--border`, `--input`, `--primary`, `--ring`, `--secondary`, etc. come from the app-local design tokens.
- **Theme:** automatically follows the `dark` class on the HTML root; no provider required.
- **Calendar:** prev/next month, selected date, today indicator, adjacent-month dates, minimum/maximum date.
- **Time columns:** exactly twelve 12-hour options, minute steps defaulting to five, and AM/PM. `12 AM → 00:xx`, `12 PM → 12:xx`.
- **Commit behavior:** selection updates an internal draft; **Apply** calls `onChange`, while **Cancel**, Escape, and outside clicks discard uncommitted changes. **Now** selects current local date/time.
- **Form safety:** every button has `type="button"`; no accidental form submits.
- **Responsive:** desktop anchored popup, narrow screens use a scrollable bottom sheet.
- **Boundaries:** optional `minDate` and `maxDate` prevent invalid dates and reject out-of-range times when pressing Apply.
- **Timezone:** the component represents a browser-local `Date` by design. When sending to the API, transmit `date.toISOString()` and use the API as the source of truth. An explicit timezone selector is intentionally omitted.

## Existing integration

`admin/src/pages/activity-wizard.tsx` already imports `DateTimePicker` and supplies `id`, `value`, `onChange`, and `disabled`; **no changes to that page are necessary**. In the Client app, import the picker when adding a scheduling form; currently the Client has no date-time picker caller.

## Run checks after installing dependencies

```bash
npm run cleaninstall
npm run typecheck:admin
npm run typecheck:client
npm run build:admin
npm run build:client
```

Review the popup in light and dark themes, inside a scrolled form, at 390px phone width, and with both 12 AM and 12 PM.
