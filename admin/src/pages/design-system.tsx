import { useState } from 'react';
import { toast } from 'sonner';
import {
  CheckIcon,
  CircleHelpIcon,
  PaletteIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { StatusPill } from '@/components/status-pill';
import { DateTimePicker } from '@/components/date-time-picker';

type Swatch = { label: string; token: string; note: string };
const brandSwatches: Swatch[] = [
  { label: '50', token: 'brand-50', note: 'Canvas tint' },
  { label: '100', token: 'brand-100', note: 'Soft wash' },
  { label: '200', token: 'brand-200', note: 'Quiet accent' },
  { label: '300', token: 'brand-300', note: 'Tint' },
  { label: '400', token: 'brand-400', note: 'Accent' },
  { label: '500', token: 'brand-500', note: 'Focus / chart' },
  { label: '600', token: 'brand-600', note: 'Logo violet' },
  { label: '700', token: 'brand-700', note: 'Deep violet' },
  { label: '800', token: 'brand-800', note: 'Dark violet' },
  { label: '900', token: 'brand-900', note: 'Deepest' },
];
const surfaceSwatches: Swatch[] = [
  { label: 'Background', token: 'background', note: 'App canvas' },
  { label: 'Card', token: 'card', note: 'Panels and tables' },
  { label: 'Muted', token: 'muted', note: 'Quiet surfaces' },
  { label: 'Accent', token: 'accent', note: 'Selection' },
  { label: 'Primary', token: 'primary', note: 'Main actions' },
  { label: 'Border', token: 'border', note: 'Separators' },
  { label: 'Success', token: 'success', note: 'Completed' },
  { label: 'Warning', token: 'warning', note: 'Pending' },
  { label: 'Destructive', token: 'destructive', note: 'Critical' },
];
const sampleOptions = [
  'One consistent source for shared data and business rules',
  'Separate sources of truth in every frontend',
  'Repeated API logic inside the administration UI',
  'Independent client-side copies of authorization rules',
];

function TokenSwatch({ label, token, note }: Swatch) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card p-2.5">
      <div
        aria-hidden="true"
        className="h-12 rounded-md border border-border/60 sm:h-14"
        style={{ backgroundColor: `var(--${token})` }}
      />
      <p className="mt-2 truncate text-sm font-semibold text-foreground">{label}</p>
      <p className="truncate font-mono text-[11px] text-muted-foreground" title={`--${token}`}>
        --{token}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

export function DesignSystemPage() {
  const [selected, setSelected] = useState<number | null>(0);
  const [notifications, setNotifications] = useState(true);
  const [demoSchedule, setDemoSchedule] = useState<Date | null>(new Date(2026, 9, 24, 10, 30));

  return (
    <div className="flex min-w-0 flex-col gap-5 pb-8">
      <div className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6 lg:grid-cols-[auto_1fr] lg:items-center lg:gap-6">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-border bg-muted sm:h-28 sm:w-28">
          <img
            src="/brand.svg"
            alt="BrainPulses brand mark"
            className="h-20 w-20 rounded-xl sm:h-24 sm:w-24"
          />
        </div>
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
              Design system · v1.0
            </span>
            <span className="text-xs text-muted-foreground">
              Admin + Client · API remains the source of truth
            </span>
          </div>
          <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            One brand. One visual language.
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            BrainPulses is designed for clear assessments, reliable operations, and confident
            learning. This living reference uses the same semantic tokens and components as the
            product. Use the theme toggle in the application header to review both appearances.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PaletteIcon className="size-4 text-primary" /> Color foundations
          </CardTitle>
          <CardDescription>
            The supplied SVG establishes the identity: Royal Violet #45058F on white. Supporting
            shades are derived for accessible interfaces; semantic roles determine their use.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Brand scale</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 xl:grid-cols-10">
              {brandSwatches.map((color) => (
                <TokenSwatch key={color.token} {...color} />
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">
              Semantic colors · theme-aware
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
              {surfaceSwatches.map((color) => (
                <TokenSwatch key={color.token} {...color} />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Typography</CardTitle>
            <CardDescription>
              Plus Jakarta Sans for hierarchy; Source Sans 3 for fluent, readable UI.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-b border-border pb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Display · 30 / 38
              </p>
              <p className="font-heading mt-1 text-3xl font-bold tracking-tight">
                Make every answer count.
              </p>
            </div>
            <div className="border-b border-border pb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Section · 20 / 28
              </p>
              <p className="font-heading mt-1 text-xl font-semibold">Quiz performance overview</p>
            </div>
            <div className="border-b border-border pb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Body · 16 / 26
              </p>
              <p className="mt-1 text-base leading-relaxed">
                Participants can focus on the question while administrators focus on reliable
                results.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Label · 13 / 18
              </p>
              <p className="mt-1 text-sm font-semibold">Required field · One answer</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Components & interaction states</CardTitle>
            <CardDescription>
              44px touch targets, persistent labels, visible focus, and informative feedback.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={() => toast.info('Design system preview only — no changes were made.')}
              >
                <SparklesIcon /> Primary action
              </Button>
              <Button type="button" variant="secondary">
                Secondary
              </Button>
              <Button type="button" variant="outline">
                Outline
              </Button>
              <Button type="button" variant="ghost">
                Ghost
              </Button>
              <Button type="button" disabled>
                Disabled
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-semibold text-foreground">
                Assessment title
                <Input
                  defaultValue="Introduction to critical thinking"
                  placeholder="Enter a title"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-foreground">
                Read-only identifier
                <Input value="BP-DEMO-001" readOnly aria-readonly="true" />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone="ok" value="Completed" />
              <StatusPill tone="wn" value="In progress" />
              <StatusPill tone="er" value="Failed" />
              <StatusPill tone="gy" value="Draft" />
              <StatusPill tone="pr" value="Published" />
            </div>
            <label className="flex min-h-11 items-center justify-between gap-4 rounded-lg border border-border p-3">
              <span>
                <span className="block text-sm font-semibold text-foreground">
                  Email notifications
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Interactive example; does not change account settings
                </span>
              </span>
              <Switch
                checked={notifications}
                onCheckedChange={setNotifications}
                aria-label="Demo email notifications"
              />
            </label>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Date &amp; time picker</CardTitle>
          <CardDescription>
            Shared across Admin and Client. Uses the common 44px input height, semantic light/dark
            tokens, and scrollable 12-hour, 5-minute and AM/PM selection columns.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="max-w-md space-y-1.5">
            <label htmlFor="bp-picker-demo" className="block text-sm font-semibold text-foreground">
              Assessment start
            </label>
            <DateTimePicker
              id="bp-picker-demo"
              value={demoSchedule}
              onChange={setDemoSchedule}
              onClear={() => setDemoSchedule(null)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Open the field to choose the date and time. Apply commits changes; Cancel leaves the
            original value unchanged.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CircleHelpIcon className="size-4 text-primary" /> Question interaction pattern
          </CardTitle>
          <CardDescription>
            Selection must remain obvious without relying on color alone. This is a visual
            prototype, not a real test.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_240px]">
            <fieldset className="min-w-0 space-y-3">
              <legend className="mb-3 font-heading text-base font-semibold">
                Which architecture keeps BrainPulses business rules consistent?
              </legend>
              {sampleOptions.map((option, index) => {
                const isSelected = selected === index;
                return (
                  <label
                    key={option}
                    className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${isSelected ? 'border-primary bg-accent/60' : 'border-border hover:bg-muted/60'}`}
                  >
                    <input
                      type="radio"
                      name="preview-question"
                      className="mt-1 size-4 accent-[var(--primary)]"
                      checked={isSelected}
                      onChange={() => setSelected(index)}
                    />
                    <span className="min-w-0 flex-1 text-sm leading-relaxed text-foreground">
                      {option}
                    </span>
                    {isSelected ? (
                      <CheckIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                    ) : null}
                  </label>
                );
              })}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <p aria-live="polite" className="text-sm text-muted-foreground">
                  {selected === null ? 'No option selected' : 'One option selected'} · Demo only
                </p>
                <Button
                  type="button"
                  onClick={() => toast.info('Demo preview: answers are not submitted to the API.')}
                >
                  Preview submit <CheckIcon />
                </Button>
              </div>
            </fieldset>
            <aside className="rounded-lg border border-border bg-muted/40 p-4">
              <ShieldCheckIcon className="mb-2 size-5 text-primary" />
              <h3 className="font-heading text-base font-semibold">Assessment UX contract</h3>
              <ul className="mt-3 list-inside list-disc space-y-2 text-sm leading-relaxed text-muted-foreground">
                <li>Show a clear progress indicator and time state.</li>
                <li>Preserve answers during navigation.</li>
                <li>Flag items for review without deleting responses.</li>
                <li>Confirm final submission.</li>
                <li>Use the API to validate and score attempts.</li>
              </ul>
            </aside>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Layout rules & ownership</CardTitle>
          <CardDescription>
            Apply the system incrementally to existing screens; never rebuild a working workflow
            just to change colors.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: '4px rhythm',
                body: 'Spacing: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64',
              },
              {
                title: '44px controls',
                body: 'Minimum interactive height and comfortable keyboard focus.',
              },
              {
                title: '12px cards',
                body: 'Quiet, flat surfaces with 1px borders and restrained elevation.',
              },
              {
                title: 'Three apps',
                body: 'API = business rules. Admin = operations. Client = participant journeys.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="min-w-0 rounded-lg border border-border bg-muted/30 p-4"
              >
                <h3 className="font-heading text-sm font-semibold">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
