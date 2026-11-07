import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError } from '@/lib/api-client';
import { formatIst, type ContestFormQuiz, type ContestFormRecord } from '@/lib/contest-form';
import { getContestQuizzes, giveContestFormQuizzes } from '@/services/contest-forms';

export function GiveQuizDialog({
  form,
  open,
  onOpenChange,
  onGiven,
}: {
  form: ContestFormRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGiven: () => void;
}) {
  const [quizzes, setQuizzes] = useState<ContestFormQuiz[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !form?.contestId) return;
    setPicked([]);
    void getContestQuizzes(form.contestId)
      .then(setQuizzes)
      .catch(() => setQuizzes([]));
  }, [open, form]);

  const given = new Set(form?.quizzes.map((quiz) => quiz.id) ?? []);
  const selectable = picked.filter((id) => !given.has(id));

  async function submit() {
    if (!form || selectable.length === 0) return;
    setBusy(true);
    try {
      await giveContestFormQuizzes(form.id, selectable);
      const names = quizzes
        .filter((quiz) => selectable.includes(quiz.id))
        .map((quiz) => quiz.name)
        .join(', ');
      toast.success(`${names} assigned to ${form.contestName || 'the contest'}.`);
      onOpenChange(false);
      onGiven();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not assign the activity.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign activity</DialogTitle>
          <DialogDescription>
            Everyone registered through the {form?.contestName || 'contest'} form (
            {form?.registrationCount ?? 0} now) and everyone who registers later gets the quizzes
            and assessments you tick.
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-80 flex-col gap-4 overflow-auto">
          {quizzes.length === 0 ? (
            <p className="text-sm text-muted-foreground">This contest has no quizzes yet.</p>
          ) : (
            <>
              <GiveGroup
                title="Quizzes"
                items={quizzes.filter((quiz) => quiz.kind !== 'assessment')}
                given={given}
                picked={picked}
                closesAt={form?.closesAt ?? null}
                onPick={setPicked}
              />
              <GiveGroup
                title="Assessments"
                items={quizzes.filter((quiz) => quiz.kind === 'assessment')}
                given={given}
                picked={picked}
                closesAt={form?.closesAt ?? null}
                onPick={setPicked}
              />
            </>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy || selectable.length === 0}
            onClick={() => void submit()}
          >
            {selectable.length > 1 ? `Assign ${selectable.length} activities` : 'Assign activity'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GiveGroup({
  title,
  items,
  given,
  picked,
  closesAt,
  onPick,
}: {
  title: string;
  items: ContestFormQuiz[];
  given: Set<string>;
  picked: string[];
  closesAt: string | null;
  onPick: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">None for this contest.</p>
      ) : (
        items.map((quiz) => {
          const already = given.has(quiz.id);
          const ended = quiz.availability === 'Ended';
          const disabled = already || ended;
          return (
            <label
              key={quiz.id}
              className={`rounded-lg border border-border p-3 text-sm ${disabled ? 'opacity-60' : ''}`}
            >
              <span className="flex items-start gap-2">
                <Checkbox
                  checked={already || picked.includes(quiz.id)}
                  disabled={disabled}
                  onCheckedChange={(checked) =>
                    onPick(
                      checked ? [...picked, quiz.id] : picked.filter((id) => id !== quiz.id),
                    )
                  }
                />
                <span>
                  <span className="font-medium">{quiz.name}</span>
                  <span className="mt-1 block text-muted-foreground">
                    {quiz.availability}
                    {quiz.startsAt ? ` · ${formatIst(quiz.startsAt)}` : ''}
                    {quiz.endsAt ? ` – ${formatIst(quiz.endsAt)}` : ''}
                  </span>
                  {already ? <span className="block">Already given</span> : null}
                  {ended ? <span className="block">Ended: can't be given</span> : null}
                  {closesAt && quiz.endsAt && new Date(quiz.endsAt) < new Date(closesAt) ? (
                    <span className="block text-warning">
                      Ends before registration closes ({formatIst(closesAt)}). Late registrants
                      can't take it.
                    </span>
                  ) : null}
                </span>
              </span>
            </label>
          );
        })
      )}
    </div>
  );
}
