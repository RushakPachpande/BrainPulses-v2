import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ApiError } from '@/lib/api-client';
import { DateTimePicker } from '@/components/date-time-picker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createActivity, publishActivity, type ActivityKind } from '@/services';

const steps = [
  'Basic Details',
  'Registration Form',
  'Select Question Banks',
  'Assignment Rules',
  'Behaviour Settings',
  'Review & Publish',
];

export function CreateActivityPage({ kind }: { kind: ActivityKind }) {
  const navigate = useNavigate();
  const isQuiz = kind === 'quiz';
  const noun = isQuiz ? 'Quiz' : 'Assessment';
  const listPath = isQuiz ? '/quizzes' : '/assessments';
  const [name, setName] = useState(isQuiz ? 'Weekly GK Quiz' : 'JEE Mock Series 2026');
  const [description, setDescription] = useState(
    isQuiz
      ? 'Short weekly quiz with 20 MCQs to test general awareness.'
      : 'Full-length mock assessment covering Physics, Chemistry and Maths with timed sections.',
  );
  const [status, setStatus] = useState('draft');
  const [startDate, setStartDate] = useState(() => new Date(2026, 9, 15, 10, 0, 0));
  const [endDate, setEndDate] = useState(() => new Date(2026, 9, 30, 18, 0, 0));
  const [saving, setSaving] = useState(false);

  async function saveActivity(publish: boolean) {
    setSaving(true);
    try {
      const created = await createActivity({
        kind,
        name: name.trim(),
        subtitle: description.trim() || undefined,
        startsAt: startDate,
        endsAt: endDate,
      });
      if (publish || status === 'active') {
        await publishActivity(created.id);
      }
      toast.success(`${noun} created.`);
      void navigate(listPath);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : `Could not create ${noun.toLowerCase()}.`,
      );
    } finally {
      setSaving(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void saveActivity(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <ol aria-label="Create progress" className="flex gap-2 overflow-x-auto">
        {steps.map((step, index) => (
          <li
            key={step}
            aria-current={index === 0 ? 'step' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm',
              index === 0 && 'border-primary bg-accent text-accent-foreground',
            )}
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs">
              {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
      <Card>
        <CardHeader>
          <CardTitle>Basic Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="activity-name">
                  {noun} Name <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="activity-name"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="activity-description">Description</FieldLabel>
                <Textarea
                  id="activity-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
                <FieldDescription>Students see this on the start screen.</FieldDescription>
              </Field>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="start-date">
                    Start Date <span className="text-destructive">*</span>
                  </FieldLabel>
                  <DateTimePicker
                    id="start-date"
                    required
                    value={startDate}
                    onChange={setStartDate}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="end-date">
                    End Date <span className="text-destructive">*</span>
                  </FieldLabel>
                  <DateTimePicker id="end-date" required value={endDate} onChange={setEndDate} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="status">Status</FieldLabel>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger id="status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => void saveActivity(false)}
                >
                  Save Draft
                </Button>
                <Button type="submit" disabled={saving}>
                  Next
                </Button>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
