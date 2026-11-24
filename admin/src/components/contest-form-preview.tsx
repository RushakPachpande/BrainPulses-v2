import { useState } from 'react';
import {
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  ExternalLinkIcon,
  LockIcon,
} from 'lucide-react';
import { AuthImage } from '@/components/auth-image';
import { ContestFormFieldInput } from '@/components/contest-form-field-input';
import { Button } from '@/components/ui/button';
import { sanitizeInstructionsHtml } from '@/lib/sanitize-html';
import {
  formatIst,
  previewIssues,
  type ContestFormQuiz,
  type ContestFormRecord,
} from '@/lib/contest-form';
import { cn } from '@/lib/utils';

type Answers = Record<string, string | string[] | boolean>;

export type PreviewForm = Pick<
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
  | 'registrationCount'
  | 'thankYouEnabled'
  | 'thankYouKind'
  | 'thankYouTitle'
  | 'thankYouHtml'
  | 'thankYouImageFileId'
  | 'thankYouShowNextSteps'
  | 'thankYouShowQuizzes'
  | 'thankYouButtonLabel'
  | 'thankYouButtonUrl'
>;

const SAMPLE_ID = 'BP07260612';

/**
 * What participants see, built from the draft. Mirrors participant/src/pages/register.tsx
 * and components/register-success.tsx. Nothing is submitted.
 */
export function ContestFormPreview({
  form,
  sponsorName,
  contestName,
  device,
  theme,
  page,
  quizzes = [],
}: {
  form: PreviewForm;
  sponsorName: string;
  contestName: string;
  device: 'desktop' | 'mobile';
  theme: 'light' | 'dark';
  page: 'form' | 'thanks';
  quizzes?: ContestFormQuiz[];
}) {
  const fields = form.fields.filter((field) => !field.deleted);
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const first = fields.find((field) => field.key === 'first_name');
  const last = fields.find((field) => field.key === 'last_name');
  const rest = fields.filter((field) => field !== first && field !== last);
  const seatsLeft =
    form.seats == null ? null : Math.max(0, form.seats - (form.registrationCount ?? 0));
  const mobile = device === 'mobile';

  const input = (field: (typeof fields)[number]) => (
    <ContestFormFieldInput
      key={field.id}
      field={field}
      idPrefix="preview"
      value={answers[field.id]}
      error={errors[field.id]}
      onChange={(value) => setAnswers((current) => ({ ...current, [field.id]: value }))}
    />
  );

  const info = (
    <div className="flex min-w-0 flex-col gap-3">
      {form.showContestImage && form.contestImageFileId ? (
        <AuthImage
          fileId={form.contestImageFileId}
          alt=""
          className="h-32 w-full rounded-xl object-cover"
        />
      ) : null}
      {form.showSponsorName && sponsorName ? (
        <p className="text-sm text-muted-foreground">
          Presented by <span className="font-semibold text-foreground">{sponsorName}</span>
        </p>
      ) : null}
      <h2 className="font-display text-2xl font-bold tracking-tight">
        {contestName || 'Contest name'}
      </h2>
      {form.welcomeMessage ? <p className="text-sm">{form.welcomeMessage}</p> : null}
      {form.showRegistrationCloses && form.closesAt ? (
        <p className="flex items-center gap-2 text-sm">
          <ClockIcon className="size-4 text-muted-foreground" aria-hidden />
          Registration closes <b>{formatIst(form.closesAt)}</b>
        </p>
      ) : null}
      {form.showSeatsLeft && seatsLeft != null ? (
        <p className="text-sm">
          <b>{seatsLeft}</b> seats left
        </p>
      ) : null}
      {!mobile ? (
        <ol className="mt-2 flex flex-col gap-3 text-sm">
          <Step n={1} title="Fill in this form" text="Your details for this contest." />
          <Step
            n={2}
            title="Get your Registration ID"
            text="Shown right after you register. If you've registered before, you get your existing ID."
          />
          <Step
            n={3}
            title="Log in with it"
            text="Your quizzes appear on your home page when they're ready."
          />
        </ol>
      ) : null}
    </div>
  );

  const card =
    page === 'thanks' ? (
      <Thanks form={form} contestName={contestName} quizzes={quizzes} />
    ) : (
      <form
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const issues = previewIssues(fields, answers);
          const next: Record<string, string> = {};
          for (const issue of issues) next[issue.field] = issue.message;
          setErrors(next);
        }}
      >
        <h3 className="text-lg font-semibold">Register</h3>
        <p className="text-sm text-muted-foreground">
          Fields marked <span className="text-destructive">*</span> are required.
        </p>
        {first && last ? (
          <div className={cn('grid gap-3', !mobile && 'grid-cols-2')}>
            {input(first)}
            {input(last)}
          </div>
        ) : (
          [first, last].filter((field) => field).map((field) => input(field!))
        )}
        {rest.map(input)}
        <Button type="submit" className="mt-2 w-full">
          Register
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Already registered? <span className="font-medium text-primary underline">Log in</span>
        </p>
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <LockIcon className="size-3.5" aria-hidden />
          Your details are only shared with the organiser of this contest.
        </p>
      </form>
    );

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-background text-foreground',
        theme === 'dark' ? 'theme-dark' : 'theme-light',
        mobile ? 'mx-auto w-full max-w-[390px]' : 'w-full',
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="text-sm font-semibold">BrainPulses</span>
        <span className="text-xs text-muted-foreground">Preview</span>
      </div>
      <div
        className={cn('grid gap-5 p-4', !mobile && 'md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]')}
      >
        {info}
        {card}
      </div>
    </div>
  );
}

