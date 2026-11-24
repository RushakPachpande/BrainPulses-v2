import {
  ClipboardListIcon,
  ListChecksIcon,
  PartyPopperIcon,
  PencilIcon,
  ShieldCheckIcon,
  TrophyIcon,
  type LucideIcon,
} from 'lucide-react';
import { KindTag } from '@/components/activity-picker';
import { Button } from '@/components/ui/button';
import {
  FIELD_TYPE_LABEL,
  formatIst,
  isContentType,
  ruleSentence,
  type ContestFormQuiz,
  type ContestFormRecord,
} from '@/lib/contest-form';

export type SummaryForm = Omit<ContestFormRecord, 'id' | 'createdAt' | 'updatedAt'>;

/** Plain-language summary of a form. Step 3 shows Edit buttons; the view page doesn't. */
export function ContestFormSummary({
  form,
  sponsorName,
  contestName,
  activities,
  onEdit,
}: {
  form: SummaryForm;
  sponsorName: string;
  contestName: string;
  /** The contest's quizzes and assessments, to name the ones rules point at. */
  activities: ContestFormQuiz[];
  onEdit?: (step: 1 | 2) => void;
}) {
  const fields = form.fields.filter((field) => !field.deleted);
  const answerFields = fields.filter((field) => !isContentType(field.type));
  const blocks = fields.length - answerFields.length;
  const names = new Map(
    [...activities, ...form.quizzes].map((activity) => [activity.id, activity]),
  );
  const shown = [
    form.showContestImage && 'Contest image',
    form.showSponsorName && 'Sponsor name',
    form.showRegistrationCloses && 'Closing date',
    form.showSeatsLeft && form.seats != null && 'Seats left',
  ].filter(Boolean);
  const thankYou = [
    'Registration ID and Log in button',
    form.thankYouEnabled && form.thankYouKind === 'custom' && 'your own message',
    form.thankYouEnabled && form.thankYouKind === 'image' && 'an image',
    form.thankYouEnabled && form.thankYouShowNextSteps && 'next steps',
    form.thankYouEnabled && form.thankYouShowQuizzes && 'their quizzes',
    form.thankYouEnabled &&
      form.thankYouButtonLabel?.trim() &&
      `button “${form.thankYouButtonLabel.trim()}”`,
  ].filter(Boolean);

  return (
    <div className="divide-y divide-border">
      <Section
        icon={TrophyIcon}
        title="Contest and registration window"
        onEdit={onEdit && (() => onEdit(1))}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Fact label="Contest" value={contestName || '—'} />
          <Fact label="Sponsor" value={sponsorName || '—'} />
          <Fact
            label="Seats"
            value={
              form.seats == null ? 'Unlimited' : `${form.registrationCount} of ${form.seats} taken`
            }
          />
          <Fact label="Opens" value={form.opensAt ? formatIst(form.opensAt) : '—'} />
          <Fact label="Closes" value={form.closesAt ? formatIst(form.closesAt) : '—'} />
          <Fact label="Shown on the form" value={shown.join(', ') || 'Contest name only'} />
        </div>
      </Section>
      <Section icon={ClipboardListIcon} title="Form fields" onEdit={onEdit && (() => onEdit(1))}>
        <ul className="flex flex-wrap gap-2">
          {answerFields.map((field) => (
            <li
              key={field.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-sm"
            >
              {field.label}
              {field.required ? <span className="text-destructive">*</span> : null}
              {field.locked || FIELD_TYPE_LABEL[field.type] !== field.label ? (
                <span className="text-xs text-muted-foreground">
                  {field.locked ? 'locked' : FIELD_TYPE_LABEL[field.type]}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        {blocks ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Plus {blocks} content {blocks === 1 ? 'block' : 'blocks'} (heading, text, image or
            divider).
          </p>
        ) : null}
      </Section>
      <Section
        icon={ListChecksIcon}
        title="Who gets which quizzes and assessments"
        onEdit={onEdit && (() => onEdit(2))}
      >
        {form.assignmentMode === 'rules' ? (
          <div className="flex flex-col gap-2 text-sm">
            <p className="text-muted-foreground">
              Based on their answers. A person gets everything from every rule they match.
            </p>
            {form.rules.length ? (
              form.rules.map((rule, index) => (
                <p key={rule.id} className="rounded-lg bg-muted px-3 py-2">
                  <span className="font-semibold">Rule {index + 1}: </span>
                  {ruleSentence(rule, fields, names)}
                </p>
              ))
            ) : (
              <p className="text-muted-foreground">No rules.</p>
            )}
            <p className="rounded-lg bg-muted px-3 py-2">
              <span className="text-muted-foreground">If no rule matches → </span>
              {form.fallbackActivityIds
                .map((id) => names.get(id)?.name ?? 'Removed activity')
                .join(', ') || 'nothing (they can still log in)'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 text-sm">
            <p className="text-muted-foreground">Same for everyone.</p>
            {form.quizzes.length ? (
              <ul className="flex flex-wrap gap-2">
                {form.quizzes.map((quiz) => (
                  <li
                    key={quiz.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border py-0.5 pr-2.5 pl-1 text-sm"
                  >
                    <KindTag kind={quiz.kind} />
                    {quiz.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No activity yet.</p>
            )}
          </div>
        )}
      </Section>
      <Section
        icon={ShieldCheckIcon}
        title="Who can register and Registration ID"
        onEdit={onEdit && (() => onEdit(2))}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Fact
            label="Email domains"
            value={
              form.domainRestriction
                ? form.allowedDomains.map((domain) => `@${domain}`).join(', ') || 'None added'
                : 'Any domain'
            }
          />
          <Fact
            label="Returning participants"
            value={form.keepExistingId ? 'Keep existing ID' : 'Always a new ID'}
          />
          <Fact
            label="Matched on"
            value={
              !form.keepExistingId
                ? '—'
                : form.matchRule === 'name_and_contact'
                  ? 'First name and (email or mobile)'
                  : 'Email or mobile'
            }
          />
        </div>
      </Section>
      <Section icon={PartyPopperIcon} title="Thank-you page" onEdit={onEdit && (() => onEdit(1))}>
        <p className="text-sm">{thankYou.join(' · ')}</p>
      </Section>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  onEdit,
  children,
}: {
  icon: LucideIcon;
  title: string;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
          {title}
        </h3>
        {onEdit ? (
          <Button type="button" variant="ghost" onClick={onEdit} aria-label={`Edit ${title}`}>
            <PencilIcon data-icon="inline-start" />
            Edit
          </Button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium wrap-break-word">{value}</p>
    </div>
  );
}
