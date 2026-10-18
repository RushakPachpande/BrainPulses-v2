import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeftIcon, SaveIcon } from 'lucide-react';
import { FormPageSkeleton } from '@/components/loading-skeletons';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  addBankQuestion,
  createQuestionBank,
  getQuestionBank,
  updateQuestionBank,
  type ActivityKind,
} from '@/services';

export function BankFormPage({
  kind,
  mode = 'create',
}: {
  kind: ActivityKind;
  mode?: 'create' | 'edit' | 'view';
}) {
  const navigate = useNavigate();
  const { bankId = '' } = useParams();
  const isQuiz = kind === 'quiz';
  const base = isQuiz ? '/quizzes/banks' : '/assessments/banks';
  const readOnly = mode === 'view';
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [stem, setStem] = useState('Sample question stem?');
  const [optA, setOptA] = useState('Option A');
  const [optB, setOptB] = useState('Option B');
  const [optC, setOptC] = useState('Option C');
  const [optD, setOptD] = useState('Option D');
  const [correct, setCorrect] = useState<'A' | 'B' | 'C' | 'D'>('B');
  const [questions, setQuestions] = useState<{ id: string; stem: string; type: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(mode !== 'create');
  const [createdBankId, setCreatedBankId] = useState<string | null>(
    mode === 'create' ? null : bankId,
  );

  useEffect(() => {
    if (mode === 'create') return;
    let cancelled = false;
    (async () => {
      try {
        const bank = await getQuestionBank(bankId);
        if (cancelled) return;
        setName(bank.name);
        setDescription(bank.description);
        setCreatedBankId(bank.id);
        setQuestions((bank.items ?? []).map((q) => ({ id: q.id, stem: q.stem, type: q.type })));
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Could not load question bank.');
        void navigate(base);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bankId, base, mode, navigate]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (readOnly) return;
    setSaving(true);
    try {
      if (mode === 'edit' && createdBankId) {
        await updateQuestionBank(createdBankId, {
          name: name.trim(),
          description: description.trim() || undefined,
        });
        toast.success('Question bank updated.');
        void navigate(base);
        return;
      }

      let id = createdBankId;
      if (!id) {
        const bank = await createQuestionBank({
          kind,
          name: name.trim(),
          description: description.trim() || undefined,
        });
        id = bank.id;
        setCreatedBankId(bank.id);
      }
      const options = [
        { label: 'A', body: optA, isCorrect: correct === 'A' },
        { label: 'B', body: optB, isCorrect: correct === 'B' },
        { label: 'C', body: optC, isCorrect: correct === 'C' },
        { label: 'D', body: optD, isCorrect: correct === 'D' },
      ];
      await addBankQuestion(id, {
        type: 'single_mcq',
        stem: stem.trim(),
        options,
        answerKey: { correctLabels: [correct] },
      });
      toast.success('Question bank created with a starter question.');
      void navigate(base);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save question bank.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <FormPageSkeleton fields={4} />;

  const title =
    mode === 'create'
      ? 'Create Question Bank'
      : mode === 'edit'
        ? 'Edit Question Bank'
        : 'View Question Bank';

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button asChild variant="ghost" className="-ml-3 mb-1">
            <Link to={base}>
              <ArrowLeftIcon data-icon="inline-start" /> Back to question banks
            </Link>
          </Button>
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === 'create'
              ? 'Creates a bank and one starter MCQ so the bank can be attached to activities.'
              : 'Question bank details and items.'}
          </p>
        </div>
        {mode === 'view' ? (
          <Button asChild>
            <Link to={`${base}/${bankId}/edit`}>Edit</Link>
          </Button>
        ) : null}
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
                  disabled={readOnly}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="bank-description">Description</FieldLabel>
                <Textarea
                  id="bank-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={readOnly}
                />
              </Field>

              {mode !== 'create' && questions.length > 0 ? (
                <div className="rounded-lg border border-border p-3">
                  <p className="mb-2 text-sm font-medium">Questions ({questions.length})</p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {questions.map((q) => (
                      <li key={q.id}>
                        <span className="text-foreground">{q.stem}</span> · {q.type}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {mode === 'create' ? (
                <>
                  <Field>
                    <FieldLabel htmlFor="stem">Starter question stem</FieldLabel>
                    <Input
                      id="stem"
                      value={stem}
                      onChange={(e) => setStem(e.target.value)}
                      required
                    />
                  </Field>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Field>
                      <FieldLabel>Option A</FieldLabel>
                      <Input value={optA} onChange={(e) => setOptA(e.target.value)} required />
                    </Field>
                    <Field>
                      <FieldLabel>Option B</FieldLabel>
                      <Input value={optB} onChange={(e) => setOptB(e.target.value)} required />
                    </Field>
                    <Field>
                      <FieldLabel>Option C</FieldLabel>
                      <Input value={optC} onChange={(e) => setOptC(e.target.value)} required />
                    </Field>
                    <Field>
                      <FieldLabel>Option D</FieldLabel>
                      <Input value={optD} onChange={(e) => setOptD(e.target.value)} required />
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="correct">Correct option</FieldLabel>
                    <Input
                      id="correct"
                      value={correct}
                      onChange={(e) =>
                        setCorrect((e.target.value.toUpperCase() as 'A' | 'B' | 'C' | 'D') || 'A')
                      }
                      maxLength={1}
                    />
                  </Field>
                </>
              ) : null}

              {!readOnly ? (
                <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                  <Button type="button" variant="outline" onClick={() => void navigate(base)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    <SaveIcon data-icon="inline-start" />
                    {saving ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Create bank'}
                  </Button>
                </div>
              ) : null}
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