function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
        {n}
      </span>
      <span>
        <b className="block">{title}</b>
        <span className="text-muted-foreground">{text}</span>
      </span>
    </li>
  );
}

function Thanks({
  form,
  contestName,
  quizzes,
}: {
  form: PreviewForm;
  contestName: string;
  quizzes: ContestFormQuiz[];
}) {
  const on = form.thankYouEnabled;
  const custom = on && form.thankYouKind === 'custom';
  const image = on && form.thankYouKind === 'image' ? form.thankYouImageFileId : null;
  const html = custom && form.thankYouHtml ? sanitizeInstructionsHtml(form.thankYouHtml) : '';
  const title =
    custom && form.thankYouTitle?.trim() ? form.thankYouTitle.trim() : "You're registered!";
  const button = on && form.thankYouButtonLabel?.trim() ? form.thankYouButtonLabel.trim() : '';
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-5 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-success text-white">
        <CheckIcon aria-hidden />
      </span>
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">
        Welcome to {contestName || 'the contest'}, Shreyas.
      </p>
      <div className="w-full rounded-lg border border-border bg-muted/50 p-3">
        <p className="text-xs text-muted-foreground">Your Registration ID</p>
        <div className="mt-1 flex items-center justify-center gap-3">
          <b className="font-mono text-lg tracking-wide">{SAMPLE_ID}</b>
          <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs">
            <CopyIcon className="size-3.5" aria-hidden />
            Copy
          </span>
        </div>
      </div>
      {image ? (
        <AuthImage fileId={image} alt="" className="max-h-48 w-full rounded-lg object-contain" />
      ) : null}
      {html ? (
        <div
          className="w-full text-left text-sm [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : null}
      {on && form.thankYouShowNextSteps ? (
        <ol className="w-full text-left text-sm">
          <li>1. Fill in this form</li>
          <li>2. Get your Registration ID</li>
          <li>3. Log in with it</li>
        </ol>
      ) : null}
      {on && form.thankYouShowQuizzes && quizzes.length ? (
        <div className="w-full text-left text-sm">
          <p className="font-medium">Your quizzes</p>
          <ul className="mt-1 list-disc pl-5">
            {quizzes.map((quiz) => (
              <li key={quiz.id}>{quiz.name}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {button ? (
        <span className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-border text-sm font-semibold">
          {button}
          <ExternalLinkIcon className="size-4" aria-hidden />
        </span>
      ) : null}
      <span className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
        Log in to BrainPulses
        <ArrowRightIcon className="size-4" aria-hidden />
      </span>
    </div>
  );
}
