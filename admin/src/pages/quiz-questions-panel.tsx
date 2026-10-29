import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { DownloadIcon, FileSpreadsheetIcon, PlusIcon, UploadIcon } from 'lucide-react';
import { ImportResultDialog } from '@/components/import-result-dialog';
import {
  importResultFromCounts,
  importResultFromError,
  type ImportResultView,
} from '@/components/import-result';
import { RowActions } from '@/components/row-actions';
import { AccountStatusPill } from '@/components/status-pill';
import { Toolbar, type ToolbarFilter } from '@/components/toolbar';
import { useConfirm } from '@/components/use-confirm';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
  downloadBankQuestionsSample,
  exportBankQuestions,
  getQuestionBank,
  importBankQuestions,
  setBankQuestionsActive,
  updateBankQuestion,
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
import { bankQuestionTypeLabel } from './bank-question-types';

type DialogMode =
  | null
  | { kind: 'add' }
  | { kind: 'edit'; questionId: string }
  | { kind: 'view'; questionId: string };

function isQuestionActive(item: BankQuestionItem) {
  return item.isActive !== false;
}

export function QuizQuestionsPanel({
  bankId,
  readOnly,
  onEnsureBank,
  onCount,
}: {
  bankId: string | null;
  readOnly: boolean;
  onEnsureBank: () => Promise<string | null>;
  onCount?: (count: number) => void;
}) {
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [questions, setQuestions] = useState<BankQuestionItem[]>([]);
  const [loading, setLoading] = useState(Boolean(bankId));
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [bulkAction, setBulkAction] = useState<'activate' | 'deactivate' | null>(null);
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [draft, setDraft] = useState<QuestionDraft>(() => emptyDraft('single_mcq'));
  const [importResult, setImportResult] = useState<ImportResultView | null>(null);

  function reportCount(items: BankQuestionItem[]) {
    onCount?.(items.filter((item) => isQuestionActive(item)).length);
  }

  useEffect(() => {
    if (!bankId) {
      setQuestions([]);
      setSelected(new Set());
      setLoading(false);
      onCount?.(0);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const bank = await getQuestionBank(bankId);
        if (cancelled) return;
        setQuestions(bank.items);
        reportCount(bank.items);
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof ApiError ? err.message : 'Could not load questions.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bankId, onCount]);

  async function reload(id: string) {
    const bank = await getQuestionBank(id);
    setQuestions(bank.items);
    reportCount(bank.items);
    setSelected(new Set());
  }

  async function resolveBankId() {
    if (bankId) return bankId;
    return onEnsureBank();
  }

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

  const filters: ToolbarFilter[] = [
    {
      name: 'Status',
      options: ['All', 'Active', 'Inactive'],
      value: statusFilter,
      onValueChange: setStatusFilter,
    },
  ];

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

  async function onSave() {
    if (!dialog || dialog.kind === 'view') return;
    const error = validateDraft(draft, 'quiz');
    if (error) {
      toast.error(error);
      return;
    }
    setSaving(true);
    try {
      const id = await resolveBankId();
      if (!id) return;
      const payload = draftToPayloadForKind(draft, 'quiz');
      if (dialog.kind === 'add') {
        await addBankQuestion(id, payload);
        toast.success('Question added.');
      } else {
        await updateBankQuestion(id, dialog.questionId, payload);
        toast.success('Question updated.');
      }
      await reload(id);
      setDialog(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save question.');
    } finally {
      setSaving(false);
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
    setSaving(true);
    try {
      await updateBankQuestion(bankId, item.id, { isActive });
      toast.success(isActive ? 'Question activated.' : 'Question deactivated.');
      await reload(bankId);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : isActive
            ? 'Could not activate question.'
            : 'Could not deactivate question.',
      );
    } finally {
      setSaving(false);
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
      await reload(bankId);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update questions.');
    } finally {
      setBulkAction(null);
    }
  }

  async function onImportFile(file: File | undefined) {
    if (!file || readOnly) return;
    setImporting(true);
    try {
      const id = await resolveBankId();
      if (!id) return;
      const result = await importBankQuestions(id, file);
      setImportResult(
        importResultFromCounts(
          result.created,
          result.issues.map((issue) => issue.message),
          'question',
        ),
      );
      if (result.created > 0) await reload(id);
    } catch (err) {
      setImportResult(importResultFromError(err));
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function onSample() {
    const id = await resolveBankId();
    if (!id) return;
    try {
      await downloadBankQuestionsSample(id);
      toast.success('Sample Excel downloaded.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not download the sample.');
    }
  }

  async function onExport() {
    if (!bankId || questions.length === 0) return;
    try {
      await exportBankQuestions(bankId, 'xlsx');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not export questions.');
    }
  }

  const activeCount = questions.filter((item) => isQuestionActive(item)).length;

  return (
    <>
      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Questions</CardTitle>
              <CardDescription>
                {loading
                  ? 'Loading questions…'
                  : `${questions.length} question${questions.length === 1 ? '' : 's'} (${activeCount} active). MCQ has one correct option. MSQ shows “Select all that apply.”`}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                aria-label="Import questions file"
                onChange={(event) => void onImportFile(event.target.files?.[0])}
              />
              {!readOnly ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={importing}
                    onClick={() => void onSample()}
                  >
                    <FileSpreadsheetIcon data-icon="inline-start" />
                    Sample Excel
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={importing || saving}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <UploadIcon data-icon="inline-start" />
                    {importing ? 'Importing…' : 'Import'}
                  </Button>
                </>
              ) : null}
              <Button
                type="button"
                variant="outline"
                disabled={!bankId || questions.length === 0}
                onClick={() => void onExport()}
              >
                <DownloadIcon data-icon="inline-start" />
                Export
              </Button>
              {!readOnly ? (
                <Button type="button" disabled={saving} onClick={openAdd}>
                  <PlusIcon data-icon="inline-start" />
                  Add question
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-5">
          {questions.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">
              No questions yet. Add one here, or import a spreadsheet.
            </p>
          ) : (
            <>
              <Toolbar
                filters={filters}
                searchPlaceholder="Search questions"
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
              {filteredQuestions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No questions match this status filter.
                </p>
              ) : (
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
                      {filteredQuestions.map((item) => {
                        const active = isQuestionActive(item);
                        return (
                          <TableRow key={item.id}>
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
                            <TableCell className="max-w-md">
                              <span className="line-clamp-2 font-medium">
                                {item.question.trim() || '(Image question)'}
                              </span>
                              {item.type === 'multiple_mcq' ? (
                                <span className="mt-1 block text-sm text-muted-foreground">
                                  Select all that apply.
                                </span>
                              ) : null}
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
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </CardContent>
        {dialog ? (
          <BankQuestionDialog
            open
            mode={dialog.kind}
            draft={draft}
            saving={saving}
            kind="quiz"
            onOpenChange={(open) => {
              if (!open) setDialog(null);
            }}
            onDraftChange={setDraft}
            onSave={() => void onSave()}
          />
        ) : null}
      </Card>
      <ImportResultDialog
        result={importResult}
        onOpenChange={(open) => {
          if (!open) setImportResult(null);
        }}
      />
    </>
  );
}
