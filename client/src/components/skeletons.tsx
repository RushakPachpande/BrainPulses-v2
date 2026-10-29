/** Layout-matching loading shells for the student client. */

function SrOnly({ children }: { children: string }) {
  return <span className="sr-only">{children}</span>;
}

export function AuthSessionSkeleton() {
  return (
    <div className="login-page login-page-centered" aria-busy="true" aria-live="polite">
      <SrOnly>Loading session</SrOnly>
      <div className="login-card skeleton-auth-card" aria-hidden>
        <span className="skeleton-line skeleton-auth-logo" />
        <span className="skeleton-line w-md" />
        <span className="skeleton-line w-full" />
        <span className="skeleton-line h-btn skeleton-auth-field" />
        <span className="skeleton-line h-btn skeleton-auth-field" />
        <span className="skeleton-line h-btn skeleton-auth-cta" />
      </div>
    </div>
  );
}

export function MetricsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="metrics-grid skeleton-metrics" aria-busy="true" aria-live="polite">
      <SrOnly>Loading metrics</SrOnly>
      {Array.from({ length: count }, (_, i) => (
        <div className="metric-card skeleton-metric-card" key={i} aria-hidden>
          <span className="skeleton-line w-sm" />
          <span className="skeleton-line skeleton-metric-value" />
          <span className="skeleton-line w-md" />
        </div>
      ))}
    </div>
  );
}

export function SummaryTilesSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="results-summary" aria-busy="true" aria-live="polite">
      <SrOnly>Loading summary</SrOnly>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} aria-hidden>
          <span className="skeleton-line w-sm" />
          <span className="skeleton-line skeleton-summary-value" />
        </div>
      ))}
    </div>
  );
}

export function GoalPanelSkeleton() {
  return (
    <div className="goal-progress skeleton-goal" aria-busy="true" aria-live="polite">
      <SrOnly>Loading weekly goal</SrOnly>
      <div className="goal-number" aria-hidden>
        <span className="skeleton-line skeleton-goal-number" />
        <span className="skeleton-line w-sm" />
      </div>
      <div className="progress-track skeleton-progress-track" aria-hidden>
        <span className="skeleton-line skeleton-progress-fill" />
      </div>
      <span className="skeleton-line w-full" aria-hidden />
    </div>
  );
}

export function LibraryStatsSkeleton() {
  return (
    <div className="summary-stats skeleton-library-stats" aria-busy="true" aria-live="polite">
      <SrOnly>Loading library stats</SrOnly>
      <div aria-hidden>
        <span className="skeleton-line skeleton-summary-value" />
        <span className="skeleton-line w-sm" />
      </div>
      <div aria-hidden>
        <span className="skeleton-line skeleton-summary-value" />
        <span className="skeleton-line w-sm" />
      </div>
    </div>
  );
}

export function ExamShellSkeleton() {
  return (
    <div className="exam-page" aria-busy="true" aria-live="polite">
      <SrOnly>Loading attempt</SrOnly>
      <header className="exam-topbar skeleton-exam-topbar" aria-hidden>
        <span className="skeleton-line skeleton-exam-brand" />
        <span className="skeleton-line w-md" />
        <span className="skeleton-line skeleton-exam-timer" />
        <span className="skeleton-line h-btn skeleton-exam-exit" />
      </header>
      <div className="exam-progress" aria-hidden>
        <div className="skeleton-exam-progress-fill" />
      </div>
      <div className="exam-layout">
        <section className="question-column" aria-hidden>
          <div className="question-topline">
            <span className="skeleton-line w-sm" />
            <span className="skeleton-line w-md" />
          </div>
          <div className="question-card skeleton-question-card">
            <span className="skeleton-line w-sm" />
            <span className="skeleton-line w-full" />
            <span className="skeleton-line w-lg" />
            <span className="skeleton-line w-md" />
            <div className="skeleton-option-list">
              {[0, 1, 2, 3].map((i) => (
                <span className="skeleton-line skeleton-option" key={i} />
              ))}
            </div>
          </div>
        </section>
        <aside className="question-sidebar skeleton-exam-sidebar" aria-hidden>
          <span className="skeleton-line w-md" />
          <span className="skeleton-line w-full" />
          <div className="question-grid skeleton-question-grid">
            {Array.from({ length: 12 }, (_, i) => (
              <span className="skeleton-line skeleton-q-num" key={i} />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

export function ResultDetailSkeleton() {
  return (
    <div className="page-stack" aria-busy="true" aria-live="polite">
      <SrOnly>Loading result</SrOnly>
      <span className="skeleton-line w-sm" aria-hidden />
      <span className="skeleton-line w-md" aria-hidden />
      <span className="skeleton-line w-lg" aria-hidden />
      <div className="result-hero panel skeleton-result-hero" aria-hidden>
        <div className="result-ring skeleton-result-ring">
          <span className="skeleton-line skeleton-ring-value" />
        </div>
        <div className="result-hero-copy skeleton-result-copy">
          <span className="skeleton-line w-sm" />
          <span className="skeleton-line w-lg" />
          <span className="skeleton-line w-full" />
          <span className="skeleton-line w-md" />
          <span className="skeleton-line h-btn" />
        </div>
      </div>
      <section className="panel review-panel" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div className="skeleton-row" key={i}>
            <span className="skeleton-line w-sm" />
            <span className="skeleton-line w-full" />
            <span className="skeleton-line w-md" />
          </div>
        ))}
      </section>
    </div>
  );
}
