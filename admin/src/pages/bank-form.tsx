import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import {
  ArrowLeftIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  PlusIcon,
  UploadIcon,
} from 'lucide-react';
import { ImportResultDialog } from '@/components/import-result-dialog';
import {
  importResultFromCounts,
  importResultFromError,
  type ImportResultView,
} from '@/components/import-result';
import { FormPageSkeleton } from '@/components/loading-skeletons';
import { RowActions } from '@/components/row-actions';
import { AccountStatusPill } from '@/components/status-pill';
import { useConfirm } from '@/components/use-confirm';
import { Toolbar, type ToolbarFilter } from '@/components/toolbar';
import { ApiError } from '@/lib/api-client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SaveButton } from '@/components/save-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
  downloadBankQuestionsSample,
  exportBankQuestions,
  getQuestionBank,
  importBankQuestions,
  setBankQuestionsActive,
  updateBankQuestion,
  updateQuestionBank,
  type ActivityKind,
  type BankImportResult,
  type BankQuestionItem,
} from '@/services';
import {
  draftFromItem,
  draftToPayloadForKind,
  emptyDraft,
  validateDraft,
  type QuestionDraft,
} from './bank-question-draft';
import { BankQuestionDialog } from './bank-question-form';
import { useLeaveGuard } from '@/hooks/use-leave-guard';
import { bankQuestionTypeLabel, isQuizAllowedType } from './bank-question-types';

type DialogMode =
  | null
  | { kind: 'add' }
  | { kind: 'edit'; questionId: string }
  | { kind: 'view'; questionId: string };

function isQuestionActive(item: BankQuestionItem) {
  return item.isActive !== false;
}

