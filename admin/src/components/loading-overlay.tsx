import { Loader2Icon } from 'lucide-react';

/** Full-screen blocker shown while any api-client request is in flight. */
export function LoadingOverlay() {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 pointer-events-auto"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="api-loading-label"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-3 text-foreground">
        <Loader2Icon className="size-8 animate-spin text-primary" aria-hidden="true" />
        <p id="api-loading-label" className="text-sm font-medium">
          Loading…
        </p>
      </div>
    </div>
  );
}
