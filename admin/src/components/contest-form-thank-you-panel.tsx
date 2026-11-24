import { useState } from 'react';
import { ImageIcon, LockIcon } from 'lucide-react';
import { toast } from 'sonner';
import { AuthImage } from '@/components/auth-image';
import { RichTextEditor } from '@/components/rich-text-editor';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ApiError } from '@/lib/api-client';
import type { ThankYouDraft, ThankYouKind } from '@/lib/contest-form';
import { uploadCatalogImage } from '@/services';

const KINDS: { id: ThankYouKind; label: string }[] = [
  { id: 'custom', label: 'Custom message' },
  { id: 'image', label: 'Image only' },
  { id: 'template', label: 'Success template' },
];

export function ContestFormThankYouPanel({
  value,
  issues,
  onChange,
}: {
  value: ThankYouDraft;
  issues: Record<string, string>;
  onChange: (patch: Partial<ThankYouDraft>) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function onImage(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const fileId = await uploadCatalogImage(file);
      onChange({ thankYouImageFileId: fileId });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not upload that image.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/50 p-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          <LockIcon className="size-4" aria-hidden />
          Always shown
        </p>
        <ul className="ml-5 list-disc text-sm text-muted-foreground">
          <li>“You’re registered!” with a success tick</li>
          <li>The Registration ID with a Copy button</li>
          <li>The “Log in to BrainPulses” button, always last. Nothing is shown below it.</li>
        </ul>
        <p className="text-sm text-muted-foreground">
          The Registration ID is the only login, so it can’t be hidden. Anything you add here goes
          between the Registration ID and the Log in button.
        </p>
      </div>
      <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
        <div className="flex min-h-(--control-h) items-center justify-between gap-3">
          <Label htmlFor="thank-you-enabled">Enable thank-you message</Label>
          <Switch
            id="thank-you-enabled"
            checked={value.thankYouEnabled}
            onCheckedChange={(checked) => onChange({ thankYouEnabled: checked === true })}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Until this is on, people still see the standard success screen with their Registration ID.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label="Message type">
        {KINDS.map((kind) => (
          <Button
            key={kind.id}
            type="button"
            variant={value.thankYouKind === kind.id ? 'secondary' : 'outline'}
            className="h-auto min-h-11 whitespace-normal px-2 text-center leading-snug"
            aria-pressed={value.thankYouKind === kind.id}
            onClick={() => onChange({ thankYouKind: kind.id })}
          >
            {kind.label}
          </Button>
        ))}
      </div>
      {value.thankYouKind === 'custom' ? (
        <div className="flex flex-col gap-3" data-field="thankYouHtml">
          <div>
            <Label htmlFor="thank-you-title">Title</Label>
            <Input
              id="thank-you-title"
              className="mt-1"
              maxLength={120}
              value={value.thankYouTitle}
              placeholder="Thank you for registering!"
              onChange={(event) => onChange({ thankYouTitle: event.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="thank-you-body">Message content</Label>
            <RichTextEditor
              id="thank-you-body"
              className="mt-1"
              value={value.thankYouHtml}
              aria-label="Thank-you message"
              onChange={(html) => onChange({ thankYouHtml: html })}
            />
            {issues.thankYouHtml ? (
              <p className="mt-1 text-sm text-destructive" role="alert">
                {issues.thankYouHtml}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      {value.thankYouKind === 'image' ? (
        <div data-field="thankYouImageFileId">
          <Label htmlFor="thank-you-image">Image</Label>
          {value.thankYouImageFileId ? (
            <AuthImage
              fileId={value.thankYouImageFileId}
              alt="Thank-you image"
              className="mt-2 max-h-40 w-full rounded-lg object-contain"
            />
          ) : (
            <div className="mt-2 flex min-h-24 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
              <ImageIcon aria-hidden />
            </div>
          )}
          <Input
            id="thank-you-image"
            className="mt-2"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={uploading}
            onChange={(event) => void onImage(event.target.files?.[0] ?? null)}
          />
          {uploading ? <p className="mt-1 text-sm text-muted-foreground">Uploading…</p> : null}
          {issues.thankYouImageFileId ? (
            <p className="mt-1 text-sm text-destructive" role="alert">
              {issues.thankYouImageFileId}
            </p>
          ) : null}
        </div>
      ) : null}
      {value.thankYouKind === 'template' ? (
        <p className="text-sm text-muted-foreground">
          People see “You’re registered!”, a welcome line, their Registration ID, and a link to log
          in.
        </p>
      ) : null}
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">Additional options</legend>
        <Check
          id="thank-you-steps"
          label="Show next steps"
          checked={value.thankYouShowNextSteps}
          onChange={(checked) => onChange({ thankYouShowNextSteps: checked })}
        />
        <Check
          id="thank-you-quizzes"
          label="Show registered quiz details"
          checked={value.thankYouShowQuizzes}
          onChange={(checked) => onChange({ thankYouShowQuizzes: checked })}
        />
        <Check
          id="thank-you-button"
          label="Add a button"
          checked={Boolean(value.thankYouButtonLabel || value.thankYouButtonUrl)}
          onChange={(checked) =>
            onChange(
              checked
                ? { thankYouButtonLabel: value.thankYouButtonLabel || 'Continue' }
                : { thankYouButtonLabel: '', thankYouButtonUrl: '' },
            )
          }
        />
      </fieldset>
      {value.thankYouButtonLabel || value.thankYouButtonUrl ? (
        <div className="grid gap-3">
          <div data-field="thankYouButtonLabel">
            <Label htmlFor="thank-you-button-label">Button text</Label>
            <Input
              id="thank-you-button-label"
              className="mt-1"
              maxLength={80}
              value={value.thankYouButtonLabel}
              aria-invalid={Boolean(issues.thankYouButtonLabel) || undefined}
              onChange={(event) => onChange({ thankYouButtonLabel: event.target.value })}
            />
            {issues.thankYouButtonLabel ? (
              <p className="mt-1 text-sm text-destructive" role="alert">
                {issues.thankYouButtonLabel}
              </p>
            ) : null}
          </div>
          <div data-field="thankYouButtonUrl">
            <Label htmlFor="thank-you-button-url">Button link</Label>
            <Input
              id="thank-you-button-url"
              className="mt-1"
              inputMode="url"
              maxLength={500}
              placeholder="https://"
              value={value.thankYouButtonUrl}
              aria-invalid={Boolean(issues.thankYouButtonUrl) || undefined}
              onChange={(event) => onChange({ thankYouButtonUrl: event.target.value })}
            />
            {issues.thankYouButtonUrl ? (
              <p className="mt-1 text-sm text-destructive" role="alert">
                {issues.thankYouButtonUrl}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Check({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex min-h-11 items-center gap-2 text-sm">
      <Checkbox id={id} checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      {label}
    </label>
  );
}
