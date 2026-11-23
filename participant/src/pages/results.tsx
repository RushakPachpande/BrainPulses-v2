import { ArrowRight, BookOpen, CheckCircle2, FileText, Trophy } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { SummaryTilesSkeleton } from '../components/skeletons';
import { PageLoader } from '../components/loading-overlay';
import { PortalHeader } from '../components/portal-header';
import { IconCheck } from '../components/portal-icons';
import { StoredImage } from '../components/stored-image';
import { FilterMultiSelect } from '../components/filter-multi-select';
import { Heading } from '../components/ui-bits';
import { useAuth } from '../contexts/auth-context';
import { answerLabel, formatDateLabel, formatKind } from '../lib/format';
import { isInstructionsEmpty, sanitizeInstructionsHtml } from '../lib/sanitize-html';
import { clientQueryKeys } from '../lib/query-keys';
import { getResult, listActivities, listResults } from '../services/api';
import type { ParticipantResultDetail } from '../services/types';

const RESULT_FILTERS = ['Quiz', 'Assessment'] as const;

function optionText(question: ParticipantResultDetail['review'][number], labels: string[]) {
  return labels
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const option = question.options.find((item) => item.label === part);
      if (!option?.body) return option?.label ?? part;
      return `${option.label}. ${option.body}`;
    })
    .join(', ');
}

function shownAnswer(question: ParticipantResultDetail['review'][number]) {
  const raw = answerLabel(question.yourAnswer);
  if (!raw) return 'Not answered';
  return optionText(question, raw.split(',')) || 'Not answered';
}

function correctAnswerText(question: ParticipantResultDetail['review'][number]) {
  const labels =
    question.correctLabels.length > 0
      ? question.correctLabels
      : question.options.filter((option) => option.isCorrect).map((option) => option.label);
  return optionText(question, labels);
}

