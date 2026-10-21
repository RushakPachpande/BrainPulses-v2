import { ArrowLeft, ArrowRight, Check, Clock3, Flag, LogOut, ShieldCheck, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { ExamShellSkeleton } from '../components/skeletons';
import { ApiError } from '../lib/api-client';
import { timeRemaining } from '../lib/format';
import {
  resumeAttempt,
  saveAttempt,
  startAttempt,
  studentSignOut,
  submitAttempt,
} from '../services/api';
import type { AttemptQuestion, AttemptState } from '../services/types';

function selectedLabel(answer: unknown): string | null {
  if (answer && typeof answer === 'object' && 'label' in answer) {
    const label = (answer as { label: unknown }).label;
    return typeof label === 'string' ? label : null;
  }
  return null;
}

export function AttemptPage({ mode }: { mode: 'resume' | 'start' }) {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const roundIdParam = searchParams.get('roundId') ?? undefined;
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<AttemptState | null>(null);
  const [questions, setQuestions] = useState<AttemptQuestion[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [marked, setMarked] = useState<number[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [proctorWarn, setProctorWarn] = useState('');
  const [busy, setBusy] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const revisionRef = useRef(0);
  const saveTimer = useRef<number | null>(null);
  const pendingAnswersRef = useRef<Record<string, string> | null>(null);
  const persistRef = useRef<(next: Record<string, string>) => Promise<void>>(async () => {});
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const autoSubmitted = useRef(false);
  const sessionEndedRef = useRef(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      if (mode === 'start') {
        const data = await startAttempt(id, roundIdParam);
        setAttempt(data.attempt);
        setQuestions(data.questions);
        revisionRef.current = data.attempt.revision;
        setAnswers({});
        const remaining = Math.max(
          0,
          Math.ceil((new Date(data.attempt.deadlineAt).getTime() - Date.now()) / 1000),
        );
        setSeconds(remaining);
      } else {
        const data = await resumeAttempt(id);
        if (data.submitted && data.result) {
          if (data.attempt.roundId) {
            navigate(`/assessments/${data.attempt.activityId}`, { replace: true });
          } else {
            navigate(`/results/${data.result.id}`, { replace: true });
          }
          return;
        }
        setAttempt(data.attempt);
        setQuestions(data.questions);
        revisionRef.current = data.attempt.revision;
        const mapped: Record<string, string> = {};
        for (const r of data.attempt.responses) {
          const label = selectedLabel(r.answer);
          if (label) mapped[r.questionVersionId] = label;
        }
        setAnswers(mapped);
        const remaining = Math.max(
          0,
          Math.ceil((new Date(data.attempt.deadlineAt).getTime() - Date.now()) / 1000),
        );
        setSeconds(remaining);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to open attempt.');
    } finally {
      setBusy(false);
    }
  }, [id, mode, navigate, roundIdParam]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!attempt?.softProctoring) return;

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        setProctorWarn(
          'You left this tab. Stay on this page until you submit — leaving may be flagged.',
        );
      }
    };
    const block = (e: Event) => {
      e.preventDefault();
    };

    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('copy', block);
    document.addEventListener('cut', block);
    document.addEventListener('paste', block);
    document.addEventListener('contextmenu', block);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('copy', block);
      document.removeEventListener('cut', block);
      document.removeEventListener('paste', block);
      document.removeEventListener('contextmenu', block);
    };
  }, [attempt?.softProctoring]);

  useEffect(() => {
    if (!proctorWarn) return;
    const t = window.setTimeout(() => setProctorWarn(''), 6000);
    return () => window.clearTimeout(t);
  }, [proctorWarn]);

  const persist = useCallback(
    async (nextAnswers: Record<string, string>) => {
      if (!attempt || sessionEndedRef.current) return;
      const responses = Object.entries(nextAnswers).map(([questionVersionId, label]) => ({
        questionVersionId,
        answer: { label },
      }));
      if (responses.length === 0) return;
      try {
        const saved = await saveAttempt(attempt.id, revisionRef.current, responses);
        revisionRef.current = saved.revision;
        setAttempt(saved.attempt);
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          setError('Your attempt was updated elsewhere. Reloading…');
          await load();
          return;
        }
        if (err instanceof ApiError && err.status === 401) {
          sessionEndedRef.current = true;
          if (saveTimer.current) {
            window.clearTimeout(saveTimer.current);
            saveTimer.current = null;
          }
          pendingAnswersRef.current = null;
          void studentSignOut();
          setError('Your session ended. Sign in again to continue.');
          navigate('/login', { replace: true });
          return;
        }
        setError(
          err instanceof ApiError
            ? err.message
            : 'Could not save your answers. Check your connection and try again.',
        );
      }
    },
    [attempt, load, navigate],
  );

  persistRef.current = persist;

  function enqueueSave(next: Record<string, string>) {
    saveChainRef.current = saveChainRef.current
      .catch(() => undefined)
      .then(() => persistRef.current(next));
    return saveChainRef.current;
  }

  function queueSave(next: Record<string, string>) {
    if (sessionEndedRef.current) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    pendingAnswersRef.current = next;
    saveTimer.current = window.setTimeout(() => {
      const latest = pendingAnswersRef.current ?? next;
      pendingAnswersRef.current = null;
      void enqueueSave(latest);
    }, 400);
  }

  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      const pending = pendingAnswersRef.current;
      pendingAnswersRef.current = null;
      if (pending) void enqueueSave(pending);
    };
  }, []);

  useEffect(() => {
    if (!attempt || busy) return;
    const t = window.setInterval(() => {
      setSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [attempt, busy]);

  const doSubmit = useCallback(
    async (force = false) => {
      if (!attempt || submitting) return;
      if (!force) {
        setConfirm(true);
        return;
      }
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      const latest = pendingAnswersRef.current ?? answers;
      pendingAnswersRef.current = null;
      setSubmitting(true);
      setConfirm(false);
      try {
        if (Object.keys(latest).length) await enqueueSave(latest);
        await saveChainRef.current.catch(() => undefined);
        const key = `submit-${attempt.id}`;
        const data = await submitAttempt(attempt.id, key);
        if (attempt.roundId) {
          navigate(`/assessments/${attempt.activityId}`, { replace: true });
        } else {
          navigate(`/results/${data.result.id}`, { replace: true });
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Submit failed.');
        setSubmitting(false);
      }
    },
    [answers, attempt, navigate, submitting],
  );

  useEffect(() => {
    if (!attempt || busy || seconds > 0 || autoSubmitted.current) return;
    autoSubmitted.current = true;
    void doSubmit(true);
  }, [attempt, busy, doSubmit, seconds]);

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const q = questions[qIndex];

  if (busy && !attempt) {
    return <ExamShellSkeleton />;
  }

  if (error && !attempt) {
    return (
      <div className="exam-page">
        <div className="page-stack" style={{ padding: 24 }}>
          <div className="error-text">{error}</div>
          <button className="btn outline" type="button" onClick={() => navigate('/dashboard')}>
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!attempt || !q) return null;

  return (
    <div className="exam-page">
      <header className="exam-topbar">
        <button className="exam-brand" type="button" onClick={() => setConfirm(true)}>
          <img src="/brand.svg" alt="" />
          BrainPulses
        </button>
        <div className="exam-activity-title">
          <span>Attempt</span>
          <b>In progress</b>
        </div>
        <div className={`exam-timer ${seconds < 300 ? 'timer-warning' : ''}`}>
          <Clock3 size={17} />
          <div>
            <span>Time remaining</span>
            <b>{timeRemaining(seconds)}</b>
          </div>
        </div>
        <button className="btn outline exit-btn" type="button" onClick={() => setConfirm(true)}>
          <LogOut size={15} /> Exit
        </button>
      </header>
      <div className="exam-progress">
        <div style={{ width: `${((qIndex + 1) / questions.length) * 100}%` }} />
      </div>
      {error && (
        <div className="error-text" style={{ padding: '8px 16px' }}>
          {error}
        </div>
      )}
      {proctorWarn && (
        <div className="error-text" role="status" style={{ padding: '8px 16px' }}>
          {proctorWarn}
        </div>
      )}
      <div className="exam-layout">
        <section className="question-column">
          <div className="question-topline">
            <span>
              QUESTION {String(qIndex + 1).padStart(2, '0')}{' '}
              <span className="question-total">/ {String(questions.length).padStart(2, '0')}</span>
            </span>
            <button
              className={`mark-btn ${marked.includes(qIndex) ? 'marked' : ''}`}
              type="button"
              onClick={() =>
                setMarked((p) =>
                  p.includes(qIndex) ? p.filter((i) => i !== qIndex) : [...p, qIndex],
                )
              }
            >
              <Flag size={15} />
              {marked.includes(qIndex) ? 'Marked for review' : 'Mark for review'}
            </button>
          </div>
          <div className="question-card">
            <div className="question-context">ASSESSMENT QUESTION</div>
            <h1>{q.stem}</h1>
            <p className="question-instruction">Choose one answer from the options below.</p>
            <div className="option-list">
              {q.options.map((op) => {
                const chosen = answers[q.questionVersionId] === op.label;
                return (
                  <button
                    key={op.id}
                    type="button"
                    className={`answer-option ${chosen ? 'chosen' : ''}`}
                    onClick={() => {
                      const next = {
                        ...answers,
                        [q.questionVersionId]: op.label,
                      };
                      setAnswers(next);
                      queueSave(next);
                    }}
                  >
                    <span className="option-letter">{op.label}</span>
                    <span>{op.body}</span>
                    {chosen && <Check size={17} className="option-check" />}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="question-footer">
            <button
              className="btn outline"
              type="button"
              disabled={qIndex === 0}
              onClick={() => setQIndex(qIndex - 1)}
            >
              <ArrowLeft size={15} /> Previous
            </button>
            <div className="question-footer-status">
              {answeredCount} of {questions.length} answered
            </div>
            {qIndex < questions.length - 1 ? (
              <button className="btn primary" type="button" onClick={() => setQIndex(qIndex + 1)}>
                Next question <ArrowRight size={15} />
              </button>
            ) : (
              <button
                className="btn primary"
                type="button"
                disabled={submitting}
                onClick={() => void doSubmit(false)}
              >
                Submit attempt <Check size={16} />
              </button>
            )}
          </div>
        </section>
        <aside className="question-sidebar">
          <div className="question-sidebar-head">
            <div>
              <h2>Question overview</h2>
              <p>Navigate through your attempt.</p>
            </div>
            <span className="question-counter">
              {answeredCount}/{questions.length}
            </span>
          </div>
          <div className="legend">
            <span>
              <i className="legend-answered" />
              Answered
            </span>
            <span>
              <i className="legend-marked" />
              Review
            </span>
            <span>
              <i className="legend-empty" />
              Unanswered
            </span>
          </div>
          <div className="question-grid">
            {questions.map((question, i) => (
              <button
                key={question.questionVersionId}
                type="button"
                className={`question-number ${qIndex === i ? 'current' : ''} ${answers[question.questionVersionId] ? 'answered' : ''} ${marked.includes(i) ? 'marked' : ''}`}
                onClick={() => setQIndex(i)}
                aria-label={`Go to question ${i + 1}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="sidebar-divider" />
          <div className="attempt-summary">
            <div>
              <span>Answered</span>
              <b>{answeredCount}</b>
            </div>
            <div>
              <span>Unanswered</span>
              <b>{questions.length - answeredCount}</b>
            </div>
            <div>
              <span>Marked for review</span>
              <b>{marked.length}</b>
            </div>
          </div>
          <button
            className="btn primary full"
            type="button"
            disabled={submitting}
            onClick={() => void doSubmit(false)}
          >
            Submit attempt <ArrowRight size={15} />
          </button>
          <p className="autosave-note">
            <ShieldCheck size={14} /> Answers are saved to the server as you go.
          </p>
        </aside>
      </div>
      {confirm && (
        <div className="modal-backdrop">
          <div className="confirm-modal">
            <div className="modal-icon">
              <Flag size={22} />
            </div>
            <button
              className="modal-close icon-btn"
              type="button"
              onClick={() => setConfirm(false)}
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <h2>Submit your attempt?</h2>
            <p>
              You have answered{' '}
              <b>
                {answeredCount} of {questions.length}
              </b>{' '}
              questions. {questions.length - answeredCount} questions are still unanswered.
            </p>
            <div className="modal-actions">
              <button className="btn outline" type="button" onClick={() => setConfirm(false)}>
                Review answers
              </button>
              <button
                className="btn primary"
                type="button"
                disabled={submitting}
                onClick={() => void doSubmit(true)}
              >
                Submit attempt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
