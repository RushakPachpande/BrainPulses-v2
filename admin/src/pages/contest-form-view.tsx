import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LockIcon, PlusIcon } from 'lucide-react';
import { toast } from 'sonner';
import { GiveQuizDialog } from '@/components/give-quiz-dialog';
import { ListPageSkeleton } from '@/components/loading-skeletons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { PageHeaderActions } from '@/contexts/page-header';
import { canMutateOrg } from '@/lib/access';
import { formatIst, registrationUrl } from '@/lib/contest-form';
import { getContestForm } from '@/services/contest-forms';

export function ContestFormViewPage() {
  const { formId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const auth = useAuth();
  const membership = auth.status === 'authenticated' ? auth.membership : null;
  const canMutate = canMutateOrg(membership);
  const [giveOpen, setGiveOpen] = useState(false);
  const { data, isPending } = useQuery({
    queryKey: ['admin', 'contest-form', formId],
    queryFn: () => getContestForm(formId),
    enabled: Boolean(formId),
  });

  if (isPending || !data) return <ListPageSkeleton />;

  const link = data.slug ? registrationUrl(data.slug) : '';

  return (
    <div className="flex flex-col gap-4">
      <PageHeaderActions>
        {canMutate ? (
          <Button type="button" variant="outline" onClick={() => setGiveOpen(true)}>
            <PlusIcon />
            Give a quiz
          </Button>
        ) : null}
        {canMutate ? (
          <Button type="button" onClick={() => navigate(`/participants/forms/${data.id}/edit`)}>
            <LockIcon />
            Edit form
          </Button>
        ) : null}
      </PageHeaderActions>
      <Link to="/participants" className="text-sm font-medium text-primary">
        ‹ Participants
      </Link>
      <div>
        <h2 className="text-2xl font-semibold">{data.contestName || 'Registration form'}</h2>
        <p className="text-sm text-muted-foreground">
          {data.sponsorName} · registration form · {data.registrationCount} registered
        </p>
      </div>
      <div className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center">
        <span className="text-sm font-medium">
          {data.linkActive ? 'Link active' : 'Link turned off'}
        </span>
        <code className="min-w-0 flex-1 truncate text-sm text-primary">{link}</code>
        <Button
          type="button"
          variant="outline"
          disabled={!link}
          onClick={() => {
            void navigator.clipboard.writeText(link);
            toast.success('Link copied');
          }}
        >
          Copy link
        </Button>
        <span className="text-sm text-muted-foreground">
          View only. Editing needs your admin password.
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <InfoCard title={`Quizzes this form gives access to · ${data.quizzes.length} given`}>
          {data.quizzes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No quiz yet. People can still register with the link. They see "No quizzes yet" until
              you give one.
            </p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {data.quizzes.map((quiz) => (
                <li key={quiz.id}>
                  <span className="font-medium">{quiz.name}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    · {quiz.availability}
                    {quiz.endsAt ? ` · ${formatIst(quiz.endsAt)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </InfoCard>
        <InfoCard title="Registration window & seats">
          <Dl
            rows={[
              ['Opens', data.opensAt ? formatIst(data.opensAt) : '—'],
              ['Closes', data.closesAt ? formatIst(data.closesAt) : '—'],
              ['Seats', data.seats == null ? 'Unlimited' : String(data.seats)],
            ]}
          />
        </InfoCard>
        <InfoCard title="Who can register">
          <Dl
            rows={[
              ['Access', 'Anyone with the link'],
              [
                'Email domains',
                data.domainRestriction
                  ? data.allowedDomains.map((domain) => `@${domain}`).join(', ')
                  : 'Any',
              ],
              ...(data.domainRestriction
                ? [['Message', data.domainMessage] as [string, string]]
                : []),
            ]}
          />
        </InfoCard>
        <InfoCard title="Registration ID">
          <Dl
            rows={[
              ['Format', 'BP + 8 digits'],
              [
                'Returning participants',
                data.keepExistingId ? 'Keep existing ID' : 'Always new ID',
              ],
              [
                'Matched on',
                data.matchRule === 'name_and_contact'
                  ? 'First name and (email or mobile number)'
                  : 'Email or mobile number',
              ],
              ['Email when a quiz is given', data.emailOnQuiz ? 'On' : 'Off'],
            ]}
          />
        </InfoCard>
        <InfoCard title="Form header">
          <p className="text-sm">{data.welcomeMessage || 'No welcome message.'}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Shown:{' '}
            {[
              data.showContestImage ? 'contest image' : null,
              data.showSponsorName ? 'sponsor name' : null,
              data.showRegistrationCloses ? 'registration closes' : null,
              data.showSeatsLeft ? 'seats left' : null,
            ]
              .filter(Boolean)
              .join(', ') || 'contest name only'}
          </p>
        </InfoCard>
        <InfoCard title="Form fields" className="lg:col-span-2">
          <ul className="flex flex-col gap-2 text-sm">
            {data.fields
              .filter((field) => !field.deleted)
              .map((field) => (
                <li key={field.id}>
                  <span className="font-medium">{field.label}</span>
                  {field.locked ? (
                    <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs">Locked</span>
                  ) : null}
                  <span className="text-muted-foreground">
                    {' '}
                    · {field.type}
                    {field.options?.length ? ` (${field.options.join(', ')})` : ''} ·{' '}
                    {field.required ? 'Required' : 'Optional'}
                  </span>
                </li>
              ))}
          </ul>
        </InfoCard>
      </div>
      <GiveQuizDialog
        form={data}
        open={giveOpen}
        onOpenChange={setGiveOpen}
        onGiven={() => {
          void queryClient.invalidateQueries({ queryKey: ['admin', 'contest-form', formId] });
          void queryClient.invalidateQueries({ queryKey: ['admin', 'contest-forms'] });
        }}
      />
    </div>
  );
}

function InfoCard({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Dl({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
