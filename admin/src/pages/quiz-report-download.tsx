import { useState } from 'react';
import { toast } from 'sonner';
import { downloadQuizReport } from '@/services/quiz-reports';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export function QuizReportDownloadDialog({
  open,
  onOpenChange,
  query,
  completed,
  registered,
  columnCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  completed: number;
  registered: number;
  columnCount: number;
}) {
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [includeAbsent, setIncludeAbsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const count = includeAbsent ? registered : completed;

  async function onDownload() {
    const params = new URLSearchParams(query);
    params.delete('page');
    params.delete('pageSize');
    params.set('format', format);
    params.set('includeAbsent', includeAbsent ? 'true' : 'false');
    setBusy(true);
    try {
      await downloadQuizReport(params.toString());
      toast.success(format === 'csv' ? 'CSV file downloaded' : 'Excel file downloaded');
      onOpenChange(false);
    } catch {
      toast.error("Couldn't create the file. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setFormat('xlsx');
          setIncludeAbsent(false);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Download report</DialogTitle>
          <DialogDescription>
            Includes the {count} participants matching your current filters and search. Each row is
            the participant&apos;s best attempt. Columns: the {columnCount} shown in the table
            (change them with the Columns button).
          </DialogDescription>
        </DialogHeader>
        <RadioGroup
          value={format}
          onValueChange={(value) => setFormat(value === 'csv' ? 'csv' : 'xlsx')}
          className="grid gap-2"
        >
          {(
            [
              ['xlsx', 'Excel (.xlsx)'],
              ['csv', 'CSV (.csv)'],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={`flex items-center gap-3 rounded-lg border p-3 ${
                format === value ? 'border-primary bg-accent' : 'border-input'
              }`}
            >
              <RadioGroupItem value={value} />
              <span className="text-sm font-medium">{label}</span>
            </label>
          ))}
        </RadioGroup>
        <label className="flex items-start gap-3 rounded-lg border border-input p-3">
          <Checkbox
            checked={includeAbsent}
            onCheckedChange={(checked) => setIncludeAbsent(checked === true)}
            aria-label="Include participants who haven't appeared"
          />
          <span className="text-sm">
            <span className="font-medium">Include participants who haven&apos;t appeared</span>
            <span className="mt-1 block text-muted-foreground">
              Adds registered participants with no submitted attempt (Not started, and In progress
              while the quiz is active). Their score columns are left blank.
            </span>
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
