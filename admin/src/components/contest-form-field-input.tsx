import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { FormField } from '@/lib/contest-form';

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

  return (
    <div>
      {field.type === 'consent' ? (
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
                <a href={field.termsLink} className="underline">
                  Full terms
                </a>
              </>
            ) : null}
          </span>
        </label>
      ) : field.type === 'multi_select' ? (
        <fieldset className="flex flex-col gap-1" aria-describedby={describedBy}>
          <legend className="text-sm font-medium">
            {field.label}
            {field.required ? <span className="text-destructive"> *</span> : null}
          </legend>
          {field.help ? (
            <p id={helpId} className="text-xs text-muted-foreground">
              {field.help}
            </p>
          ) : null}
          {(field.options ?? []).map((option) => {
            const picked = Array.isArray(value) ? value : [];
            return (
              <label key={option} className="flex min-h-11 items-center gap-2 text-sm">
                <Checkbox
                  checked={picked.includes(option)}
                  disabled={disabled}
                  aria-invalid={invalid || undefined}
                  onCheckedChange={(checked) =>
                    onChange(
                      checked === true
                        ? [...picked, option]
                        : picked.filter((item) => item !== option),
                    )
                  }
                />
                {option}
              </label>
            );
          })}
        </fieldset>
      ) : (
        <>
          <label className="text-sm font-medium" htmlFor={id}>
            {field.label}
            {field.required ? <span className="text-destructive"> *</span> : null}
          </label>
          {field.help ? (
            <p id={helpId} className="text-xs text-muted-foreground">
              {field.help}
            </p>
          ) : null}
          {field.type === 'textarea' ? (
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
          ) : field.type === 'dropdown' ? (
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
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                {(field.options ?? []).map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id={id}
              className="mt-1"
              type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : 'text'}
              value={typeof value === 'string' ? value : ''}
              placeholder={field.type === 'phone' ? '10-digit mobile number' : field.placeholder}
              disabled={disabled}
              autoComplete={autoCompleteFor(field)}
              inputMode={field.type === 'phone' || field.type === 'number' ? 'numeric' : undefined}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
              onChange={(event) => onChange(event.target.value)}
            />
          )}
        </>
      )}
      {error ? (
        <p id={errorId} className="mt-1 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function autoCompleteFor(field: FormField) {
  if (field.key === 'first_name') return 'given-name';
  if (field.key === 'last_name') return 'family-name';
  if (field.type === 'email' || field.key === 'email') return 'email';
  if (field.type === 'phone' || field.key === 'mobile') return 'tel';
  return undefined;
}
