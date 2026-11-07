import { useState } from 'react';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FIELD_TYPES, type FieldType, type FormField, newId } from '@/lib/contest-form';

const TYPE_LABEL: Record<FieldType, string> = {
  text: 'Text',
  number: 'Number',
  email: 'Email',
  phone: 'Phone',
  textarea: 'Textarea',
  dropdown: 'Dropdown',
  multi_select: 'Multi-select',
  consent: 'Terms & Conditions',
};

export function ContestFormFields({
  fields,
  registeredCount,
  issues,
  onChange,
}: {
  fields: FormField[];
  registeredCount: number;
  issues: Record<string, string>;
  onChange: (fields: FormField[]) => void;
}) {
  const visible = fields.filter((field) => !field.deleted);
  const extra = visible.filter((field) => !field.locked);
  const deletedLocked = fields.filter((field) => field.locked && field.deleted);

  function update(id: string, patch: Partial<FormField>) {
    onChange(fields.map((field) => (field.id === id ? { ...field, ...patch } : field)));
  }

  function remove(id: string) {
    const field = fields.find((item) => item.id === id);
    if (!field || (field.locked && field.key === 'email')) return;
    if (field.locked) {
      onChange(fields.map((item) => (item.id === id ? { ...item, deleted: true } : item)));
      return;
    }
    onChange(fields.filter((item) => item.id !== id));
  }

  function move(id: string, direction: -1 | 1) {
    const custom = fields.filter((field) => !field.locked);
    const index = custom.findIndex((field) => field.id === id);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= custom.length) return;
    const reordered = [...custom];
    const [item] = reordered.splice(index, 1);
    reordered.splice(next, 0, item!);
    onChange([...fields.filter((field) => field.locked), ...reordered]);
  }

  return (
    <div className="flex flex-col gap-4">
      {registeredCount > 0 ? (
        <p className="rounded-lg border border-border bg-muted px-3 py-2 text-sm">
          {registeredCount === 1
            ? '1 person has already registered. Changes apply to new registrations only.'
            : `${registeredCount} people have already registered. Changes apply to new registrations only.`}
        </p>
      ) : null}
      {deletedLocked.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {deletedLocked.map((field) => (
            <Button
              key={field.id}
              type="button"
              variant="outline"
              onClick={() => update(field.id, { deleted: false })}
            >
              Restore {field.label || field.key}
            </Button>
          ))}
        </div>
      ) : null}
      <div className="flex flex-col gap-3">
        {visible
          .filter((field) => field.locked)
          .map((field) => (
            <FieldRow
              key={field.id}
              field={field}
              editable
              issue={issues[field.id]}
              onChange={(patch) => update(field.id, patch)}
              onDelete={() => remove(field.id)}
            />
          ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Your fields
        </p>
        <p className="text-sm text-muted-foreground">{extra.length} of 20 extra fields</p>
      </div>
      <div className="flex flex-col gap-3">
        {extra.map((field) => (
          <FieldRow
            key={field.id}
            field={field}
            editable
            issue={issues[field.id]}
            onChange={(patch) => update(field.id, patch)}
            onDelete={() => remove(field.id)}
            onMove={(direction) => move(field.id, direction)}
          />
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={extra.length >= 20}
        onClick={() =>
          onChange([
            ...fields,
            {
              id: newId(),
              key: newId(),
              locked: false,
              label: 'Untitled field',
              type: 'text',
              required: false,
              maxCharacters: 100,
            },
          ])
        }
      >
        <PlusIcon />
        Add field
      </Button>
    </div>
  );
}

function FieldRow({
  field,
  editable,
  issue,
  onChange,
  onDelete,
  onMove,
}: {
  field: FormField;
  editable: boolean;
  issue?: string;
  onChange: (patch: Partial<FormField>) => void;
  onDelete: () => void;
  onMove?: (direction: -1 | 1) => void;
}) {
  const [open, setOpen] = useState(false);
  const lockedType = field.locked;
  const emailLocked = field.locked && field.key === 'email';

  return (
    <div className="rounded-lg border border-border p-3" data-field={field.id}>
      <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-2 xl:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_auto_auto]">
        {onMove ? (
          <div className="flex gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={`Move ${field.label} up`}
              onClick={() => onMove(-1)}
            >
              ↑
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={`Move ${field.label} down`}
              onClick={() => onMove(1)}
            >
              ↓
            </Button>
          </div>
        ) : null}
        <div>
          <Label htmlFor={`${field.id}-label`}>Label</Label>
          <Input
            id={`${field.id}-label`}
            className="mt-1"
            value={field.label}
            readOnly={!editable}
            aria-invalid={Boolean(issue) || undefined}
            onChange={(event) => onChange({ label: event.target.value })}
          />
        </div>
        <div>
          <Label htmlFor={`${field.id}-type`}>Type</Label>
          <Select
            value={field.type}
            disabled={!editable || lockedType}
            onValueChange={(value) => onChange({ type: value as FieldType })}
          >
            <SelectTrigger id={`${field.id}-type`} className="mt-1 w-full" aria-label="Type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {TYPE_LABEL[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="mb-2 flex items-center gap-2 text-sm">
          <Checkbox
            checked={field.required}
            disabled={!editable || emailLocked}
            onCheckedChange={(checked) => onChange({ required: checked === true })}
          />
          Required
        </label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
          >
            More settings
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Delete ${field.label}`}
            disabled={!editable || emailLocked}
            onClick={onDelete}
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>
      {issue ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {issue}
        </p>
      ) : null}
      {open ? <MoreSettings field={field} editable={editable} onChange={onChange} /> : null}
    </div>
  );
}

function MoreSettings({
  field,
  editable,
  onChange,
}: {
  field: FormField;
  editable: boolean;
  onChange: (patch: Partial<FormField>) => void;
}) {
  if (field.type === 'dropdown' || field.type === 'multi_select') {
    return (
      <OptionTags
        options={field.options ?? []}
        disabled={!editable}
        onChange={(options) => onChange({ options })}
      />
    );
  }
  if (field.type === 'consent') {
    return (
      <div className="mt-3 grid gap-3">
        <div>
          <Label htmlFor={`${field.id}-consent`}>Consent text</Label>
          <Textarea
            id={`${field.id}-consent`}
            className="mt-1"
            maxLength={300}
            value={field.consentText ?? ''}
            readOnly={!editable}
            onChange={(event) => onChange({ consentText: event.target.value })}
          />
        </div>
        <div>
          <Label htmlFor={`${field.id}-terms`}>Link to full terms</Label>
          <Input
            id={`${field.id}-terms`}
            className="mt-1"
            value={field.termsLink ?? ''}
            readOnly={!editable}
            onChange={(event) => onChange({ termsLink: event.target.value })}
          />
        </div>
      </div>
    );
  }
  return (
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      <div>
        <Label htmlFor={`${field.id}-placeholder`}>Placeholder</Label>
        <Input
          id={`${field.id}-placeholder`}
          className="mt-1"
          value={field.placeholder ?? ''}
          readOnly={!editable}
          onChange={(event) => onChange({ placeholder: event.target.value })}
        />
      </div>
      <div>
        <Label htmlFor={`${field.id}-help`}>Help text</Label>
        <Input
          id={`${field.id}-help`}
          className="mt-1"
          value={field.help ?? ''}
          readOnly={!editable}
          onChange={(event) => onChange({ help: event.target.value })}
        />
      </div>
      {field.type === 'text' || field.type === 'textarea' ? (
        <div>
          <Label htmlFor={`${field.id}-max`}>Max characters</Label>
          <Input
            id={`${field.id}-max`}
            className="mt-1"
            type="number"
            value={field.maxCharacters ?? ''}
            readOnly={!editable}
            onChange={(event) =>
              onChange({ maxCharacters: event.target.value ? Number(event.target.value) : null })
            }
          />
        </div>
      ) : null}
      {field.type === 'number' ? (
        <>
          <div>
            <Label htmlFor={`${field.id}-min`}>Min value</Label>
            <Input
              id={`${field.id}-min`}
              className="mt-1"
              type="number"
              value={field.minValue ?? ''}
              readOnly={!editable}
              onChange={(event) =>
                onChange({
                  minValue: event.target.value === '' ? null : Number(event.target.value),
                })
              }
            />
          </div>
          <div>
            <Label htmlFor={`${field.id}-max-value`}>Max value</Label>
            <Input
              id={`${field.id}-max-value`}
              className="mt-1"
              type="number"
              value={field.maxValue ?? ''}
              readOnly={!editable}
              onChange={(event) =>
                onChange({
                  maxValue: event.target.value === '' ? null : Number(event.target.value),
                })
              }
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function OptionTags({
  options,
  disabled,
  onChange,
}: {
  options: string[];
  disabled: boolean;
  onChange: (options: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState('');

  function add(raw: string) {
    const parts = raw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    const next = [...options];
    for (const part of parts) {
      if (next.some((option) => option.toLowerCase() === part.toLowerCase())) {
        setNote(`"${part}" is already an option`);
        continue;
      }
      next.push(part);
      setNote('');
    }
    onChange(next);
    setDraft('');
  }

  return (
    <div className="mt-3">
      <Label htmlFor="option-draft">Options</Label>
      <div className="mt-1 flex flex-wrap gap-2">
        {options.map((option) => (
          <span
            key={option}
            className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-1 text-sm"
          >
            {option}
            <button
              type="button"
              aria-label={`Remove ${option}`}
              disabled={disabled}
              onClick={() => onChange(options.filter((item) => item !== option))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <Input
        id="option-draft"
        className="mt-2"
        value={draft}
        disabled={disabled}
        placeholder="Type an option and press Enter"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            add(draft);
          }
          if (event.key === 'Backspace' && !draft && options.length) {
            onChange(options.slice(0, -1));
          }
        }}
      />
      {note ? <p className="mt-1 text-sm text-muted-foreground">{note}</p> : null}
    </div>
  );
}
