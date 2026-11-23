import { MousePointerClickIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  FIELD_TYPES,
  FIELD_TYPE_LABEL,
  patchField,
  type FieldType,
  type FormField,
} from '@/lib/contest-form';

export function ContestFormFieldSettings({
  field,
  issue,
  onChange,
}: {
  field: FormField | null;
  issue?: string;
  onChange: (next: FormField) => void;
}) {
  if (!field) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border px-4 py-6">
        <MousePointerClickIcon className="text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">No field selected</p>
        <p className="text-sm text-muted-foreground">
          Choose a field on the form to edit its label, type, and rules.
        </p>
      </div>
    );
  }

  const emailLocked = field.locked && field.key === 'email';
  const showPlaceholder = field.type !== 'consent';

  function update(patch: Partial<FormField>) {
    onChange(patchField(field!, patch));
  }

  return (
    <div className="flex flex-col gap-4" data-field={field.id}>
      <div>
        <Label htmlFor="field-label">
          Label <span className="text-destructive">*</span>
        </Label>
        <Input
          id="field-label"
          className="mt-1"
          value={field.label}
          aria-invalid={Boolean(issue) || undefined}
          onChange={(event) => update({ label: event.target.value })}
        />
        {issue ? (
          <p className="mt-1 text-sm text-destructive" role="alert">
            {issue}
          </p>
        ) : null}
      </div>
      <div>
        <Label htmlFor="field-type">Type</Label>
        <Select
          value={field.type}
          disabled={field.locked}
          onValueChange={(value) => update({ type: value as FieldType })}
        >
          <SelectTrigger id="field-type" className="mt-1 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELD_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {FIELD_TYPE_LABEL[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex min-h-(--control-h) items-center justify-between gap-3">
        <Label htmlFor="field-required">Required field</Label>
        <Switch
          id="field-required"
          checked={field.required}
          disabled={emailLocked}
          onCheckedChange={(checked) => update({ required: checked === true })}
        />
      </div>
      {showPlaceholder ? (
        <>
          <div>
            <Label htmlFor="field-placeholder">Placeholder</Label>
            <Input
              id="field-placeholder"
              className="mt-1"
              value={field.placeholder ?? ''}
              onChange={(event) => update({ placeholder: event.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="field-help">Helper text</Label>
            <Input
              id="field-help"
              className="mt-1"
              value={field.help ?? ''}
              placeholder="Add a short hint for this field (optional)"
              onChange={(event) => update({ help: event.target.value })}
            />
          </div>
        </>
      ) : null}
      {field.type === 'text' || field.type === 'textarea' ? (
        <div>
          <Label htmlFor="field-max">Max characters</Label>
          <Input
            id="field-max"
            className="mt-1"
            inputMode="numeric"
            value={field.maxCharacters ?? ''}
            onChange={(event) =>
              update({ maxCharacters: event.target.value ? Number(event.target.value) : null })
            }
          />
        </div>
      ) : null}
      {field.type === 'number' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="field-min">Min value</Label>
            <Input
              id="field-min"
              className="mt-1"
              inputMode="decimal"
              value={field.minValue ?? ''}
              onChange={(event) =>
                update({ minValue: event.target.value === '' ? null : Number(event.target.value) })
              }
            />
          </div>
          <div>
            <Label htmlFor="field-max-value">Max value</Label>
            <Input
              id="field-max-value"
              className="mt-1"
              inputMode="decimal"
              value={field.maxValue ?? ''}
              onChange={(event) =>
                update({ maxValue: event.target.value === '' ? null : Number(event.target.value) })
              }
            />
          </div>
        </div>
      ) : null}
      {field.type === 'dropdown' || field.type === 'multi_select' ? (
        <OptionList options={field.options ?? []} onChange={(options) => update({ options })} />
      ) : null}
      {field.type === 'consent' ? (
        <div className="flex flex-col gap-3">
          <div>
            <Label htmlFor="field-consent">Consent text</Label>
            <Textarea
              id="field-consent"
              className="mt-1"
              maxLength={300}
              value={field.consentText ?? ''}
              onChange={(event) => update({ consentText: event.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="field-terms">Link to full terms</Label>
            <Input
              id="field-terms"
              className="mt-1"
              value={field.termsLink ?? ''}
              onChange={(event) => update({ termsLink: event.target.value })}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function OptionList({
  options,
  onChange,
}: {
  options: string[];
  onChange: (options: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>
        Options <span className="text-destructive">*</span>
      </Label>
      {options.map((option, index) => (
        <div key={`${index}-${options.length}`} className="flex gap-2">
          <Input
            aria-label={`Option ${index + 1}`}
            value={option}
            onChange={(event) =>
              onChange(
                options.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)),
              )
            }
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Remove option ${index + 1}`}
            onClick={() => onChange(options.filter((_, itemIndex) => itemIndex !== index))}
          >
            <Trash2Icon />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() => onChange([...options, `Option ${options.length + 1}`])}
      >
        Add option
      </Button>
    </div>
  );
}