export function BankFormPage({
  kind,
  mode = 'create',
}: {
  kind: ActivityKind;
  mode?: 'create' | 'edit' | 'view';
}) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { bankId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const isQuiz = kind === 'quiz';
  const base = isQuiz ? '/quizzes/banks' : '/assessments/banks';
  const readOnly = mode === 'view';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importAutoOpened = useRef(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<BankQuestionItem[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkAction, setBulkAction] = useState<'activate' | 'deactivate' | null>(null);
  const [savingMeta, setSavingMeta] = useState(false);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const allowLeave = useLeaveGuard(!readOnly && dirty);
  const [loading, setLoading] = useState(mode !== 'create');
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [draft, setDraft] = useState<QuestionDraft>(emptyDraft());
  const [importResult, setImportResult] = useState<ImportResultView | null>(null);

  async function reloadBank(id: string) {
    const bank = await getQuestionBank(id);
    setName(bank.name);
    setDescription(bank.description);
    setQuestions(bank.items);
    setSelected(new Set());
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

  useEffect(() => {
    if (readOnly || mode !== 'edit' || loading || !bankId) return;
    if (searchParams.get('import') !== '1') return;
    if (importAutoOpened.current) return;
    importAutoOpened.current = true;
    const next = new URLSearchParams(searchParams);
    next.delete('import');
    setSearchParams(next, { replace: true });
    queueMicrotask(() => fileInputRef.current?.click());
  }, [bankId, loading, mode, readOnly, searchParams, setSearchParams]);

  const filteredQuestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return questions.filter((item) => {
      if (statusFilter === 'Active' && !isQuestionActive(item)) return false;
      if (statusFilter === 'Inactive' && isQuestionActive(item)) return false;
      if (!q) return true;
      return (
        item.question.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q)
      );
    });
  }, [questions, search, statusFilter]);

  const filteredIds = filteredQuestions.map((item) => item.id);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const someFilteredSelected = filteredIds.some((id) => selected.has(id));
  const selectedRows = filteredQuestions.filter((item) => selected.has(item.id));
  const activeIds = selectedRows.filter((item) => isQuestionActive(item)).map((item) => item.id);
  const inactiveIds = selectedRows.filter((item) => !isQuestionActive(item)).map((item) => item.id);

  const questionFilters: ToolbarFilter[] = [
    {
      name: 'Status',
      options: ['All', 'Active', 'Inactive'],
      value: statusFilter,
      onValueChange: setStatusFilter,
    },
  ];

  const hasDisallowedQuizTypes = useMemo(
    () => isQuiz && questions.some((q) => !isQuizAllowedType(q.type)),
    [isQuiz, questions],
  );

  function closeDialog() {
    setDialog(null);
    setDraft(emptyDraft());
  }

  function openAdd() {
    setDraft(emptyDraft('single_mcq'));
    setDialog({ kind: 'add' });
  }

  function openEdit(item: BankQuestionItem) {
    if (isQuiz && !isQuizAllowedType(item.type)) {
      toast.error('This question type is not editable in quiz banks. View only.');
      openView(item);
      return;
    }
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
        setDirty(false);
        return;
      }

      const bank = await createQuestionBank({
        kind,
        name: trimmed,
        description: description.trim() || undefined,
      });
      toast.success('Question bank created.');
      allowLeave();
      void navigate(`${base}/${bank.id}/edit`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save question bank.');
    } finally {
      setSavingMeta(false);
    }
  }

  async function onSaveQuestion() {
    if (readOnly || !bankId || !dialog || dialog.kind === 'view') return;
    const error = validateDraft(draft, kind);
    if (error) {
      toast.error(error);
      return;
    }
    const payload = draftToPayloadForKind(draft, kind);
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

  async function setOneActive(item: BankQuestionItem, isActive: boolean) {
    if (readOnly || !bankId) return;
    const ok = await confirm({
      title: isActive ? 'Activate this question?' : 'Deactivate this question?',
      description: isActive
        ? 'It will appear in new attempts again.'
        : 'It will no longer appear in new attempts.',
      confirmLabel: isActive ? 'Activate' : 'Deactivate',
      destructive: !isActive,
    });
    if (!ok) return;
    setSavingQuestion(true);
    try {
      await updateBankQuestion(bankId, item.id, { isActive });
      toast.success(isActive ? 'Question activated.' : 'Question deactivated.');
      if (dialog && 'questionId' in dialog && dialog.questionId === item.id) closeDialog();
      await reloadBank(bankId);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : isActive
            ? 'Could not activate question.'
            : 'Could not deactivate question.',
      );
    } finally {
      setSavingQuestion(false);
    }
  }

  async function changeSelectedStatus(kind: 'activate' | 'deactivate') {
    if (!bankId || readOnly || bulkAction) return;
    const activating = kind === 'activate';
    const ids = activating ? inactiveIds : activeIds;
    if (ids.length === 0) return;
    const ok = await confirm({
      title:
        ids.length === 1
          ? activating
            ? 'Activate 1 question?'
            : 'Deactivate 1 question?'
          : activating
            ? `Activate ${ids.length} questions?`
            : `Deactivate ${ids.length} questions?`,
      description: activating
        ? 'They will appear in new attempts again.'
        : 'They will no longer appear in new attempts.',
      confirmLabel: activating ? 'Activate' : 'Deactivate',
      destructive: !activating,
    });
    if (!ok) return;
    setBulkAction(kind);
    try {
      const result = await setBankQuestionsActive(bankId, ids, activating);
      toast.success(
        result.updated === 1
          ? activating
            ? 'Question activated.'
            : 'Question deactivated.'
          : activating
            ? `${result.updated} questions activated.`
            : `${result.updated} questions deactivated.`,
      );
      await reloadBank(bankId);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update questions.');
    } finally {
      setBulkAction(null);
    }
  }

  function showImportResult(result: BankImportResult) {
    setImportResult(
      importResultFromCounts(
        result.created,
        result.issues.map((i) => i.message),
        'question',
      ),
    );
  }

  async function onSampleDownload() {
    if (!bankId) return;
    try {
      await downloadBankQuestionsSample(bankId);
      toast.success('Sample Excel downloaded.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not download sample.');
    }
  }

  async function onExport() {
    if (!bankId) return;
    if (questions.length === 0) {
      toast.message('No questions to export. Download the sample Excel to get started.');
      return;
    }
    try {
      await exportBankQuestions(bankId, 'xlsx');
      toast.success('Questions exported.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not export questions.');
    }
  }

  async function onImportFile(file: File | undefined) {
    if (!file || !bankId || readOnly) return;
    setImporting(true);
    try {
      const result = await importBankQuestions(bankId, file);
      showImportResult(result);
      if (result.created > 0) await reloadBank(bankId);
    } catch (err) {
      setImportResult(importResultFromError(err));
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
          <form onSubmit={(e) => void onSaveMeta(e)} onChange={() => setDirty(true)}>
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
                  <SaveButton pending={savingMeta}>
                    {mode === 'edit' ? 'Save changes' : 'Create bank'}
                  </SaveButton>
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
                  {questions.length > 0
                    ? ` (${questions.filter((q) => isQuestionActive(q)).length} active)`
                    : ''}
                  {isQuiz ? ' · MCQ (one option) or MSQ (multiple options)' : ''}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {!readOnly ? (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      className="sr-only"
                      aria-hidden
                      tabIndex={-1}
                      onChange={(e) => void onImportFile(e.target.files?.[0])}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={importing}
                      onClick={() => void onSampleDownload()}
                    >
                      <FileSpreadsheetIcon data-icon="inline-start" />
                      Sample Excel
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={importing}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <UploadIcon data-icon="inline-start" />
                      {importing ? 'Importing…' : 'Import'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={importing || questions.length === 0}
                      onClick={() => void onExport()}
                    >
                      <DownloadIcon data-icon="inline-start" />
                      Export
                    </Button>
                    <Button type="button" variant="outline" onClick={openAdd}>
                      <PlusIcon data-icon="inline-start" />
                      Add question
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={questions.length === 0}
                    onClick={() => void onExport()}
                  >
                    <DownloadIcon data-icon="inline-start" />
                    Export
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-5">
            {hasDisallowedQuizTypes ? (
              <Alert>
                <AlertTitle>Legacy question types</AlertTitle>
                <AlertDescription>
                  This quiz has questions that are not MCQ or MSQ. They remain available for
                  attempts but can only be viewed here. New questions must be MCQ or MSQ.
                </AlertDescription>
              </Alert>
            ) : null}
            {questions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No questions yet.
                {!readOnly ? ' Use Add question, or Import from Sample Excel.' : null}
              </p>
            ) : (
              <>
                <Toolbar
                  filters={questionFilters}
                  searchPlaceholder="Search question or code"
                  searchValue={search}
                  onSearchChange={setSearch}
                  actions={
                    !readOnly && selected.size > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {inactiveIds.length > 0 ? (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={Boolean(bulkAction)}
                            onClick={() => void changeSelectedStatus('activate')}
                          >
                            Activate{inactiveIds.length > 1 ? ` (${inactiveIds.length})` : ''}
                          </Button>
                        ) : null}
                        {activeIds.length > 0 ? (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={Boolean(bulkAction)}
                            onClick={() => void changeSelectedStatus('deactivate')}
                          >
                            Deactivate{activeIds.length > 1 ? ` (${activeIds.length})` : ''}
                          </Button>
                        ) : null}
                      </div>
                    ) : undefined
                  }
                />
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {!readOnly ? (
                          <TableHead className="w-10">
                            <Checkbox
                              checked={
                                allFilteredSelected
                                  ? true
                                  : someFilteredSelected
                                    ? 'indeterminate'
                                    : false
                              }
                              onCheckedChange={(value) => {
                                const checked = value === true;
                                setSelected((prev) => {
                                  const next = new Set(prev);
                                  for (const id of filteredIds) {
                                    if (checked) next.add(id);
                                    else next.delete(id);
                                  }
                                  return next;
                                });
                              }}
                              aria-label="Select all questions on this list"
                            />
                          </TableHead>
                        ) : null}
                        <TableHead>Code</TableHead>
                        <TableHead>Question</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Points</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-12">
                          <span className="sr-only">Actions</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredQuestions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={readOnly ? 6 : 7} className="text-muted-foreground">
                            No questions match this filter.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredQuestions.map((item) => {
                          const active = isQuestionActive(item);
                          return (
                            <TableRow
                              key={item.id}
                              className="cursor-pointer"
                              onClick={(event) => {
                                const target = event.target;
                                if (
                                  target instanceof Element &&
                                  target.closest(
                                    'a, button, input, label, [data-slot="record-actions"]',
                                  )
                                ) {
                                  return;
                                }
                                if (readOnly) openView(item);
                                else openEdit(item);
                              }}
                            >
                              {!readOnly ? (
                                <TableCell>
                                  <Checkbox
                                    checked={selected.has(item.id)}
                                    onCheckedChange={(value) => {
                                      const checked = value === true;
                                      setSelected((prev) => {
                                        const next = new Set(prev);
                                        if (checked) next.add(item.id);
                                        else next.delete(item.id);
                                        return next;
                                      });
                                    }}
                                    aria-label={`Select question ${item.code || item.id}`}
                                  />
                                </TableCell>
                              ) : null}
                              <TableCell className="whitespace-nowrap font-medium">
                                {item.code || '—'}
                              </TableCell>
                              <TableCell className="max-w-md">
                                <span className="line-clamp-2 font-medium">
                                  {item.question.trim() || '(Image question)'}
                                </span>
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {bankQuestionTypeLabel(item.type)}
                              </TableCell>
                              <TableCell>{item.points}</TableCell>
                              <TableCell>
                                <AccountStatusPill value={active ? 'Active' : 'Inactive'} />
                              </TableCell>
                              <TableCell>
                                {readOnly ? (
                                  <RowActions view={{ onClick: () => openView(item) }} />
                                ) : (
                                  <RowActions
                                    edit={{ onClick: () => openEdit(item) }}
                                    activate={
                                      active
                                        ? undefined
                                        : { onClick: () => void setOneActive(item, true) }
                                    }
                                    deactivate={
                                      active
                                        ? { onClick: () => void setOneActive(item, false) }
                                        : undefined
                                    }
                                  />
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
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
          kind={kind}
          passageSharedCount={
            dialog.kind === 'add'
              ? undefined
              : questions.find((question) => question.id === dialog.questionId)?.passageSharedCount
          }
          onOpenChange={(open) => {
            if (!open) closeDialog();
          }}
          onDraftChange={setDraft}
          onSave={() => void onSaveQuestion()}
        />
      ) : null}

      <ImportResultDialog
        result={importResult}
        onOpenChange={(open) => {
          if (!open) setImportResult(null);
        }}
      />
    </div>
  );
}
