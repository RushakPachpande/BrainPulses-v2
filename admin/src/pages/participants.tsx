import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';
import { toast } from 'sonner';
import { GiveQuizDialog } from '@/components/give-quiz-dialog';
import { ListPageSkeleton } from '@/components/loading-skeletons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/contexts/auth-context';
import { PageHeaderActions } from '@/contexts/page-header';
import { useOrgId } from '@/hooks/use-org-id';
import { canMutateOrg } from '@/lib/access';
import { formatIst, registrationUrl, type ContestFormRecord } from '@/lib/contest-form';
import { getContestFormOverview } from '@/services/contest-forms';

export function ParticipantsPage() {
  const auth = useAuth();
  const orgId = useOrgId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const membership = auth.status === 'authenticated' ? auth.membership : null;
  const canMutate = canMutateOrg(membership);
  const [giveForm, setGiveForm] = useState<ContestFormRecord | null>(null);
  const [highlight, setHighlight] = useState('');
  const { data, isPending } = useQuery({
    queryKey: ['admin', 'contest-forms', orgId],
    queryFn: () => getContestFormOverview(),
    enabled: Boolean(orgId),
  });

  useEffect(() => {
    const id = sessionStorage.getItem('bp-new-form');
    if (!id) return;
    setHighlight(id);
    sessionStorage.removeItem('bp-new-form');
    const timer = window.setTimeout(() => setHighlight(''), 1600);
    return () => window.clearTimeout(timer);
  }, [data]);

  const forms = data?.forms ?? [];
  const people = data?.people ?? [];
  const kpis = data?.kpis;
  const pagePeople = people.slice(0, 10);

  if (isPending) return <ListPageSkeleton />;

  return (
    <div className="flex flex-col gap-4">
      <PageHeaderActions>
        {canMutate ? (
          <Button type="button" onClick={() => navigate('/participants/forms/new')}>
            <PlusIcon />
            Create registration form
          </Button>
        ) : null}
      </PageHeaderActions>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Registration forms" value={kpis?.forms ?? 0} />
        <Kpi label="Live links" value={kpis?.liveLinks ?? 0} />
        <Kpi label="Participants" value={kpis?.participants ?? 0} />
        <Kpi label="Forms with no quiz yet" value={kpis?.formsWithoutQuiz ?? 0} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Registration forms</CardTitle>
          <CardDescription>
            One per contest. Open a form to see it, assign an activity, or edit it.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {forms.length === 0 ? (
            <p className="px-6 text-sm text-muted-foreground">No registration forms yet.</p>
          ) : (
            <ul>
              {forms.map((form) => {
                const link = form.slug ? registrationUrl(form.slug) : 'Not live yet';
                return (
                  <li key={form.id}>
                    <div
                      role="link"
                      tabIndex={0}
                      className={`grid cursor-pointer grid-cols-1 gap-3 border-t border-border px-6 py-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto] md:items-center ${highlight === form.id ? 'bg-accent' : ''}`}
                      onClick={() => navigate(`/participants/forms/${form.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') navigate(`/participants/forms/${form.id}`);
                      }}
                    >
                      <div>
                        <p className="font-medium">{form.contestName || 'Draft form'}</p>
                        <p className="text-sm text-muted-foreground">
                          {form.sponsorName || form.status}
                        </p>
                      </div>
                      <div className="flex min-w-0 items-center gap-2">
                        <code className="truncate text-sm text-primary">{link}</code>
                        {form.slug ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={(event) => {
                              event.stopPropagation();
                              void navigator.clipboard.writeText(link);
                              toast.success('Link copied');
                            }}
                          >
                            Copy
                          </Button>
                        ) : null}
                      </div>
                      <div className="text-sm">
                        {form.quizzes.length === 0 ? (
                          <span className="text-warning">No quiz yet</span>
                        ) : (
                          <span>
                            {form.quizzes.length} {form.quizzes.length === 1 ? 'quiz' : 'quizzes'}
                            <span className="mt-1 block text-muted-foreground">
                              {form.quizzes.map((quiz) => quiz.name).join(', ')}
                            </span>
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {canMutate && form.quizzes.length === 0 && form.status === 'saved' ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={(event) => {
                              event.stopPropagation();
                              setGiveForm(form);
                            }}
                          >
                            Assign activity
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/participants/forms/${form.id}`);
                          }}
                        >
                          Open
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            {people.length} {people.length === 1 ? 'participant' : 'participants'}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Registration ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Sponsor</TableHead>
                  <TableHead>Contest</TableHead>
                  <TableHead>Quizzes given</TableHead>
                  <TableHead>Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagePeople.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      No one has registered through a form yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  pagePeople.map((person) => (
                    <TableRow key={person.id}>
                      <TableCell className="tabular-nums">{person.code}</TableCell>
                      <TableCell className="font-medium">{person.name}</TableCell>
                      <TableCell>{person.email}</TableCell>
                      <TableCell>{person.sponsorName}</TableCell>
                      <TableCell>{person.contestName}</TableCell>
                      <TableCell>{person.quizzesGiven}</TableCell>
                      <TableCell>{formatIst(person.registeredAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <p className="px-6 pt-3 text-sm text-muted-foreground">
            Showing {pagePeople.length === 0 ? 0 : 1} to {pagePeople.length} of {people.length}{' '}
            participants
          </p>
        </CardContent>
      </Card>
      <GiveQuizDialog
        form={giveForm}
        open={Boolean(giveForm)}
        onOpenChange={(open) => {
          if (!open) setGiveForm(null);
        }}
        onGiven={() => {
          void queryClient.invalidateQueries({ queryKey: ['admin', 'contest-forms'] });
        }}
      />
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
