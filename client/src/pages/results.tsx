import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Trophy,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ResultDetailSkeleton, SummaryTilesSkeleton } from '../components/skeletons';
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
import { useStudentPages } from '../hooks/use-student-pages';
import { formatAttemptAllowance } from '../lib/attempt-allowance';
import { answerLabel, formatDateLabel, formatKind } from '../lib/format';
import { clientQueryKeys } from '../lib/query-keys';
import { getResult, listResults } from '../services/api';
import type { StudentResultDetail } from '../services/types';

const RESULT_FILTERS = ['All', 'Quiz', 'Assessment'] as const;

export function ResultsPage() {
  const navigate = useNavigate();
  const { student } = useAuth();
  const pagesQuery = useStudentPages();
  const quizzesOn = pagesQuery.data?.quizzes ?? true;
  const assessmentsOn = pagesQuery.data?.assessments ?? true;
  const studentId = student?.id ?? '';
  const [filter, setFilter] = useState<(typeof RESULT_FILTERS)[number]>('All');

  const {
    data: attempts = [],
    isPending: loading,
    isError,
  } = useQuery({
    queryKey: clientQueryKeys.results(studentId, 'all'),
    queryFn: () => listResults('all'),
    enabled: Boolean(studentId),
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

export function ResultDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<StudentResultDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getResult(id);
        if (!cancelled) setAttempt(data);
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

  if (loading) return <ResultDetailSkeleton />;

  if (!attempt) {
    return (
      <div className="page-stack">
        <button className="text-btn" type="button" onClick={() => navigate('/results')}>
          <ArrowLeft size={15} /> Back to results
        </button>
        <div className="panel empty-state" role="status">
          <div className="empty-icon">
            <Trophy size={22} />
          </div>
          <b>Result not found</b>
          <span>{error || 'This result is not available for your account.'}</span>
          <button className="btn primary" type="button" onClick={() => navigate('/results')}>
            Go to results
          </button>
        </div>
      </div>
    );
  }

  const scoreHidden = attempt.percent == null;
  const waitingOnPublish = scoreHidden && attempt.releaseStatus !== 'published';
  const pending = scoreHidden;
  const percent = pending ? null : Math.round(attempt.percent as number);
  const attemptLine =
    attempt.kind === 'quiz' && attempt.attemptsUsed != null
      ? `Attempts: ${formatAttemptAllowance(attempt)}`
      : null;

  return (
    <div className="page-stack">
      <button className="back-link" type="button" onClick={() => navigate('/results')}>
        <ArrowLeft size={15} /> Back to results
      </button>
      <Heading eyebrow="ATTEMPT SUMMARY" title="Your result" description={attempt.title} />
      <div className="result-hero panel">
        <div
          className={`result-ring ${pending ? 'needs-work' : percent! >= 60 ? 'passed' : 'needs-work'}`}
        >
          <div>
            <strong>{pending ? '—' : `${percent}%`}</strong>
            <span>{pending ? 'Pending' : 'Score'}</span>
          </div>
        </div>
        <div className="result-hero-copy">
          <span className="result-label">
            <CheckCircle2 size={15} />
            {waitingOnPublish
              ? 'Pending release'
              : scoreHidden
                ? 'Score withheld'
                : percent! >= 60
                  ? 'Good progress'
                  : 'Keep practising'}
          </span>
          <h2>
            {waitingOnPublish
              ? 'Your score is waiting for release.'
              : scoreHidden
                ? 'Your score is not visible yet.'
                : percent! >= 60
                  ? 'You’re building strong momentum.'
                  : 'Every attempt is a chance to improve.'}
          </h2>
          <p>
            {waitingOnPublish
              ? `This ${formatKind(attempt.kind).toLowerCase()} was submitted. Scores appear when your instructor publishes results.`
              : scoreHidden
                ? `This ${formatKind(attempt.kind).toLowerCase()} was submitted. Your instructor has not made scores visible to students yet.`
                : `You scored ${attempt.score} of ${attempt.maxScore} points on this ${formatKind(attempt.kind).toLowerCase()}.`}
          </p>
          <div className="result-hero-meta">
            <span>
              <CalendarDays size={15} />
              {formatDateLabel(attempt.submittedAt)}
            </span>
            <span>
              <Clock3 size={15} />
              {formatKind(attempt.kind)}
            </span>
            <span>
              <FileText size={15} />
              {attempt.questionCount ?? attempt.review.length} questions
            </span>
            {attemptLine ? <span>{attemptLine}</span> : null}
          </div>
          <button
            className="btn primary"
            type="button"
            onClick={() => navigate(attempt.kind === 'assessment' ? '/assessments' : '/quizzes')}
          >
            Continue learning <ArrowRight size={15} />
          </button>
        </div>
      </div>
      {attempt.answersVisible === false || attempt.review.length === 0 ? (
        <section className="panel review-panel">
          <div className="panel-heading">
            <div>
              <h2>Answer review</h2>
              <p>
                {pending
                  ? 'Detailed answers appear when your instructor releases results.'
                  : 'Answer review is not available for this quiz yet.'}
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="panel review-panel">
          <div className="panel-heading">
            <div>
              <h2>Answer review</h2>
              <p>Review each question and your selected answer.</p>
            </div>
          </div>
          {attempt.review.map((q, i) => {
            const yours = answerLabel(q.yourAnswer);
            const multiYours = yours?.includes(',')
              ? yours.split(',').map((s) => s.trim())
              : yours
                ? [yours]
                : [];
            const yourDisplay =
              multiYours.length > 0
                ? multiYours
                    .map((label) => {
                      const opt = q.options.find((o) => o.label === label);
                      if (!opt) return label;
                      if (opt.body) return `${label}. ${opt.body}`;
                      return opt.imageUrl ? `${label} (image)` : label;
                    })
                    .join('; ')
                : null;
            return (
              <div className="review-question" key={q.questionVersionId}>
                <div className="review-question-top">
                  <span>Question {i + 1}</span>
                  <span className={`review-state ${q.correct ? 'review-right' : 'review-wrong'}`}>
                    {q.correct === true ? 'Correct' : yours ? 'Review needed' : 'Not answered'}
                  </span>
                </div>
                {q.passageText ? <div className="question-passage">{q.passageText}</div> : null}
                <b>{q.question}</b>
                {q.questionImageUrl ? (
                  <StoredImage
                    src={q.questionImageUrl}
                    alt=""
                    style={{
                      display: 'block',
                      maxWidth: '100%',
                      maxHeight: 180,
                      marginTop: 8,
                      marginBottom: 8,
                      borderRadius: 12,
                      objectFit: 'contain',
                    }}
                  />
                ) : null}
                <div className="option-list" style={{ marginTop: 12 }}>
                  {q.options.map((op) => (
                    <div
                      key={op.label}
                      className={`answer-option ${multiYours.includes(op.label) ? 'chosen' : ''}`}
                      style={{ cursor: 'default' }}
                    >
                      <span className="option-letter">{op.label}</span>
                      <span
                        style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}
                      >
                        {op.imageUrl ? (
                          <StoredImage
                            src={op.imageUrl}
                            alt=""
                            style={{
                              maxWidth: '100%',
                              maxHeight: 120,
                              borderRadius: 8,
                              objectFit: 'contain',
                            }}
                          />
                        ) : null}
                        {op.body ? <span>{op.body}</span> : null}
                      </span>
                    </div>
                  ))}
                </div>
                <p>Your answer: {yourDisplay ?? 'Not answered'}</p>
                {q.correctLabels.length > 0 && (
                  <div className="review-explanation">
                    <CheckCircle2 size={16} />
                    <span>
                      <b>Correct answer</b>
                      {q.correctLabels
                        .map((label) => {
                          const opt = q.options.find((o) => o.label === label);
                          if (!opt) return label;
                          if (opt.body) return `${label}. ${opt.body}`;
                          return opt.imageUrl ? `${label} (image)` : label;
                        })
                        .join(', ')}
                    </span>
                  </div>
                )}
                {q.explanation ? <p className="review-explanation-text">{q.explanation}</p> : null}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
