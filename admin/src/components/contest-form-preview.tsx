import { useState } from 'react';
import { AuthImage } from '@/components/auth-image';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  formatIst,
  previewIssues,
  sampleRegistrationId,
  type ContestFormRecord,
  type FormField,
} from '@/lib/contest-form';

type Answers = Record<string, string | string[] | boolean>;

export function ContestFormPreview({
  form,
  sponsorName,
  contestName,
  device,
}: {
  form: Pick<
    ContestFormRecord,
    | 'welcomeMessage'
    | 'showContestImage'
    | 'showSponsorName'
    | 'showRegistrationCloses'
    | 'showSeatsLeft'
    | 'seats'
    | 'closesAt'
    | 'contestImageFileId'
    | 'fields'
  >;
  sponsorName: string;
  contestName: string;
  device: 'desktop' | 'mobile';
}) {
  const fields = form.fields.filter((field) => !field.deleted);
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string | null>(null);

  const seatsLabel = form.seats == null ? null : `${form.seats} seats left`;
  const frame = device === 'mobile' ? 'mx-auto w-full max-w-[380px]' : 'w-full';

  if (done) {
    return (
      <div className={`${frame} rounded-lg border border-border bg-card p-4 text-sm`}>
        <p className="font-medium">You're registered (preview only).</p>
        <p className="mt-2 font-mono text-lg">{done}</p>
        <p className="mt-2 text-muted-foreground">
          Your Registration ID. Use it to log in. Your quizzes appear after you log in. Nothing was
          saved.
        </p>
        <Button type="button" className="mt-4" variant="outline" onClick={() => setDone(null)}>
          Back to the form
        </Button>
      </div>
    );
  }

  return (
    <form
      className={`${frame} rounded-lg border border-border bg-background p-4 text-foreground`}
      onSubmit={(event) => {
        event.preventDefault();
        const issues = previewIssues(fields, answers);
        if (issues.length) {
          const next: Record<string, string> = {};
          for (const issue of issues) next[issue.field] = issue.message;
          setErrors(next);
          return;
        }
        setErrors({});
        setDone(sampleRegistrationId());
      }}
    >
      <p className="text-sm font-medium">BrainPulses</p>
      {form.showContestImage && form.contestImageFileId ? (
        <AuthImage
          fileId={form.contestImageFileId}
          alt=""
          className="mt-3 h-28 w-full rounded-lg object-cover"
        />
      ) : null}
      {form.showSponsorName && sponsorName ? (
        <p className="mt-3 text-sm text-muted-foreground">{sponsorName}</p>
      ) : null}
      <h2 className="mt-1 text-xl font-semibold">{contestName || 'Contest name'}</h2>
      {form.welcomeMessage ? <p className="mt-2 text-sm">{form.welcomeMessage}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {form.showRegistrationCloses && form.closesAt ? (
          <span className="text-warning">Closes {formatIst(form.closesAt)}</span>
        ) : null}
        {form.showSeatsLeft && seatsLabel ? <span>{seatsLabel}</span> : null}
      </div>
      <div className="mt-4 flex flex-col gap-3">
        {fields.map((field) => (
          <PreviewField
            key={field.id}
            field={field}
            value={answers[field.id]}
            error={errors[field.id]}
            onChange={(value) => setAnswers((current) => ({ ...current, [field.id]: value }))}
          />
        ))}
      </div>
      <Button type="submit" className="mt-4 w-full">
        Register
      </Button>
      <p className="mt-3 text-center text-sm text-muted-foreground">Already registered? Log in</p>
    </form>
  );
}

function PreviewField({
  field,
  value,
  error,
  onChange,
}: {
  field: FormField;
  value: string | string[] | boolean | undefined;
  error?: string;
  onChange: (value: string | string[] | boolean) => void;
}) {
  const id = `preview-${field.id}`;
  return (
    <div>
      {field.type === 'consent' ? (
        <label className="flex items-start gap-2 text-sm" htmlFor={id}>
          <Checkbox
            id={id}
            checked={value === true}
            onCheckedChange={(checked) => onChange(checked === true)}
          />
          <span>
            {field.consentText || field.label}
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
      ) : (
        <>
          <label className="text-sm font-medium" htmlFor={id}>
            {field.label}
            {field.required ? ' *' : ''}
          </label>
          {field.help ? <p className="text-xs text-muted-foreground">{field.help}</p> : null}
          {field.type === 'textarea' ? (
            <Textarea
              id={id}
              className="mt-1"
              value={typeof value === 'string' ? value : ''}
              placeholder={field.placeholder}
              onChange={(event) => onChange(event.target.value)}
            />
          ) : field.type === 'dropdown' ? (
            <Select
              value={typeof value === 'string' && value ? value : undefined}
              onValueChange={(next) => onChange(next)}
            >
              <SelectTrigger id={id} className="mt-1 w-full" aria-label={field.label}>
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
          ) : field.type === 'multi_select' ? (
            <div className="mt-1 flex flex-col gap-1">
              {(field.options ?? []).map((option) => {
                const picked = Array.isArray(value) ? value : [];
                return (
                  <label key={option} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={picked.includes(option)}
                      onCheckedChange={(checked) =>
                        onChange(
                          checked ? [...picked, option] : picked.filter((item) => item !== option),
                        )
                      }
                    />
                    {option}
                  </label>
                );
              })}
            </div>
          ) : (
            <Input
              id={id}
              className="mt-1"
              type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : 'text'}
              value={typeof value === 'string' ? value : ''}
              placeholder={field.type === 'phone' ? '+91' : field.placeholder}
              onChange={(event) => onChange(event.target.value)}
            />
          )}
        </>
      )}
      {error ? (
        <p className="mt-1 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
