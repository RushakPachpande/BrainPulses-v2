import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ApiError } from '@/lib/api-client';
import { applyQuestionImportUpdates, type QuestionImportUpdate } from '@/services';

export function QuestionImportUpdatesDialog({
  created,
  updates,
  onOpenChange,
  onUpdated,
}: {
  created: number;
  updates: QuestionImportUpdate[] | null;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void | Promise<void>;
}) {
  const [applying, setApplying] = useState(false);
  const settled = useRef<'open' | 'confirmed' | 'dismissed'>('open');
  const open = Boolean(updates && updates.length > 0);
  const count = updates?.length ?? 0;

  useEffect(() => {
    if (open) settled.current = 'open';
  }, [open]);

  async function confirm() {
    if (!updates || updates.length === 0 || applying) return;
    setApplying(true);
    try {
      const updated = await applyQuestionImportUpdates(updates);
      toast.success(updated === 1 ? 'Updated 1 question.' : `Updated ${updated} questions.`);
      settled.current = 'confirmed';
      await onUpdated();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update the questions.');
    } finally {
      setApplying(false);
    }
  }

  function keepCurrent() {
    if (applying || settled.current !== 'open') return;
    settled.current = 'dismissed';
    if (count > 0) {
      toast.message(
        count === 1
          ? 'Left 1 saved question unchanged.'
          : `Left ${count} saved questions unchanged.`,
      );
    }
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next || applying) return;
        keepCurrent();
      }}
    >
      <DialogContent className="flex max-h-[min(85vh,44rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        {updates && updates.length > 0 ? (
          <>
            <DialogHeader className="shrink-0 space-y-2 border-b border-border px-6 py-5 pr-12">
              <DialogTitle>Update existing questions?</DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                {created === 0
                  ? 'No new questions were added. '
                  : `Added ${created} new question${created === 1 ? '' : 's'}. `}
                {count === 1
                  ? '1 question already saved has different details in this file.'
                  : `${count} questions already saved have different details in this file.`}{' '}
                Update replaces the saved version with the file. Keep current leaves those questions
                as they are.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
              {updates.map((update) => (
                <section
                  key={`${update.bankId}-${update.questionId}-${update.sheetRow}`}
                  className="space-y-2"
                >
                  <h3 className="text-sm font-medium text-foreground">
                    Sheet row {update.sheetRow}
                    {update.roundName ? ` · ${update.roundName}` : ''}:{' '}
                    {update.question || '(no text)'}
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Field</TableHead>
                        <TableHead>Current</TableHead>
                        <TableHead>In this file</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {update.changes.map((change) => (
                        <TableRow key={`${update.sheetRow}-${change.field}`}>
                          <TableCell className="whitespace-normal font-medium">
                            {change.field}
                          </TableCell>
                          <TableCell className="whitespace-pre-wrap">{change.before}</TableCell>
                          <TableCell className="whitespace-pre-wrap">{change.after}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </section>
              ))}
            </div>
            <DialogFooter className="shrink-0 border-t border-border px-6 py-4">
              <Button type="button" variant="outline" disabled={applying} onClick={keepCurrent}>
                Keep current
              </Button>
              <Button type="button" disabled={applying} onClick={() => void confirm()}>
                {applying ? 'Updating…' : count === 1 ? 'Update question' : 'Update questions'}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
