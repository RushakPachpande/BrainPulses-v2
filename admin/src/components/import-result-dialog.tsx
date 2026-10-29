import { AlertCircleIcon, AlertTriangleIcon, CheckCircle2Icon } from 'lucide-react';
import type { ImportResultView } from '@/components/import-result';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export type { ImportResultView };

export function ImportResultDialog({
  result,
  onOpenChange,
}: {
  result: ImportResultView | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={result != null} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(85vh,40rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        {result ? (
          <>
            <DialogHeader className="shrink-0 space-y-3 border-b border-border px-6 py-5 pr-12">
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full',
                    result.kind === 'success' && 'bg-success/15 text-success',
                    result.kind === 'warning' && 'bg-warning/15 text-warning',
                    result.kind === 'error' && 'bg-destructive/15 text-destructive',
                  )}
                >
                  {result.kind === 'success' ? (
                    <CheckCircle2Icon className="size-5" aria-hidden />
                  ) : result.kind === 'warning' ? (
                    <AlertTriangleIcon className="size-5" aria-hidden />
                  ) : (
                    <AlertCircleIcon className="size-5" aria-hidden />
                  )}
                </span>
                <div className="min-w-0 space-y-1">
                  <DialogTitle>{result.title}</DialogTitle>
                  <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                    {result.summary}
                  </DialogDescription>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pl-12">
                <Badge variant={result.kind === 'error' ? 'destructive' : 'secondary'}>
                  {result.created} created
                </Badge>
                {result.issues.length > 0 ? (
                  <Badge variant="outline">
                    {result.issues.length} issue{result.issues.length === 1 ? '' : 's'}
                  </Badge>
                ) : null}
              </div>
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
              {result.issues.length > 0 ? (
                <section className="space-y-2">
                  <h3 className="text-sm font-medium text-foreground">Details</h3>
                  <ul className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
                    {result.issues.map((issue, index) => (
                      <li
                        key={`${index}-${issue.slice(0, 24)}`}
                        className="flex gap-2 text-sm leading-relaxed text-foreground"
                      >
                        <span className="mt-0.5 shrink-0 font-medium text-muted-foreground">
                          {index + 1}.
                        </span>
                        <span className="min-w-0 wrap-break-word">{issue}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {result.tip ? (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Next: </span>
                  {result.tip}
                </p>
              ) : null}
            </div>

            <DialogFooter className="shrink-0 border-t border-border px-6 py-4">
              <Button type="button" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
