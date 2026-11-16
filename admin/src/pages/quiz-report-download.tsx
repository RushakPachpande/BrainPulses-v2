import { useState } from 'react';
import { toast } from 'sonner';
import { downloadQuizReport } from '@/services/quiz-reports';
import { ApiError } from '@/lib/api-client';
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

const QUIZ_ABSENT_HINT =
  'Adds registered participants with no submitted attempt (Not started, and In progress while the quiz is active). Their score columns are left blank.';

export function QuizReportDownloadDialog({
  open,
  onOpenChange,
  query,
  completed,
  registered,
  columnCount,
  onDownloadReport = downloadQuizReport,
  absentHint = QUIZ_ABSENT_HINT,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  completed: number;
  registered: number;
  columnCount: number;
  onDownloadReport?: (query: string) => Promise<void>;
  absentHint?: string;
}) {
  const [includeAbsent, setIncludeAbsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const count = includeAbsent ? registered : completed;

  async function onDownload() {
    const params = new URLSearchParams(query);
    params.delete('page');
    params.delete('pageSize');
    params.set('format', 'xlsx');
    params.set('includeAbsent', includeAbsent ? 'true' : 'false');
    setBusy(true);
    try {
      await onDownloadReport(params.toString());
      toast.success('Excel file downloaded');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't create the file. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setIncludeAbsent(false);
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Download report</DialogTitle>
          <DialogDescription>
            Downloads an Excel file with the {count} participants matching your current filters and
            search. Each row is the participant&apos;s best attempt. Columns: the {columnCount}{' '}
            shown in the table (change them with the Columns button).
          </DialogDescription>
        </DialogHeader>
        <label className="flex items-start gap-3 rounded-lg border border-input p-3">
          <Checkbox
            checked={includeAbsent}
            onCheckedChange={(checked) => setIncludeAbsent(checked === true)}
            aria-label="Include participants who haven't appeared"
          />
          <span className="text-sm">
            <span className="font-medium">Include participants who haven&apos;t appeared</span>
            <span className="mt-1 block text-muted-foreground">{absentHint}</span>
          </span>
        </label>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={busy} onClick={() => void onDownload()}>
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
