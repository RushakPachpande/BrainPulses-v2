import { ArrowRight, BookOpen, CheckCircle2, FileText, Trophy } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { SummaryTilesSkeleton } from '../components/skeletons';
import { PortalHeader } from '../components/portal-header';
import { IconCheck } from '../components/portal-icons';
import { StoredImage } from '../components/stored-image';
import { Heading } from '../components/ui-bits';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from '../components/ui/select';
import { useAuth } from '../contexts/auth-context';
import { useParticipantPages } from '../hooks/use-participant-pages';
import { answerLabel, formatDateLabel, formatKind } from '../lib/format';
import { clientQueryKeys } from '../lib/query-keys';
import { getResult, listActivities, listResults } from '../services/api';
import type { ParticipantResultDetail } from '../services/types';

const RESULT_FILTERS = ['All', 'Quiz', 'Assessment'] as const;

export function ResultsPage() {
  const navigate = useNavigate();
  const { participant } = useAuth();
  const pagesQuery = useParticipantPages();
  const quizzesOn = pagesQuery.data?.quizzes ?? true;
  const assessmentsOn = pagesQuery.data?.assessments ?? true;
  const participantId = participant?.id ?? '';
  const [filter, setFilter] = useState<(typeof RESULT_FILTERS)[number]>('All');

  const {
    data: attempts = [],
    isPending: loading,
    isError,
  } = useQuery({
    queryKey: clientQueryKeys.results(participantId, 'all'),
    queryFn: () => listResults('all'),
    enabled: Boolean(participantId),
  });
  const error = isError ? 'Unable to load results.' : '';

  const list = useMemo(
    () =>
      attempts.filter(
        (a) =>
          filter === 'All' ||
          (filter === 'Quiz' && a.kind === 'quiz') ||
          (filter === 'Assessment' && a.kind === 'assessment'),
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
        <Select
          value={filter}
          onValueChange={(value) => setFilter(value as (typeof RESULT_FILTERS)[number])}
          disabled={loading}
        >
          <SelectTrigger aria-label="Type" className="results-type-filter">
            <span className="select-trigger-label">Type: {filter}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {RESULT_FILTERS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
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
                {quizzesOn ? (
                  <button
                    className="btn primary"
                    type="button"
                    onClick={() => navigate('/quizzes')}
                  >
                    Start a quiz <ArrowRight size={15} aria-hidden />
                  </button>
                ) : null}
                {assessmentsOn ? (
                  <button
                    className="btn outline"
                    type="button"
                    onClick={() => navigate('/assessments')}
                  >
                    Browse assessments
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <div className="empty-icon" aria-hidden>
                <Trophy size={22} />
              </div>
              <b>No matching results</b>
              <span>Try a different filter to see your attempts.</span>
              <button className="btn outline" type="button" onClick={() => setFilter('All')}>
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

type ResultRetryInfo = {
  used: number;
  max: number | null;
  left: number | null;
  canRetry: boolean;
};

export function ResultDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { participant } = useAuth();
  const [attempt, setAttempt] = useState<ParticipantResultDetail | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [retry, setRetry] = useState<ResultRetryInfo | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getResult(id);
        if (cancelled) return;
        setAttempt(data);
        const usedFallback = Math.max(1, data.attemptsUsed ?? 1);
        const maxFallback = data.maxAttempts ?? null;
        const extraFallback = data.extraAttempts ?? 0;
        const leftFallback =
          maxFallback == null
            ? null
            : Math.max(0, maxFallback + extraFallback - (data.attemptsUsed ?? 0));
        setRetry({
          used: usedFallback,
          max: maxFallback,
          left: leftFallback,
          canRetry: leftFallback == null || leftFallback > 0,
        });
        try {
          const rows = await listActivities(data.kind);
          const match = rows.find((row) => row.activityId === data.activityId);
          if (!match || cancelled) return;
          const fileId = match.imageFileId || match.contestImageFileId || match.sponsorImageFileId;
          if (fileId) setBanner(`/api/files/${fileId}`);
          const used = Math.max(1, match.attemptsUsed ?? data.attemptsUsed ?? 1);
          const max = match.maxAttempts ?? null;
          const extra = match.extraAttempts ?? 0;
          const left = max == null ? null : Math.max(0, max + extra - (match.attemptsUsed ?? 0));
          setRetry({
            used,
            max,
            left,
            canRetry:
              match.canStartAnother === true ||
              (match.canAttempt === true && (left === null || left > 0)),
          });
        } catch {
          /* banner / retry enrichment is optional */
        }
      } catch {
        if (!cancelled) setError('Result not found.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <p className="sr-only">Loading result</p>;

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
  const used = retry ? retry.used : Math.max(1, attempt.attemptsUsed ?? 1);
  const max = retry ? retry.max : (attempt.maxAttempts ?? null);
  const left = retry ? retry.left : null;
  const canRetry = retry ? retry.canRetry : false;
  const library = attempt.kind === 'assessment' ? '/assessments' : '/quizzes';
  const backLabel = attempt.kind === 'assessment' ? 'Back to assessments' : 'Back to quizzes';
  const name = participant?.name?.split(/\s+/)[0] || 'there';
  const score = attempt.score ?? 0;
  const maxScore = attempt.maxScore ?? 0;
  const ring = hidden ? 0 : Math.max(0, Math.min(389.6, (percent / 100) * 389.6));
  const color = passed ? 'var(--vio)' : 'var(--clay)';
  const showRetry = canRetry;

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
          <h1>
            {hidden
              ? `Thanks for participating, ${name}!`
              : passed
                ? `Well done, ${name}!`
                : 'Not quite there yet'}
          </h1>
          <p>
            {hidden
              ? `Your answers for ${attempt.title} are submitted. Results will be shared by the organiser.`
              : passed
                ? `You passed ${attempt.title}.`
                : showRetry
                  ? `Give ${attempt.title} another try.`
                  : `That was your last attempt at ${attempt.title}.`}
          </p>
          <div className="rbt">
            {showRetry ? (
              <button
                className="p"
                type="button"
                onClick={() => navigate(`${library}/${attempt.activityId}`)}
              >
                {left == null
                  ? 'Try again'
                  : `Try again · ${left} attempt${left === 1 ? '' : 's'} left`}
              </button>
            ) : null}
            <button
              className={`s ${showRetry ? '' : 'solo'}`}
              type="button"
              onClick={() => navigate(library)}
            >
              {backLabel}
            </button>
          </div>
          <div className="at">
            {hidden
              ? 'Submitted'
              : `Attempt ${used}${max == null ? '' : ` of ${max}`}${left === 0 ? ' · no attempts left' : ''}`}
          </div>
        </section>
      </div>
      {attempt.answersVisible !== false && attempt.review.length > 0 ? (
        <section className="dcard review-list">
          <h2>Answer review</h2>
          {attempt.review.map((question, index) => (
            <div className="review-q" key={question.questionVersionId}>
              <span>
                Question {index + 1}
                {question.correct === true ? ' · Correct' : ' · Review'}
              </span>
              <b>{question.question}</b>
              {question.questionImageUrl ? (
                <StoredImage src={question.questionImageUrl} alt="" />
              ) : null}
              <p>{answerLabel(question.yourAnswer) ?? 'Not answered'}</p>
            </div>
          ))}
        </section>
      ) : null}
    </>
  );
}
