import { Loader2 } from 'lucide-react';

/** Full-screen blocker shown while any api-client request is in flight. */
export function LoadingOverlay() {
  return (
    <div
      className="api-loading-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="api-loading-label"
      aria-busy="true"
    >
      <div className="api-loading-overlay__inner">
        <Loader2 className="api-loading-overlay__spinner" aria-hidden="true" />
        <p id="api-loading-label" className="api-loading-overlay__label">
          Loading…
        </p>
      </div>
    </div>
  );
}
