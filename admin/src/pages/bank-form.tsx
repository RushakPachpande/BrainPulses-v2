import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeftIcon, SaveIcon } from 'lucide-react';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { addBankQuestion, createQuestionBank, type ActivityKind } from '@/services';

export function BankFormPage({ kind }: { kind: ActivityKind }) {
  const navigate = useNavigate();
  const isQuiz = kind === 'quiz';
  const base = isQuiz ? '/quizzes/banks' : '/assessments/banks';
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [stem, setStem] = useState('Sample question stem?');
  const [optA, setOptA] = useState('Option A');
  const [optB, setOptB] = useState('Option B');
  const [optC, setOptC] = useState('Option C');
  const [optD, setOptD] = useState('Option D');
  const [correct, setCorrect] = useState<'A' | 'B' | 'C' | 'D'>('B');
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const bank = await createQuestionBank({
        kind,
        name: name.trim(),
        description: description.trim() || undefined,
      });
      const options = [
        { label: 'A', body: optA, isCorrect: correct === 'A' },
        { label: 'B', body: optB, isCorrect: correct === 'B' },
        { label: 'C', body: optC, isCorrect: correct === 'C' },
        { label: 'D', body: optD, isCorrect: correct === 'D' },
      ];
      await addBankQuestion(bank.id, {
        type: 'single_mcq',
        stem: stem.trim(),
        options,
        answerKey: { correctLabels: [correct] },
      });
      toast.success('Question bank created with a starter question.');
      void navigate(base);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create question bank.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div>
        <Button asChild variant="ghost" className="-ml-3 mb-1">
          <Link to={base}>
            <ArrowLeftIcon data-icon="inline-start" /> Back to question banks
          </Link>
        </Button>
        <h2 className="text-xl font-semibold tracking-tight">Create Question Bank</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Creates a bank and one starter MCQ so the bank can be attached to activities.
        </p>
      </div>
      <Card>
        <CardHeader className="border-b border-border/70">
          <CardTitle>Bank details</CardTitle>
          <CardDescription>{isQuiz ? 'Quiz' : 'Assessment'} question bank</CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <form onSubmit={onSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="bank-name">
                  Name <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="bank-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="bank-description">Description</FieldLabel>
                <Textarea
                  id="bank-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="bank-stem">
                  Starter question <span className="text-destructive">*</span>
                </FieldLabel>
                <Textarea
                  id="bank-stem"
                  value={stem}
                  onChange={(e) => setStem(e.target.value)}
                  required
                />
              </Field>
              {(['A', 'B', 'C', 'D'] as const).map((label) => (
                <Field key={label}>
                  <FieldLabel htmlFor={`opt-${label}`}>
                    Option {label}{' '}
                    <button
                      type="button"
                      className="ml-2 text-xs text-primary underline"
                      onClick={() => setCorrect(label)}
                    >
                      {correct === label ? 'Correct' : 'Mark correct'}
                    </button>
                  </FieldLabel>
                  <Input
                    id={`opt-${label}`}
                    value={{ A: optA, B: optB, C: optC, D: optD }[label]}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (label === 'A') setOptA(v);
                      if (label === 'B') setOptB(v);
                      if (label === 'C') setOptC(v);
                      if (label === 'D') setOptD(v);
                    }}
                    required
                  />
                </Field>
              ))}
              <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                <Button type="button" variant="outline" onClick={() => void navigate(base)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  <SaveIcon data-icon="inline-start" />
                  {saving ? 'Saving…' : 'Create bank'}
                </Button>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
