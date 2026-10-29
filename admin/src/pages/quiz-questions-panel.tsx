import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { DownloadIcon, FileSpreadsheetIcon, PlusIcon, UploadIcon } from 'lucide-react';
import { RowActions } from '@/components/row-actions';
import { useConfirm } from '@/components/use-confirm';
import { ApiError } from '@/lib/api-client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import {
  addBankQuestion,
  downloadBankQuestionsSample,
  exportBankQuestions,
  getQuestionBank,
  importBankQuestions,
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
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [draft, setDraft] = useState<QuestionDraft>(() => emptyDraft('single_mcq'));
  const [importIssues, setImportIssues] = useState<string[]>([]);

  useEffect(() => {
    if (!bankId) {
      setQuestions([]);
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
        onCount?.(bank.items.length);
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
    onCount?.(bank.items.length);
  }

  async function resolveBankId() {
    if (bankId) return bankId;
    return onEnsureBank();
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

  async function onSave() {
    if (!dialog || dialog.kind === 'view') return;
    const error = validateDraft(draft);
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

  async function onDeactivate(item: BankQuestionItem) {
    if (readOnly || !bankId) return;
    const ok = await confirm({
      title: 'Deactivate this question?',
      description: 'It will no longer appear in new attempts.',
      confirmLabel: 'Deactivate',
      destructive: true,
    });
    if (!ok) return;
    setSaving(true);
    try {
      await updateBankQuestion(bankId, item.id, { isActive: false });
      toast.success('Question deactivated.');
      await reload(bankId);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not deactivate question.');
    } finally {
      setSaving(false);
    }
  }

  async function onImportFile(file: File | undefined) {
    if (!file || readOnly) return;
    setImporting(true);
    setImportIssues([]);
    try {
      const id = await resolveBankId();
      if (!id) return;
      const result = await importBankQuestions(id, file);
      const issues = result.issues.map((issue) => `Row ${issue.row}: ${issue.message}`);
      setImportIssues(issues);
      if (result.created > 0) {
        toast.success(`${result.created} question${result.created === 1 ? '' : 's'} imported.`);
        await reload(id);
      } else if (issues.length > 0) {
        toast.error('No questions were imported.');
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not import questions.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function onSample() {
    const id = await resolveBankId();
    if (!id) return;
    try {
      await downloadBankQuestionsSample(id, 'xlsx');
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

  return (
    <Card>
      <CardHeader className="border-b border-border/70">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Questions</CardTitle>
            <CardDescription>
              {loading
                ? 'Loading questions…'
                : `${questions.length} question${questions.length === 1 ? '' : 's'}. MCQ has one correct option. MSQ shows “Select all that apply.”`}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
        {importIssues.length > 0 ? (
          <Alert>
            <AlertTitle>Import notes</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {importIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}
        {questions.length === 0 && !loading ? (
          <p className="text-sm text-muted-foreground">
            No questions yet. Add one here, or import a spreadsheet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Question</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questions.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="max-w-md">
                      <span className="line-clamp-2 font-medium">{item.question}</span>
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
                      {readOnly ? (
                        <RowActions view={{ onClick: () => openView(item) }} />
                      ) : (
                        <RowActions
                          edit={{ onClick: () => openEdit(item) }}
                          deactivate={{ onClick: () => void onDeactivate(item) }}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
  );
}
