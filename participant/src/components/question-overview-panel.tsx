type QuestionOverviewPanelProps = {
  total: number;
  answeredCount: number;
  unansweredCount: number;
  reviewCount: number;
  currentIndex: number;
  allOnPage: boolean;
  statuses: Array<'answered' | 'review' | 'unanswered'>;
  submitDisabled: boolean;
  onSelect: (index: number) => void;
  onSubmit: () => void;
};

export function QuestionOverviewPanel({
  total,
  answeredCount,
  unansweredCount,
  reviewCount,
  currentIndex,
  allOnPage,
  statuses,
  submitDisabled,
  onSelect,
  onSubmit,
}: QuestionOverviewPanelProps) {
  return (
    <aside className="qov" aria-label="Question overview">
      <div className="qov-head">
        <h2 className="qov-title">Question overview</h2>
        <p className="qov-count" aria-live="polite">
          {answeredCount}/{total}
        </p>
      </div>

      <ul className="qov-legend" aria-hidden="true">
        <li>
          <span className="qov-swatch answered" />
          Answered
        </li>
        <li>
          <span className="qov-swatch review" />
          Review
        </li>
        <li>
          <span className="qov-swatch unanswered" />
          Unanswered
        </li>
      </ul>

      <div className="qov-grid" role="list">
        {statuses.map((status, index) => {
          const isCurrent = !allOnPage && index === currentIndex;
          const label = [
            `Question ${index + 1}`,
            status === 'answered' ? 'answered' : null,
            status === 'review' ? 'marked for review' : null,
            status === 'unanswered' ? 'unanswered' : null,
            isCurrent ? 'current' : null,
          ]
            .filter(Boolean)
            .join(', ');
          return (
            <button
              key={index}
              type="button"
              role="listitem"
              className={`qov-cell ${status}${isCurrent ? ' current' : ''}`}
              aria-label={label}
              aria-current={isCurrent ? 'true' : undefined}
              onClick={() => onSelect(index)}
            >
              {index + 1}
            </button>
          );
        })}
      </div>

      <dl className="qov-stats">
        <div>
          <dt>Answered</dt>
          <dd>{answeredCount}</dd>
        </div>
        <div>
          <dt>Unanswered</dt>
          <dd>{unansweredCount}</dd>
        </div>
        <div>
          <dt>Marked for review</dt>
          <dd>{reviewCount}</dd>
        </div>
      </dl>

      <div className="qov-foot">
        <button type="button" className="qov-submit" disabled={submitDisabled} onClick={onSubmit}>
          Submit attempt
          <span aria-hidden="true">→</span>
        </button>
        <p className="qov-note">Answers are saved to the server as you go.</p>
      </div>
    </aside>
  );
}
