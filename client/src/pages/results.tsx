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
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  answerLabel,
  formatDateLabel,
  formatKind,
  Heading,
} from '../components/ui-bits';
import { getResult, listResults } from '../services/api';
import type { StudentResultDetail, StudentResultSummary } from '../services/types';

export function ResultsPage() {
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState<StudentResultSummary[]>([]);
  const [filter, setFilter] = useState('All');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listResults('all');
        if (!cancelled) setAttempts(rows);
      } catch {
        if (!cancelled) setError('Unable to load results.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const average =
    attempts.length > 0
      ? Math.round(attempts.reduce((s, a) => s + a.percent, 0) / attempts.length)
      : null;

  return (
    <div className="page-stack">
      <Heading
        eyebrow="YOUR LEARNING JOURNEY"
        title="My results"
        description="Review your completed attempts and see how your confidence is growing."
        action={
          <button className="btn primary" type="button" onClick={() => navigate('/quizzes')}>
            <BookOpen size={16} /> Find an activity
          </button>
        }
      />
      {error && <div className="error-text">{error}</div>}
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
          <b>
            {attempts.length ? `${Math.max(...attempts.map((a) => Math.round(a.percent)))}%` : '—'}
          </b>
        </div>
      </div>
      <div className="results-toolbar">
        <div>
          <h2>Attempt history</h2>
          <p>Your most recent submissions appear first.</p>
        </div>
        <select aria-label="Filter results" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option>All</option>
          <option>Quiz</option>
          <option>Assessment</option>
        </select>
      </div>
      {!list.length ? (
        <div className="panel empty-state results-empty">
          <div className="empty-icon">
            <Trophy size={22} />
          </div>
          <b>No results yet</b>
          <span>Once you submit a quiz or assessment, your score and attempt details will appear here.</span>
          <button className="btn primary" type="button" onClick={() => navigate('/quizzes')}>
            Start a quiz <ArrowRight size={15} />
          </button>
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
                  <b>{a.title}</b>
                  <small>
                    {a.maxScore} points · {a.durationMinutes ?? '—'} min
                  </small>
                </span>
              </div>
              <span className="table-type">{formatKind(a.kind)}</span>
              <span>{formatDateLabel(a.submittedAt)}</span>
              <span className={`table-score ${a.percent >= 60 ? 'good' : 'low'}`}>
                {Math.round(a.percent)}%
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

  if (loading) return <div className="page-stack">Loading result…</div>;

  if (!attempt) {
    return (
      <div className="page-stack">
        <button className="text-btn" type="button" onClick={() => navigate('/results')}>
          <ArrowLeft size={15} /> Back to results
        </button>
        <div className="panel empty-state">
          <b>Result not found</b>
          <span>{error || 'This result is not available for your account.'}</span>
          <button className="btn primary" type="button" onClick={() => navigate('/results')}>
            Go to results
          </button>
        </div>
      </div>
    );
  }

  const percent = Math.round(attempt.percent);

  return (
    <div className="page-stack">
      <button className="back-link" type="button" onClick={() => navigate('/results')}>
        <ArrowLeft size={15} /> Back to results
      </button>
      <Heading eyebrow="ATTEMPT SUMMARY" title="Your result" description={attempt.title} />
      <div className="result-hero panel">
        <div className={`result-ring ${percent >= 60 ? 'passed' : 'needs-work'}`}>
          <div>
            <strong>{percent}%</strong>
            <span>Score</span>
          </div>
        </div>
        <div className="result-hero-copy">
          <span className="result-label">
            <CheckCircle2 size={15} />
            {percent >= 60 ? 'Good progress' : 'Keep practising'}
          </span>
          <h2>
            {percent >= 60
              ? 'You’re building strong momentum.'
              : 'Every attempt is a chance to improve.'}
          </h2>
          <p>
            You scored {attempt.score} of {attempt.maxScore} points on this {formatKind(attempt.kind).toLowerCase()}.
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
              {attempt.review.length} questions
            </span>
          </div>
          <button className="btn primary" type="button" onClick={() => navigate('/quizzes')}>
            Continue learning <ArrowRight size={15} />
          </button>
        </div>
      </div>
      <section className="panel review-panel">
        <div className="panel-heading">
          <div>
            <h2>Answer review</h2>
            <p>Review each question and your selected answer.</p>
          </div>
        </div>
        {attempt.review.map((q, i) => {
          const yours = answerLabel(q.yourAnswer);
          const yourBody = q.options.find((o) => o.label === yours)?.body;
          return (
            <div className="review-question" key={q.questionVersionId}>
              <div className="review-question-top">
                <span>Question {i + 1}</span>
                <span
                  className={`review-state ${q.correct ? 'review-right' : 'review-wrong'}`}
                >
                  {q.correct === true ? 'Correct' : yours ? 'Review needed' : 'Not answered'}
                </span>
              </div>
              <b>{q.stem}</b>
              <p>Your answer: {yours ? `${yours}. ${yourBody ?? ''}` : 'Not answered'}</p>
              {q.correctLabels.length > 0 && (
                <div className="review-explanation">
                  <CheckCircle2 size={16} />
                  <span>
                    <b>Correct answer</b>
                    {q.correctLabels
                      .map((label) => {
                        const body = q.options.find((o) => o.label === label)?.body;
                        return body ? `${label}. ${body}` : label;
                      })
                      .join(', ')}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
