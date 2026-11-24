import { ImageIcon } from 'lucide-react';
import { AuthImage } from '@/components/auth-image';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { FormField } from '@/lib/contest-form';

/**
 * One field as participants see it. Used by the admin preview and by "Add registration".
 * Choice answers are option IDs; the option label is what people see.
 */
export function ContestFormFieldInput({
  field,
  value,
  error,
  disabled,
  idPrefix = 'field',
  onChange,
}: {
  field: FormField;
  value: string | string[] | boolean | undefined;
  error?: string;
  disabled?: boolean;
  idPrefix?: string;
  onChange: (value: string | string[] | boolean) => void;
}) {
  const id = `${idPrefix}-${field.id}`;
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;
  const describedBy =
    [field.help ? helpId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  const invalid = Boolean(error);
  const options = field.options ?? [];

  if (field.type === 'heading') {
    return <h3 className="pt-2 text-base font-semibold">{field.label}</h3>;
  }
  if (field.type === 'description') {
    return <p className="text-sm whitespace-pre-line text-muted-foreground">{field.text}</p>;
  }
  if (field.type === 'divider') {
    return <hr className="border-border" />;
  }
  if (field.type === 'image') {
    return field.imageFileId ? (
      <AuthImage
        fileId={field.imageFileId}
        alt={field.imageAlt ?? ''}
        className="max-h-64 w-full rounded-lg object-contain"
      />
    ) : (
      <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
        <ImageIcon aria-hidden />
        <span className="sr-only">Image not chosen yet</span>
      </div>
    );
  }

  const label = (
    <>
      {field.label}
      {field.required ? <span className="text-destructive"> *</span> : null}
    </>
  );
  const help = field.help ? (
    <p id={helpId} className="text-xs text-muted-foreground">
      {field.help}
    </p>
  ) : null;

  let control: React.ReactNode;
  if (field.type === 'consent') {
    control = (
      <label className="flex items-start gap-2 text-sm" htmlFor={id}>
        <Checkbox
          id={id}
          checked={value === true}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
        <span>
          {field.consentText || field.label}
          {field.required ? <span className="text-destructive"> *</span> : null}
          {field.termsLink ? (
            <>
              {' '}
              <a href={field.termsLink} className="underline" target="_blank" rel="noreferrer">
                Full terms
              </a>
            </>
          ) : null}
        </span>
      </label>
    );
    return (
      <div>
        {control}
        <ErrorText id={errorId} error={error} />
      </div>
    );
  }

  if (field.type === 'multi_select' || field.type === 'checkboxes') {
    const picked = Array.isArray(value) ? value : [];
    return (
      <fieldset className="flex flex-col gap-1" aria-describedby={describedBy}>
        <legend className="text-sm font-medium">{label}</legend>
        {help}
        {options.map((option) => (
          <label key={option.id} className="flex min-h-11 items-center gap-2 text-sm">
            <Checkbox
              checked={picked.includes(option.id)}
              disabled={disabled}
              aria-invalid={invalid || undefined}
              onCheckedChange={(checked) =>
                onChange(
                  checked === true
                    ? [...picked, option.id]
                    : picked.filter((item) => item !== option.id),
                )
              }
            />
            {option.label}
          </label>
        ))}
        <ErrorText id={errorId} error={error} />
      </fieldset>
    );
  }

  if (field.type === 'radio') {
    return (
      <fieldset className="flex flex-col gap-1" aria-describedby={describedBy}>
        <legend className="text-sm font-medium">{label}</legend>
        {help}
        <RadioGroup
          value={typeof value === 'string' ? value : ''}
          disabled={disabled}
          onValueChange={(next) => onChange(next)}
          className="gap-0"
        >
          {options.map((option) => (
            <label key={option.id} className="flex min-h-11 items-center gap-2 text-sm">
              <RadioGroupItem value={option.id} aria-invalid={invalid || undefined} />
              {option.label}
            </label>
          ))}
        </RadioGroup>
        <ErrorText id={errorId} error={error} />
      </fieldset>
    );
  }

  if (field.type === 'textarea') {
    control = (
      <Textarea
        id={id}
        className="mt-1"
        value={typeof value === 'string' ? value : ''}
        placeholder={field.placeholder}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  } else if (field.type === 'dropdown') {
    control = (
      <Select
        value={typeof value === 'string' && value ? value : undefined}
        onValueChange={(next) => onChange(next)}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          className="mt-1 w-full"
          aria-label={field.label}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        >
          <SelectValue placeholder={field.placeholder || 'Choose'} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  } else if (field.type === 'phone') {
    control = (
      <div className="mt-1 flex">
        <span className="inline-flex items-center rounded-l-[9px] border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
          +91
        </span>
        <Input
          id={id}
          className="rounded-l-none"
          type="tel"
          value={typeof value === 'string' ? value : ''}
          placeholder={field.placeholder || '10-digit mobile number'}
          disabled={disabled}
          maxLength={10}
          autoComplete="tel-national"
          inputMode="numeric"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
        />
      </div>
    );
  } else {
    control = (
      <Input
        id={id}
        className="mt-1"
        type={inputType(field)}
        value={typeof value === 'string' ? value : ''}
        placeholder={field.type === 'date' || field.type === 'time' ? undefined : field.placeholder}
        disabled={disabled}
        autoComplete={autoCompleteFor(field)}
        inputMode={field.type === 'number' ? 'numeric' : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <div>
      <label className="text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      {help}
      {control}
      <ErrorText id={errorId} error={error} />
    </div>
  );
}

function ErrorText({ id, error }: { id: string; error?: string }) {
  return error ? (
    <p id={id} className="mt-1 text-sm text-destructive" role="alert">
      {error}
    </p>
  ) : null;
}

function inputType(field: FormField) {
  if (field.type === 'number') return 'number';
  if (field.type === 'email') return 'email';
  if (field.type === 'date') return 'date';
  if (field.type === 'time') return 'time';
  return 'text';
}

function autoCompleteFor(field: FormField) {
  if (field.key === 'first_name') return 'given-name';
  if (field.key === 'last_name') return 'family-name';
  if (field.type === 'email' || field.key === 'email') return 'email';
  return undefined;
}
