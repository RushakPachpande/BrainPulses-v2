import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeftIcon, SaveIcon } from 'lucide-react';
import { FormPageSkeleton } from '@/components/loading-skeletons';
import { ApiError } from '@/lib/api-client';
import { useAsyncService } from '@/hooks/use-async-service';
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
import { assignRegistrations, getActivities, getStudents, type ActivityKind } from '@/services';
import type { Activity, Student } from '@/services/types';

const EMPTY_ACTIVITIES: Activity[] = [];
const EMPTY_STUDENTS: Student[] = [];

export function AssignRegistrationPage({ kind }: { kind: ActivityKind }) {
  const navigate = useNavigate();
  const isQuiz = kind === 'quiz';
  const listPath = isQuiz ? '/quizzes/registrations' : '/assessments/registrations';
  const { data: activitiesData, loading: activitiesLoading } = useAsyncService(
    () => getActivities(kind),
    [kind],
  );
  const { data: studentsData, loading: studentsLoading } = useAsyncService(() => getStudents(), []);
  const activities = activitiesData ?? EMPTY_ACTIVITIES;
  const students = studentsData ?? EMPTY_STUDENTS;
  const loading = activitiesLoading || studentsLoading;
  const [activityId, setActivityId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);

  const activityOptions = useMemo(
    () =>
      activities.filter((a) => {
        const status = a.status.toLowerCase();
        return status === 'active' || status === 'draft';
      }),
    [activities],
  );

  function toggle(id: string, on: boolean) {
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
      toast.error('Select an activity and at least one student.');
      return;
    }
    setSaving(true);
    try {
      await assignRegistrations(activityId, [...selected]);
      toast.success('Students assigned.');
      void navigate(listPath);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not assign students.');
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
          <h2 className="text-xl font-semibold tracking-tight">Assign Students</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Assign students to a {isQuiz ? 'quiz' : 'assessment'} so they can attempt it in the
            student portal.
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
        <h2 className="text-xl font-semibold tracking-tight">Assign Students</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Assign students to a {isQuiz ? 'quiz' : 'assessment'} so they can attempt it in the
          student portal.
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
                <Select value={activityId} onValueChange={setActivityId}>
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
                <FieldLabel>Students</FieldLabel>
                <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border p-3">
                  {students.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No students found.</p>
                  ) : (
                    students.map((s) => (
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
                <Button type="submit" disabled={saving}>
                  <SaveIcon data-icon="inline-start" />
                  {saving ? 'Assigning…' : 'Assign selected'}
                </Button>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
