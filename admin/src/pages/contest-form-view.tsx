import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleHelpIcon,
  ClipboardListIcon,
  CopyIcon,
  IdCardIcon,
  LinkIcon,
  ListChecksIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  UsersIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { GiveQuizDialog } from '@/components/give-quiz-dialog';
import { ListPageSkeleton } from '@/components/loading-skeletons';
import { ResponsiveRecords, type RecordColumn } from '@/components/responsive-records';
import { StatusPill, type PillTone } from '@/components/status-pill';
import { Toolbar } from '@/components/toolbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/auth-context';
import { PageHeaderActions } from '@/contexts/page-header';
import { useContainerNarrow } from '@/hooks/use-container-narrow';
import { canMutateOrg } from '@/lib/access';
import {
  formatIst,
  registrationUrl,
  type ContestFormQuiz,
  type ContestFormRegistrant,
} from '@/lib/contest-form';
import { getContestForm, getContestFormRegistrants } from '@/services/contest-forms';

const registrantColumns: RecordColumn<ContestFormRegistrant>[] = [
  {
    key: 'code',
    label: 'Registration ID',
    placement: 'identity',
    identityPrefix: 'ID: ',
    tableClassName: 'tabular-nums',
    render: (person) => <span className="tabular-nums">{person.code}</span>,
  },
  {
    key: 'name',
    label: 'Name',
    placement: 'title',
    render: (person) => <span className="font-medium">{person.name}</span>,
  },
  {
    key: 'email',
    label: 'Email',
    placement: 'primary',
    render: (person) => person.email,
  },
  {
    key: 'registeredAt',
    label: 'Registered',
    placement: 'details',
    render: (person) => formatIst(person.registeredAt),
  },
];

const FIELD_TYPE_LABEL: Record<string, string> = {
  text: 'Text',
  number: 'Number',
  email: 'Email',
  phone: 'Phone',
  textarea: 'Textarea',
  dropdown: 'Dropdown',
  multi_select: 'Multi-select',
  consent: 'Consent',
};

