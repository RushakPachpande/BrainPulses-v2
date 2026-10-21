import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeftIcon, MoreVerticalIcon, PlusIcon, SaveIcon } from 'lucide-react';
import { FormPageSkeleton } from '@/components/loading-skeletons';
import { Toolbar } from '@/components/toolbar';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  addBankQuestion,
  createQuestionBank,
  getQuestionBank,
  updateBankQuestion,
  updateQuestionBank,
  type ActivityKind,
  type BankQuestionItem,
} from '@/services';
import {
  draftFromItem,
  draftToPayload,
  emptyDraft,
  validateDraft,
  type QuestionDraft,
} from './bank-question-draft';
import { BankQuestionDialog } from './bank-question-form';
import { bankQuestionTypeLabel } from './bank-question-types';

type DialogMode =
  | null
  | { kind: 'add' }
  | { kind: 'edit'; questionId: string }
  | { kind: 'view'; questionId: string };

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
  const [questions, setQuestions] = useState<BankQuestionItem[]>([]);
  const [search, setSearch] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [loading, setLoading] = useState(mode !== 'create');
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [draft, setDraft] = useState<QuestionDraft>(emptyDraft());

  async function reloadBank(id: string) {
    const bank = await getQuestionBank(id);
    setName(bank.name);
    setDescription(bank.description);
    setQuestions(bank.items);
    return bank;
  }

  useEffect(() => {
    if (mode === 'create') return;
    let cancelled = false;
    (async () => {
      try {
        await reloadBank(bankId);
        if (cancelled) return;
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

  const filteredQuestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return questions;
    return questions.filter(
      (item) =>
        item.stem.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q),
    );
  }, [questions, search]);

  function closeDialog() {
    setDialog(null);
    setDraft(emptyDraft());
  }

  function openAdd() {
    setDraft(emptyDraft('single_mcq'));
    setDialog({ kind: 'add' });
  }

  function openEdit(item: BankQuestionItem) {
    setDraft(draftFromItem(item));
    setDialog({ kind: 'edit', questionId: item.id });
  }

  function openView(item: BankQuestionItem) {
    setDraft(draftFromItem(item));
    setDialog({ kind: 'view', questionId: item.id });
  }

  async function onSaveMeta(event: FormEvent) {
    event.preventDefault();
    if (readOnly) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Name is required.');
      return;
    }
    setSavingMeta(true);
    try {
      if (mode === 'edit' && bankId) {
        await updateQuestionBank(bankId, {
          name: trimmed,
          description: description.trim() || undefined,
        });
        toast.success('Question bank updated.');
        return;
      }

      const bank = await createQuestionBank({
        kind,
        name: trimmed,
        description: description.trim() || undefined,
      });
      toast.success('Question bank created.');
      void navigate(`${base}/${bank.id}/edit`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save question bank.');
    } finally {
      setSavingMeta(false);
    }
  }

  async function onSaveQuestion() {
    if (readOnly || !bankId || !dialog || dialog.kind === 'view') return;
    const error = validateDraft(draft);
    if (error) {
      toast.error(error);
      return;
    }
    const payload = draftToPayload(draft);
    setSavingQuestion(true);
    try {
      if (dialog.kind === 'add') {
        await addBankQuestion(bankId, payload);
        toast.success('Question added.');
      } else {
        await updateBankQuestion(bankId, dialog.questionId, payload);
        toast.success('Question updated.');
      }
      await reloadBank(bankId);
      closeDialog();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save question.');
    } finally {
      setSavingQuestion(false);
    }
  }

  async function onDeactivate(item: BankQuestionItem) {
    if (readOnly || !bankId) return;
    setSavingQuestion(true);
    try {
      await updateBankQuestion(bankId, item.id, { isActive: false });
      toast.success('Question deactivated.');
      if (dialog && 'questionId' in dialog && dialog.questionId === item.id) closeDialog();
      await reloadBank(bankId);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not deactivate question.');
    } finally {
      setSavingQuestion(false);
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
              ? 'Save bank details, then add questions on the edit page.'
              : 'Bank details and questions for this reusable bank.'}
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
          <form onSubmit={(e) => void onSaveMeta(e)}>
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
              {!readOnly ? (
                <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                  <Button type="button" variant="outline" onClick={() => void navigate(base)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={savingMeta}>
                    <SaveIcon data-icon="inline-start" />
                    {savingMeta ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Create bank'}
                  </Button>
                </div>
              ) : null}
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      {mode !== 'create' ? (
        <Card>
          <CardHeader className="border-b border-border/70">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Questions</CardTitle>
                <CardDescription>
                  {questions.length} question{questions.length === 1 ? '' : 's'}
                </CardDescription>
              </div>
              {!readOnly ? (
                <Button type="button" variant="outline" onClick={openAdd}>
                  <PlusIcon data-icon="inline-start" />
                  Add question
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-5">
            {questions.length > 8 ? (
              <Toolbar
                filters={[]}
                searchPlaceholder="Search stem or code"
                searchValue={search}
                onSearchChange={setSearch}
              />
            ) : null}

            {questions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No questions yet.
                {!readOnly ? ' Use Add question to create the first item.' : null}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Stem</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Points</TableHead>
                      <TableHead className="w-12">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredQuestions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground">
                          No questions match this search.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredQuestions.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="whitespace-nowrap font-medium">
                            {item.code || '—'}
                          </TableCell>
                          <TableCell className="max-w-md">
                            <span className="line-clamp-2 font-medium">{item.stem}</span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {bankQuestionTypeLabel(item.type)}
                          </TableCell>
                          <TableCell>{item.points}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Actions for ${item.code || item.stem}`}
                                >
                                  <MoreVerticalIcon />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {readOnly ? (
                                  <DropdownMenuItem onClick={() => openView(item)}>
                                    View
                                  </DropdownMenuItem>
                                ) : (
                                  <>
                                    <DropdownMenuItem onClick={() => openEdit(item)}>
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      variant="destructive"
                                      onClick={() => void onDeactivate(item)}
                                    >
                                      Deactivate
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {dialog ? (
        <BankQuestionDialog
          open
          mode={dialog.kind}
          draft={draft}
          saving={savingQuestion}
          onOpenChange={(open) => {
            if (!open) closeDialog();
          }}
          onDraftChange={setDraft}
          onSave={() => void onSaveQuestion()}
        />
      ) : null}
    </div>
  );
}
