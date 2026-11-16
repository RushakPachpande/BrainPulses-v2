import { useState } from 'react';
import { AuthImage } from '@/components/auth-image';
import { ContestFormFieldInput } from '@/components/contest-form-field-input';
import { Button } from '@/components/ui/button';
import {
  formatIst,
  previewIssues,
  sampleRegistrationId,
  type ContestFormRecord,
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
          <ContestFormFieldInput
            key={field.id}
            field={field}
            idPrefix="preview"
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
