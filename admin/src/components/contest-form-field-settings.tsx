import { useState } from 'react';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  InfoIcon,
  LockIcon,
  MousePointerClickIcon,
  PlusIcon,
  Trash2Icon,
  TriangleAlertIcon,
  UnlockIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { CatalogImageField } from '@/components/catalog-image-field';
import { ToggleRow } from '@/components/toggle-row';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api-client';
import {
  CORE_FIELDS,
  FIELD_TYPE_LABEL,
  isChoiceType,
  isMultiChoiceType,
  newOption,
  patchField,
  rulesUsing,
  type AssignmentRule,
  type FieldOption,
  type FormField,
} from '@/lib/contest-form';
import { uploadCatalogImage } from '@/services';

export function ContestFormFieldSettings({
  field,
  issue,
  rules,
  coreUnlocked,
  dirty,
  canMoveUp,
  canMoveDown,
  onChange,
  onSave,
  onCancel,
  onUnlock,
  onMove,
  onDuplicate,
  onDelete,
}: {
  field: FormField | null;
  issue?: string;
  rules: AssignmentRule[];
  coreUnlocked: boolean;
  dirty: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (next: FormField) => void;
  onSave: () => void;
  onCancel: () => void;
  onUnlock: () => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [uploading, setUploading] = useState(false);

  if (!field) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border px-4 py-6">
        <MousePointerClickIcon className="text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">No field selected</p>
        <p className="text-sm text-muted-foreground">
          Select a field on the form to change its settings.
        </p>
      </div>
    );
  }

  const core = field.locked ? CORE_FIELDS[field.key] : undefined;
  if (core && !coreUnlocked) {
    return (
      <div className="flex flex-col gap-3" data-field={field.id}>
        <h3 className="font-semibold">{field.label}</h3>
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/50 p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <LockIcon className="size-4" aria-hidden />
            Locked contact field
          </p>
          <p className="text-sm text-muted-foreground">
            First name, Last name, Email and Mobile are used to match returning participants and to
            send their Registration ID. Unlock them with your admin password to change their labels,
            or to make Last name or Mobile optional.
          </p>
          <Button type="button" variant="outline" className="self-start" onClick={onUnlock}>
            <UnlockIcon data-icon="inline-start" />
            Unlock with admin password
          </Button>
        </div>
      </div>
    );
  }

  const usedBy = isChoiceType(field.type) ? rulesUsing(rules, field.id) : [];
  const answerField = !['heading', 'description', 'image', 'divider'].includes(field.type);
  const showPlaceholder =
    answerField && !['consent', 'radio', 'checkboxes', 'date', 'time'].includes(field.type);

  function update(patch: Partial<FormField>) {
    onChange(patchField(field!, patch));
  }

  async function onImage(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      update({ imageFileId: await uploadCatalogImage(file) });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not upload that image.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4" data-field={field.id}>
      <h3 className="font-semibold">{core ? core.label : FIELD_TYPE_LABEL[field.type]}</h3>

      {field.type === 'heading' ? (
        <TextInput
          id="field-label"
          label="Heading text"
          required
          value={field.label}
          invalid={Boolean(issue)}
          onChange={(label) => update({ label })}
        />
      ) : null}
      {field.type === 'description' ? (
        <div>
          <Label htmlFor="field-text">
            Text <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="field-text"
            className="mt-1"
            maxLength={1000}
            value={field.text ?? ''}
            aria-invalid={Boolean(issue) || undefined}
            onChange={(event) => update({ text: event.target.value })}
          />
        </div>
      ) : null}
      {field.type === 'image' ? (
        <>
          <CatalogImageField
            id="field-image"
            label="Image"
            fileId={field.imageFileId ?? ''}
            alt={field.imageAlt ?? ''}
            disabled={uploading}
            required
            compact
            onFile={(file) => void onImage(file)}
            onPickExisting={(fileId) => update({ imageFileId: fileId })}
            onClear={() => update({ imageFileId: null })}
          />
          <TextInput
            id="field-alt"
            label="Alt text"
            value={field.imageAlt ?? ''}
            placeholder="Describe the image for screen readers"
            onChange={(imageAlt) => update({ imageAlt })}
          />
        </>
      ) : null}
      {field.type === 'divider' ? (
        <p className="text-sm text-muted-foreground">
          A line that separates sections of the form. No settings.
        </p>
      ) : null}

      {answerField ? (
        <>
          <TextInput
            id="field-label"
            label="Label"
            required
            value={field.label}
            invalid={Boolean(issue)}
            onChange={(label) => update({ label })}
          />
          <TextInput
            id="field-help"
            label="Helper text"
            value={field.help ?? ''}
            placeholder="A short hint under the field (optional)"
            onChange={(help) => update({ help })}
          />
          {showPlaceholder ? (
            <TextInput
              id="field-placeholder"
              label="Placeholder"
              value={field.placeholder ?? ''}
              placeholder="Text shown inside the empty field"
              onChange={(placeholder) => update({ placeholder })}
            />
          ) : null}
          {field.type === 'consent' ? (
            <>
              <div>
                <Label htmlFor="field-consent">Agreement text</Label>
                <Textarea
                  id="field-consent"
                  className="mt-1"
                  maxLength={300}
                  value={field.consentText ?? ''}
                  onChange={(event) => update({ consentText: event.target.value })}
                />
              </div>
              <TextInput
                id="field-terms"
                label="Link to full terms"
                value={field.termsLink ?? ''}
                placeholder="https://… (optional)"
                onChange={(termsLink) => update({ termsLink })}
              />
            </>
          ) : null}
          <ToggleRow
            label="Required field"
            hint={core?.alwaysRequired ? `${core.label} is always required.` : undefined}
            checked={field.required}
            disabled={Boolean(core?.alwaysRequired)}
            onCheckedChange={(required) => update({ required })}
          />
          {core ? (
            <p className="text-sm text-muted-foreground">The field type can't change.</p>
          ) : null}
          {field.type === 'text' || field.type === 'textarea' ? (
            <NumberInput
              id="field-max"
              label="Max characters"
              value={field.maxCharacters}
              onChange={(maxCharacters) => update({ maxCharacters })}
            />
          ) : null}
          {field.type === 'number' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberInput
                id="field-min"
                label="Min value"
                value={field.minValue}
                onChange={(minValue) => update({ minValue })}
              />
              <NumberInput
                id="field-max-value"
                label="Max value"
                value={field.maxValue}
                onChange={(maxValue) => update({ maxValue })}
              />
            </div>
          ) : null}
          {isMultiChoiceType(field.type) ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberInput
                id="field-min-sel"
                label="Min selections"
                value={field.minSelections}
                onChange={(minSelections) => update({ minSelections })}
              />
              <NumberInput
                id="field-max-sel"
                label="Max selections"
                value={field.maxSelections}
                onChange={(maxSelections) => update({ maxSelections })}
              />
            </div>
          ) : null}
        </>
      ) : null}

      {isChoiceType(field.type) ? (
        <OptionList field={field} rules={rules} onChange={(options) => update({ options })} />
      ) : null}
      {usedBy.length ? (
        <p className="flex gap-2 text-sm text-muted-foreground">
          <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          Used in Rule {usedBy.join(', ')} in Step 2. This field and the options a rule uses can't
          be deleted.
        </p>
      ) : isChoiceType(field.type) ? (
        <p className="text-sm text-muted-foreground">
          Choice fields can be used to give different quizzes in Step 2.
        </p>
      ) : null}

      {issue ? (
        <p className="text-sm text-destructive" role="alert">
          {issue}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        {!field.locked ? (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={!canMoveUp}
              onClick={() => onMove(-1)}
            >
              <ChevronUpIcon data-icon="inline-start" />
              Move up
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!canMoveDown}
              onClick={() => onMove(1)}
            >
              <ChevronDownIcon data-icon="inline-start" />
              Move down
            </Button>
            <Button type="button" variant="outline" onClick={onDuplicate}>
              <CopyIcon data-icon="inline-start" />
              Duplicate
            </Button>
          </>
        ) : null}
        {!field.locked || core?.canDelete ? (
          <Button
            type="button"
            variant="destructive"
            disabled={usedBy.length > 0}
            title={usedBy.length ? `Used in Rule ${usedBy.join(', ')}` : undefined}
            onClick={onDelete}
          >
            <Trash2Icon data-icon="inline-start" />
            {field.locked ? `Remove ${core?.label}` : 'Delete'}
          </Button>
        ) : null}
      </div>

      <div className="sticky bottom-0 flex flex-col gap-2 border-t border-border bg-card pt-3">
        {dirty ? (
          <p className="flex items-center gap-2 text-sm text-warning" role="status">
            <TriangleAlertIcon className="size-4" aria-hidden />
            Unsaved changes. The form shows them as a preview.
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={!dirty} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" className="flex-1" onClick={onSave}>
            Save field
          </Button>
        </div>
      </div>
    </div>
  );
}

function TextInput({
  id,
  label,
  value,
  required,
  invalid,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  required?: boolean;
  invalid?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Input
        id={id}
        className="mt-1"
        value={value}
        maxLength={200}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function NumberInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number | null | undefined;
  onChange: (value: number | null) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        className="mt-1"
        inputMode="decimal"
        value={value ?? ''}
        onChange={(event) =>
          onChange(event.target.value === '' ? null : Number(event.target.value))
        }
      />
    </div>
  );
}

function OptionList({
  field,
  rules,
  onChange,
}: {
  field: FormField;
  rules: AssignmentRule[];
  onChange: (options: FieldOption[]) => void;
}) {
  const options = field.options ?? [];
  function move(index: number, direction: -1 | 1) {
    const next = [...options];
    const [item] = next.splice(index, 1);
    next.splice(index + direction, 0, item!);
    onChange(next);
  }
  return (
    <div className="flex flex-col gap-2">
      <Label>
        Options <span className="text-destructive">*</span>
      </Label>
      {options.map((option, index) => {
        const used = rulesUsing(rules, field.id, option.id);
        return (
          <div key={option.id} className="flex items-center gap-1">
            <div className="flex flex-col">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label={`Move ${option.label || `option ${index + 1}`} up`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ChevronUpIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label={`Move ${option.label || `option ${index + 1}`} down`}
                disabled={index === options.length - 1}
                onClick={() => move(index, 1)}
              >
                <ChevronDownIcon />
              </Button>
            </div>
            <Input
              aria-label={`Option ${index + 1}`}
              value={option.label}
              maxLength={120}
              onChange={(event) =>
                onChange(
                  options.map((item) =>
                    item.id === option.id ? { ...item, label: event.target.value } : item,
                  ),
                )
              }
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={
                used.length
                  ? `Option ${index + 1} is used in Rule ${used.join(', ')} and can't be deleted`
                  : `Delete option ${index + 1}`
              }
              title={used.length ? `Used in Rule ${used.join(', ')}` : 'Delete'}
              disabled={used.length > 0}
              onClick={() => onChange(options.filter((item) => item.id !== option.id))}
            >
              <Trash2Icon />
            </Button>
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        className="border-dashed"
        onClick={() => onChange([...options, newOption(`Option ${options.length + 1}`)])}
      >
        <PlusIcon data-icon="inline-start" />
        Add option
      </Button>
    </div>
  );
}