export function ResultsPage() {
  const navigate = useNavigate();
  const { participant } = useAuth();
  const participantId = participant?.id ?? '';
  const [filter, setFilter] = useState<string[]>([]);

  const {
    data: attempts = [],
    isPending: loading,
    isError,
  } = useQuery({
    queryKey: clientQueryKeys.results(participantId, 'all'),
    queryFn: ({ signal }) => listResults('all', signal),
    enabled: Boolean(participantId),
  });
  const error = isError ? 'Unable to load results.' : '';

  const list = useMemo(
    () =>
      attempts.filter(
        (a) =>
          filter.length === 0 ||
          (filter.includes('Quiz') && a.kind === 'quiz') ||
          (filter.includes('Assessment') && a.kind === 'assessment'),
      ),
    [attempts, filter],
  );

  const scored = attempts.filter((a) => a.percent != null);
  const average =
    scored.length > 0
      ? Math.round(scored.reduce((s, a) => s + (a.percent as number), 0) / scored.length)
      : null;
  const best =
    scored.length > 0 ? Math.max(...scored.map((a) => Math.round(a.percent as number))) : null;

  return (
    <div className="page-stack">
      <Heading
        eyebrow="YOUR LEARNING JOURNEY"
        title="My results"
        description="Review your completed attempts and see how your confidence is growing."
        action={
          <button className="btn primary" type="button" onClick={() => navigate('/quizzes')}>
            <BookOpen size={16} /> Find a quiz
          </button>
        }
      />
      {error && <div className="error-text">{error}</div>}
      {loading ? (
        <SummaryTilesSkeleton count={3} />
      ) : (
        <div className="results-summary">
          <div>
            <span>Completed attempts</span>
            <b>{attempts.length}</b>
          </div>
          <div>
            <span>Average score</span>
            <b>{average === null ? '—' : `${average}%`}</b>
          </div>
          <div>
            <span>Best score</span>
            <b>{best === null ? '—' : `${best}%`}</b>
          </div>
        </div>
      )}
      <div className="results-toolbar">
        <div>
          <h2>Attempt history</h2>
          <p>Your most recent submissions appear first.</p>
        </div>
        <FilterMultiSelect
          label="Type"
          options={RESULT_FILTERS}
          values={filter}
          onValuesChange={setFilter}
          disabled={loading}
        />
      </div>
      {loading ? (
        <div className="panel results-table" aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading results</span>
          <div className="table-header">
            <span>ACTIVITY</span>
            <span>TYPE</span>
            <span>DATE</span>
            <span>SCORE</span>
            <span />
          </div>
          {[0, 1, 2].map((i) => (
            <div className="table-row skeleton-result-row" key={i} aria-hidden>
              <span className="skeleton-line w-md" />
              <span className="skeleton-line w-sm" />
              <span className="skeleton-line w-sm" />
              <span className="skeleton-line w-sm" />
              <span />
            </div>
          ))}
        </div>
      ) : !list.length ? (
        <div className="panel empty-state results-empty" role="status">
          {attempts.length === 0 ? (
            <>
              <div className="results-empty-icon" aria-hidden>
                <Trophy size={26} />
              </div>
              <h3 className="results-empty-title">No results yet</h3>
              <p className="results-empty-text">
                Once you submit a quiz or assessment, your score and attempt details will appear
                here.
              </p>
              <ol className="results-empty-steps">
                <li>
                  <span className="results-empty-step-icon" aria-hidden>
                    <BookOpen size={17} />
                  </span>
                  <span>
                    <b>Pick an activity</b>
                    <small>Choose a quiz or an assessment.</small>
                  </span>
                </li>
                <li>
                  <span className="results-empty-step-icon" aria-hidden>
                    <CheckCircle2 size={17} />
                  </span>
                  <span>
                    <b>Submit your attempt</b>
                    <small>Answer every question, then submit.</small>
                  </span>
                </li>
                <li>
                  <span className="results-empty-step-icon" aria-hidden>
                    <Trophy size={17} />
                  </span>
                  <span>
                    <b>See your score</b>
                    <small>Results show here once released.</small>
                  </span>
                </li>
              </ol>
              <div className="results-empty-actions">
                <button className="btn primary" type="button" onClick={() => navigate('/quizzes')}>
                  Start a quiz <ArrowRight size={15} aria-hidden />
                </button>
                <button
                  className="btn outline"
                  type="button"
                  onClick={() => navigate('/assessments')}
                >
                  Browse assessments
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="empty-icon" aria-hidden>
                <Trophy size={22} />
              </div>
              <b>No matching results</b>
              <span>Try a different filter to see your attempts.</span>
              <button className="btn outline" type="button" onClick={() => setFilter([])}>
                Show all results
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="panel results-table">
          <div className="table-header">
            <span>ACTIVITY</span>
            <span>TYPE</span>
            <span>DATE</span>
            <span>SCORE</span>
            <span />
          </div>
          {list.map((a) => (
            <button
              className="table-row"
              key={a.id}
              type="button"
              onClick={() => navigate(`/results/${a.id}`)}
            >
              <div className="table-activity">
                <span className="result-file">
                  <FileText size={17} />
                </span>
                <span>
                  <b>
                    {a.title}
                    {a.roundName ? ` · ${a.roundName}` : ''}
                  </b>
                  <small>
                    {a.maxScore != null ? `${a.maxScore} points · ` : ''}
                    {a.durationMinutes ?? '—'} min
                  </small>
                </span>
              </div>
              <span className="table-type">
                <span className="result-field-label">Type</span>
                {formatKind(a.kind)}
              </span>
              <span className="table-date">
                <span className="result-field-label">Date</span>
                {formatDateLabel(a.submittedAt)}
              </span>
              <span
                className={`table-score ${
                  a.percent == null ? '' : a.percent >= 60 ? 'good' : 'low'
                }`}
              >
                <span className="result-field-label">Score</span>
                {a.percent == null ? 'Pending release' : `${Math.round(a.percent)}%`}
              </span>
              <ArrowRight size={16} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ResultDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { participant } = useAuth();
  const participantId = participant?.id ?? '';
  const resultQuery = useQuery({
    queryKey: clientQueryKeys.resultDetail(participantId, id),
    queryFn: ({ signal }) => getResult(id, signal),
    enabled: Boolean(participantId && id),
  });
  const attempt = resultQuery.data ?? null;
  const activitiesQuery = useQuery({
    queryKey: clientQueryKeys.activities(participantId, attempt?.kind ?? 'quiz'),
    queryFn: ({ signal }) => listActivities(attempt?.kind, signal),
    enabled: Boolean(participantId && attempt?.kind),
  });
  const match = activitiesQuery.data?.find((row) => row.activityId === attempt?.activityId);
  const fileId = match?.imageFileId || match?.contestImageFileId || match?.sponsorImageFileId;
  const banner = fileId ? `/api/files/${fileId}` : null;
  const retry = useMemo(() => {
    if (!attempt) return null;
    const round =
      attempt.kind === 'assessment'
        ? match?.rounds?.find((row) => row.id === attempt.roundId)
        : undefined;
    if (attempt.kind === 'assessment') {
      const used = round?.attemptsUsed ?? attempt.attemptsUsed ?? 0;
      const max = round?.maxAttempts ?? attempt.maxAttempts ?? null;
      const left = max == null ? null : Math.max(0, max - used);
      const underCap = max == null || used < max;
      const canRetry = round
        ? (round.state === 'available' || round.state === 'in_progress') && underCap
        : underCap;
      return { used, max, left, canRetry };
    }
    if (!match) {
      const used = Math.max(1, attempt.attemptsUsed ?? 1);
      const max = attempt.maxAttempts ?? null;
      const extra = attempt.extraAttempts ?? 0;
      const left = max == null ? null : Math.max(0, max + extra - (attempt.attemptsUsed ?? 0));
      return { used, max, left, canRetry: left == null || left > 0 };
    }
    const used = Math.max(1, match.attemptsUsed ?? attempt.attemptsUsed ?? 1);
    const max = match.maxAttempts ?? null;
    const extra = match.extraAttempts ?? 0;
    const left = max == null ? null : Math.max(0, max + extra - (match.attemptsUsed ?? 0));
    return {
      used,
      max,
      left,
      canRetry:
        match.canStartAnother === true ||
        (match.canAttempt === true && (left === null || left > 0)),
    };
  }, [attempt, match]);
  const loading = Boolean(participantId && id) && resultQuery.isPending && !attempt;
  const error = resultQuery.isError ? 'Result not found.' : '';

  if (loading) return <PageLoader />;

  if (!attempt) {
    return (
      <>
        <PortalHeader />
        <div className="pg">
          <section className="dcard">
            <h1>Result not found</h1>
            <p>{error || 'This result is not available for your account.'}</p>
            <button className="begin" type="button" onClick={() => navigate('/dashboard')}>
              Back to home
            </button>
          </section>
        </div>
      </>
    );
  }

  /** Scores appear when the API returns them (admin release / after-submit). */
  const hidden = attempt.percent == null;
  const percent = hidden ? 0 : Math.round(attempt.percent as number);
  const passed = hidden ? false : (attempt.passed ?? percent >= 50);
  const used = retry?.used ?? Math.max(1, attempt.attemptsUsed ?? 1);
  /** Prefer activity allowance when loaded — result API may default unlimited to 1. */
  const max = retry != null ? retry.max : (attempt.maxAttempts ?? null);
  const unlimited = max == null;
  const left = unlimited
    ? null
    : Math.max(0, max + (attempt.extraAttempts ?? 0) - (attempt.attemptsUsed ?? used));
  const canRetry = retry?.canRetry ?? false;
  const library = attempt.kind === 'assessment' ? '/assessments' : '/quizzes';
  const activityPath = `${library}/${attempt.activityId}`;
  const backLabel = attempt.kind === 'assessment' ? 'Back to rounds' : 'Back to quizzes';
  const backPath = attempt.kind === 'assessment' ? activityPath : library;
  const score = attempt.score ?? 0;
  const maxScore = attempt.maxScore ?? 0;
  const ring = hidden ? 0 : Math.max(0, Math.min(389.6, (percent / 100) * 389.6));
  const color = passed ? 'var(--vio)' : 'var(--clay)';
  const showRetry = canRetry && (unlimited || (left != null && left > 0));
  const endMessageHtml = isInstructionsEmpty(attempt.endMessage)
    ? ''
    : sanitizeInstructionsHtml(attempt.endMessage ?? '');

  return (
    <>
      <PortalHeader />
      <div className="rwrap">
        <section className="rcard">
          <div className="rb">{banner ? <StoredImage src={banner} alt="" /> : null}</div>
          {hidden ? (
            <div className="tick" aria-hidden>
              <div>
                <IconCheck size={64} />
              </div>
            </div>
          ) : (
            <div className="ring" aria-label={`Score ${score} of ${maxScore}, ${percent} percent`}>
              <svg viewBox="0 0 150 150" aria-hidden>
                <circle cx="75" cy="75" r="62" fill="none" stroke="var(--line)" strokeWidth="14" />
                <circle
                  cx="75"
                  cy="75"
                  r="62"
                  fill="none"
                  stroke={color}
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeDasharray={`${ring.toFixed(1)} 389.6`}
                  transform="rotate(-90 75 75)"
                />
              </svg>
              <div className="tx">
                <div>
                  <b>
                    {score}
                    <span>/{maxScore}</span>
                  </b>
                  <small>{percent}%</small>
                </div>
              </div>
            </div>
          )}
          {endMessageHtml ? (
            <div
              className="rich-instructions end-message"
              dangerouslySetInnerHTML={{ __html: endMessageHtml }}
            />
          ) : null}
          <div className="rbt">
            {showRetry ? (
              <button
                className="p"
                type="button"
                onClick={() => navigate(`${library}/${attempt.activityId}`)}
              >
                {unlimited
                  ? 'Try again (Unlimited attempts)'
                  : `Try again (${left ?? 0} attempt${left === 1 ? '' : 's'} left)`}
              </button>
            ) : null}
            <button
              className={`s ${showRetry ? '' : 'solo'}`}
              type="button"
              onClick={() => navigate(backPath)}
            >
              {backLabel}
            </button>
          </div>
          <div className="at">
            {unlimited ? `Attempt ${used} of Unlimited` : `Attempt ${used} of ${max}`}
          </div>
        </section>
      </div>
      {attempt.answersVisible !== false && attempt.review.length > 0 ? (
        <section className="dcard review-list">
          <h2>Answer review</h2>
          {attempt.review.map((question, index) => {
            const yours = shownAnswer(question);
            const correctText = correctAnswerText(question);
            const status =
              question.correct === true
                ? 'Correct'
                : question.correct === false
                  ? yours === 'Not answered'
                    ? 'Not answered'
                    : 'Incorrect'
                  : 'Review';
            return (
              <div
                className={`review-q${question.correct === true ? ' is-correct' : ''}${question.correct === false ? ' is-wrong' : ''}`}
                key={question.questionVersionId}
              >
                <span>
                  Question {index + 1} · {status}
                </span>
                <b>{question.question}</b>
                {question.questionImageUrl ? (
                  <StoredImage src={question.questionImageUrl} alt="" />
                ) : null}
                {question.correct === true ? (
                  <p className="review-answer review-answer--ok">{yours}</p>
                ) : question.correct === false ? (
                  <>
                    <p className="review-answer review-answer--bad">Your answer: {yours}</p>
                    {correctText ? (
                      <p className="review-answer review-answer--ok">
                        Correct answer: {correctText}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p>{yours}</p>
                )}
              </div>
            );
          })}
        </section>
      ) : null}
    </>
  );
}