export function ContestFormViewPage() {
  const { formId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const auth = useAuth();
  const { narrow, ref } = useContainerNarrow();
  const membership = auth.status === 'authenticated' ? auth.membership : null;
  const canMutate = canMutateOrg(membership);
  const [giveOpen, setGiveOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('10');
  const { data, isPending } = useQuery({
    queryKey: ['admin', 'contest-form', formId],
    queryFn: ({ signal }) => getContestForm(formId, signal),
    enabled: Boolean(formId),
  });
  const { data: registrants = [], isPending: registrantsPending } = useQuery({
    queryKey: ['admin', 'contest-form-registrants', formId],
    queryFn: ({ signal }) => getContestFormRegistrants(formId, signal),
    enabled: Boolean(formId),
  });

  const filteredRegistrants = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return registrants;
    return registrants.filter(
      (person) =>
        person.name.toLowerCase().includes(query) ||
        person.email.toLowerCase().includes(query) ||
        person.code.toLowerCase().includes(query),
    );
  }, [registrants, search]);

  const size = Number(pageSize);
  const pageCount = Math.max(1, Math.ceil(filteredRegistrants.length / size));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * size;
  const pageRows = filteredRegistrants.slice(start, start + size);
  const end =
    filteredRegistrants.length === 0 ? 0 : Math.min(start + size, filteredRegistrants.length);

  if (isPending || !data) return <ListPageSkeleton />;

  const link = data.slug ? registrationUrl(data.slug) : '';
  const quizzes = data.quizzes.filter((item) => item.kind !== 'assessment');
  const assessments = data.quizzes.filter((item) => item.kind === 'assessment');
  const visibleFields = data.fields.filter((field) => !field.deleted);
  const shown = [
    data.showContestImage ? 'Contest image' : null,
    data.showSponsorName ? 'Sponsor name' : null,
    data.showRegistrationCloses ? 'Registration closes' : null,
    data.showSeatsLeft ? 'Seats left' : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <div className="flex flex-col gap-4">
      <PageHeaderActions>
        {canMutate ? (
          <Button type="button" variant="outline" onClick={() => setGiveOpen(true)}>
            <PlusIcon />
            Assign activity
          </Button>
        ) : null}
        {canMutate ? (
          <Button type="button" onClick={() => navigate(`/participants/forms/${data.id}/edit`)}>
            <PencilIcon />
            Edit form
          </Button>
        ) : null}
      </PageHeaderActions>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link
            to="/participants"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary"
          >
            <ChevronLeftIcon className="size-4" aria-hidden />
            Participants
          </Link>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            {data.contestName || 'Registration form'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.sponsorName || 'No sponsor'} · {data.registrationCount} registered
          </p>
        </div>
        <StatusPill
          value={data.linkActive ? 'Link active' : 'Link turned off'}
          tone={data.linkActive ? 'ok' : 'er'}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="size-4 text-muted-foreground" aria-hidden />
            Registration link
          </CardTitle>
          <CardDescription>
            Share this with people who should register for the contest.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 text-sm text-primary">
            {link || 'Not live yet'}
          </code>
          <Button
            type="button"
            variant="outline"
            disabled={!link}
            onClick={() => {
              void navigator.clipboard.writeText(link);
              toast.success('Link copied');
            }}
          >
            <CopyIcon />
            Copy link
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard
          icon={ClipboardListIcon}
          title="Activities"
          description="Quizzes and assessments people receive through this form."
        >
          <ActivityGroup title="Quizzes" items={quizzes} />
          <ActivityGroup title="Assessments" items={assessments} />
        </SectionCard>

        <SectionCard
          icon={CalendarDaysIcon}
          title="Registration window"
          description="When people can register, and how many seats are available."
        >
          <Fact
            icon={CalendarDaysIcon}
            label="Opens"
            value={data.opensAt ? formatIst(data.opensAt) : '—'}
          />
          <Fact
            icon={CalendarDaysIcon}
            label="Closes"
            value={data.closesAt ? formatIst(data.closesAt) : '—'}
          />
          <Fact
            icon={UsersIcon}
            label="Seats"
            value={
              data.seats == null ? 'Unlimited' : `${data.registrationCount} of ${data.seats} taken`
            }
          />
        </SectionCard>

        <SectionCard
          icon={ShieldCheckIcon}
          title="Who can register"
          description="Who the link accepts."
        >
          <Fact icon={LinkIcon} label="Access" value="Anyone with the link" />
          <Fact
            icon={ShieldCheckIcon}
            label="Email domains"
            value={
              data.domainRestriction
                ? data.allowedDomains.map((domain) => `@${domain}`).join(', ')
                : 'Any domain'
            }
          />
          {data.domainRestriction ? (
            <Fact icon={ShieldCheckIcon} label="Message" value={data.domainMessage} />
          ) : null}
        </SectionCard>

        <SectionCard
          icon={IdCardIcon}
          title="Registration ID"
          description="How a returning person is matched to an existing ID."
        >
          <Fact icon={IdCardIcon} label="Format" value="BP + 8 digits" />
          <Fact
            icon={IdCardIcon}
            label="Returning participants"
            value={data.keepExistingId ? 'Keep existing ID' : 'Always a new ID'}
          />
          <Fact
            icon={IdCardIcon}
            label="Matched on"
            value={
              data.matchRule === 'name_and_contact'
                ? 'First name and (email or mobile)'
                : 'Email or mobile'
            }
          />
        </SectionCard>
      </div>

      <SectionCard
        icon={ListChecksIcon}
        title="What participants see"
        description="Header and fields on the public form."
      >
        <p className="text-sm">{data.welcomeMessage || 'No welcome message.'}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {shown.length === 0 ? (
            <Badge variant="outline">Contest name only</Badge>
          ) : (
            shown.map((item) => (
              <Badge key={item} variant="secondary">
                {item}
              </Badge>
            ))
          )}
        </div>
        <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
          {visibleFields.map((field) => (
            <li
              key={field.id}
              className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-medium">{field.label}</p>
                {field.options?.length ? (
                  <p className="mt-1 text-sm text-muted-foreground">{field.options.join(', ')}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{FIELD_TYPE_LABEL[field.type] ?? field.type}</Badge>
                <StatusPill
                  value={field.required ? 'Required' : 'Optional'}
                  tone={field.required ? 'ok' : 'gy'}
                />
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>

      <div ref={ref} className="flex flex-col gap-4">
        <Toolbar
          filters={[]}
          searchPlaceholder="Search by name, email, or registration ID..."
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          actions={
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
              className="w-full sm:w-auto"
            >
              <RotateCcwIcon data-icon="inline-start" />
              Clear Filters
            </Button>
          }
        />
        <Card>
          <CardHeader>
            <CardTitle>
              {filteredRegistrants.length}{' '}
              {filteredRegistrants.length === 1 ? 'participant' : 'participants'}
            </CardTitle>
            <CardDescription>People who registered through this form.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {registrantsPending ? (
              <p className="text-sm text-muted-foreground">Loading participants…</p>
            ) : (
              <>
                <ResponsiveRecords
                  caption="Registered participants"
                  rows={pageRows}
                  getRowId={(person) => person.id}
                  columns={registrantColumns}
                  narrow={narrow}
                  empty="No one has registered through this form yet."
                />
                <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {filteredRegistrants.length === 0 ? 0 : start + 1} to {end} of{' '}
                    {filteredRegistrants.length} participants
                  </p>
                  <div className="list-pager flex flex-nowrap items-center justify-between gap-2 sm:justify-end">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="whitespace-nowrap text-xs text-muted-foreground sm:text-sm">
                        Rows per page
                      </span>
                      <Select
                        value={pageSize}
                        onValueChange={(value) => {
                          setPageSize(value);
                          setPage(1);
                        }}
                      >
                        <SelectTrigger aria-label="Rows per page" className="w-16 shrink-0 sm:w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {['10', '20', '50'].map((value) => (
                              <SelectItem key={value} value={value}>
                                {value}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Previous page"
                        disabled={currentPage <= 1}
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                      >
                        <ChevronLeftIcon />
                      </Button>
                      <Button type="button" variant="default" size="icon" aria-current="page">
                        {currentPage}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Next page"
                        disabled={currentPage >= pageCount}
                        onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                      >
                        <ChevronRightIcon />
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <GiveQuizDialog
        form={data}
        open={giveOpen}
        onOpenChange={setGiveOpen}
        onGiven={() => {
          void queryClient.invalidateQueries({ queryKey: ['admin', 'contest-form', formId] });
          void queryClient.invalidateQueries({ queryKey: ['admin', 'contest-forms'] });
          void queryClient.invalidateQueries({
            queryKey: ['admin', 'contest-form-registrants', formId],
          });
        }}
      />
    </div>
  );
}

function availabilityTone(value: string): PillTone {
  if (value === 'Active') return 'ok';
  if (value === 'Ended') return 'gy';
  return 'wn';
}

function ActivityGroup({ title, items }: { title: string; items: ContestFormQuiz[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
          None assigned.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-border px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{item.name}</p>
                <StatusPill value={item.availability} tone={availabilityTone(item.availability)} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {item.startsAt ? formatIst(item.startsAt) : 'No start'}
                {' – '}
                {item.endsAt ? formatIst(item.endsAt) : 'No end'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof CircleHelpIcon;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CircleHelpIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-medium wrap-break-word">{value}</p>
      </div>
    </div>
  );
}
