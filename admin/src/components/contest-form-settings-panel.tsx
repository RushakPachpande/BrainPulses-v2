import { DateTimePicker } from '@/components/date-time-picker';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatIst, type ContestFormRecord } from '@/lib/contest-form';

export type FormSettings = Pick<
  ContestFormRecord,
  | 'opensAt'
  | 'closesAt'
  | 'seats'
  | 'welcomeMessage'
  | 'showContestImage'
  | 'showSponsorName'
  | 'showRegistrationCloses'
  | 'showSeatsLeft'
>;

/** Form Settings tab: registration window, seats, welcome message, and what the header shows. */
export function ContestFormSettingsPanel({
  value,
  issues,
  onChange,
}: {
  value: FormSettings;
  issues: Record<string, string>;
  onChange: (patch: Partial<FormSettings>) => void;
}) {
  const welcome = value.welcomeMessage ?? '';
  return (
    <div className="flex flex-col gap-4">
      <div data-field="opensAt">
        <Label htmlFor="opens">
          Registration opens <span className="text-destructive">*</span>
        </Label>
        <DateTimePicker
          id="opens"
          value={value.opensAt ? new Date(value.opensAt) : null}
          onChange={(date) => onChange({ opensAt: date.toISOString() })}
          required
          ariaLabel="Registration opens"
        />
        <Issue text={issues.opensAt} />
      </div>
      <div data-field="closesAt">
        <Label htmlFor="closes">
          Registration closes <span className="text-destructive">*</span>
        </Label>
        <DateTimePicker
          id="closes"
          value={value.closesAt ? new Date(value.closesAt) : null}
          onChange={(date) => onChange({ closesAt: date.toISOString() })}
          required
          ariaLabel="Registration closes"
        />
        <p className="mt-1 text-sm text-muted-foreground">
          You're warned in Step 2 if a quiz ends before this.
        </p>
        <Issue text={issues.closesAt} />
      </div>
      <div data-field="seats">
        <Label htmlFor="seats">Number of seats</Label>
        <Input
          id="seats"
          className="mt-1"
          inputMode="numeric"
          value={value.seats ?? ''}
          placeholder="Unlimited"
          aria-invalid={Boolean(issues.seats) || undefined}
          onChange={(event) =>
            onChange({ seats: event.target.value === '' ? null : Number(event.target.value) })
          }
        />
        <p className="mt-1 text-sm text-muted-foreground">
          Leave empty for unlimited registrations while the form is open.
        </p>
        <Issue text={issues.seats} />
      </div>
      <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
        Open from {value.opensAt ? formatIst(value.opensAt) : '…'} to{' '}
        {value.closesAt ? formatIst(value.closesAt) : '…'} ·{' '}
        {value.seats == null ? 'Unlimited seats' : `${value.seats} seats`}
      </p>
      <div>
        <Label htmlFor="welcome">Welcome message</Label>
        <Textarea
          id="welcome"
          className="mt-1"
          maxLength={300}
          value={welcome}
          onChange={(event) => onChange({ welcomeMessage: event.target.value })}
        />
        <p className="mt-1 text-sm text-muted-foreground">{welcome.length} / 300 characters</p>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Show on the form</legend>
        <Chip
          checked={value.showContestImage}
          label="Contest image"
          onChange={(checked) => onChange({ showContestImage: checked })}
        />
        <Chip
          checked={value.showSponsorName}
          label="Sponsor name"
          onChange={(checked) => onChange({ showSponsorName: checked })}
        />
        <Chip
          checked={value.showRegistrationCloses}
          label="Registration closes"
          onChange={(checked) => onChange({ showRegistrationCloses: checked })}
        />
        <Chip
          checked={value.showSeatsLeft && value.seats != null}
          disabled={value.seats == null}
          label={value.seats == null ? 'Seats left (no limit set)' : 'Seats left'}
          onChange={(checked) => onChange({ showSeatsLeft: checked })}
        />
        <p className="text-sm text-muted-foreground">
          The contest name is always the heading. The image and sponsor come from the contest.
        </p>
      </fieldset>
    </div>
  );
}

function Issue({ text }: { text?: string }) {
  return text ? (
    <p className="mt-1 text-sm text-destructive" role="alert">
      {text}
    </p>
  ) : null;
}

function Chip({
  checked,
  label,
  disabled,
  onChange,
}: {
  checked: boolean;
  label: string;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm ${disabled ? 'opacity-50' : ''}`}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(next) => onChange(next === true)}
      />
      {label}
    </label>
  );
}
