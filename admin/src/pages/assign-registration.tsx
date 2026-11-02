import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeftIcon } from 'lucide-react';
import { FormPageSkeleton } from '@/components/loading-skeletons';
import { ApiError } from '@/lib/api-client';
import { useLeaveGuard } from '@/hooks/use-leave-guard';
import { useOrgId } from '@/hooks/use-org-id';
import { adminQueryKeys } from '@/lib/query-keys';
import { SaveButton } from '@/components/save-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { assignRegistrations, getActivities, getParticipants, type ActivityKind } from '@/services';
import type { Activity, Participant } from '@/services/types';

const EMPTY_ACTIVITIES: Activity[] = [];
const EMPTY_PARTICIPANTS: Participant[] = [];

export function AssignRegistrationPage({ kind }: { kind: ActivityKind }) {
  const navigate = useNavigate();
  const orgId = useOrgId();
  const isQuiz = kind === 'quiz';
  const listPath = isQuiz ? '/quizzes/registrations' : '/assessments/registrations';
  const { data: activitiesData, isPending: activitiesLoading } = useQuery({
    queryKey: adminQueryKeys.activities(orgId, kind),
    queryFn: () => getActivities(kind),
    enabled: Boolean(orgId),
  });
  const { data: participantsData, isPending: participantsLoading } = useQuery({
    queryKey: adminQueryKeys.participants(orgId),
    queryFn: () => getParticipants(),
    enabled: Boolean(orgId),
  });
  const activities = activitiesData ?? EMPTY_ACTIVITIES;
  const participants = participantsData ?? EMPTY_PARTICIPANTS;
  const loading = activitiesLoading || participantsLoading;
  const [activityId, setActivityId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const allowLeave = useLeaveGuard(dirty);

  const activityOptions = useMemo(
    () =>
      activities.filter((a) => {
        const status = a.status.toLowerCase();
        return status === 'active' || status === 'draft';
      }),
    [activities],
  );

  function toggle(id: string, on: boolean) {
    setDirty(true);
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!activityId || selected.size === 0) {
      toast.error('Select an activity and at least one participant.');
      return;
    }
    setSaving(true);
    try {
      await assignRegistrations(activityId, [...selected]);
      toast.success('Participants assigned.');
      allowLeave();
      void navigate(listPath);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not assign participants.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <div>
          <Button asChild variant="ghost" className="-ml-3 mb-1">
            <Link to={listPath}>
              <ArrowLeftIcon data-icon="inline-start" /> Back to registrations
            </Link>
          </Button>
          <h2 className="text-xl font-semibold tracking-tight">Assign Participants</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Assign participants to a {isQuiz ? 'quiz' : 'assessment'} so they can attempt it in the
            participant portal.
          </p>
        </div>
        <FormPageSkeleton fields={4} />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div>
        <Button asChild variant="ghost" className="-ml-3 mb-1">
          <Link to={listPath}>
            <ArrowLeftIcon data-icon="inline-start" /> Back to registrations
          </Link>
        </Button>
        <h2 className="text-xl font-semibold tracking-tight">Assign Participants</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Assign participants to a {isQuiz ? 'quiz' : 'assessment'} so they can attempt it in the
          participant portal.
        </p>
      </div>
      <Card>
        <CardHeader className="border-b border-border/70">
          <CardTitle>Assignment</CardTitle>
          <CardDescription>Only active or draft activities are listed.</CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <form onSubmit={onSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel>Activity</FieldLabel>
                <Select
                  value={activityId}
                  onValueChange={(value) => {
                    setDirty(true);
                    setActivityId(value);
                  }}
                >
                  <SelectTrigger aria-label="Activity">
                    <SelectValue placeholder="Select activity" />
                  </SelectTrigger>
                  <SelectContent>
                    {activityOptions.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Participants</FieldLabel>
                <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border p-3">
                  {participants.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No participants found.</p>
                  ) : (
                    participants.map((s) => (
                      <label key={s.id} className="flex items-center gap-3 text-sm">
                        <Checkbox
                          checked={selected.has(s.id)}
                          onCheckedChange={(checked) => toggle(s.id, checked === true)}
                          aria-label={`Select ${s.name}`}
                        />
                        <span className="font-medium">{s.name}</span>
                        <span className="text-muted-foreground">
                          {s.code} · {s.email}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </Field>
              <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                <Button type="button" variant="outline" onClick={() => void navigate(listPath)}>
                  Cancel
                </Button>
                <SaveButton pending={saving} pendingLabel="Assigning…">
                  Assign selected
                </SaveButton>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
