import { ArrowLeft, ArrowRight, Check, Clock3, Flag, LogOut, ShieldCheck, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { ExamShellSkeleton } from '../components/skeletons';
import { StoredImage } from '../components/stored-image';
import { useLeaveGuard } from '../hooks/use-leave-guard';
import { ApiError } from '../lib/api-client';
import {
  answerFromResponse,
  instructionForType,
  isAnswered,
  isMultiSelectType,
  isSingleSelectType,
  type AnswerMap,
  type AttemptAnswerValue,
} from '../lib/attempt-answers';
import { timeRemaining } from '../lib/format';
import {
  clearSubmitIdempotencyKey,
  resumeAttempt,
  saveAttempt,
  saveAttemptKeepalive,
  startAttempt,
  studentSignOut,
  submitAttempt,
  submitIdempotencyKeyFor,
} from '../services/api';
import type { AttemptQuestion, AttemptState } from '../services/types';

export function AttemptPage({ mode }: { mode: 'resume' | 'start' }) {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const roundIdParam = searchParams.get('roundId') ?? undefined;
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<AttemptState | null>(null);
  const [questions, setQuestions] = useState<AttemptQuestion[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [marked, setMarked] = useState<number[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [exitConfirm, setExitConfirm] = useState(false);
  const [allowLeave, setAllowLeave] = useState(false);
  const [error, setError] = useState('');
  const [proctorWarn, setProctorWarn] = useState('');
  const [busy, setBusy] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingInFlight, setSavingInFlight] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);
  const revisionRef = useRef(0);
  const saveTimer = useRef<number | null>(null);
  const pendingAnswersRef = useRef<AnswerMap | null>(null);
  const persistRef = useRef<(next: AnswerMap) => Promise<void>>(async () => {});
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const autoSubmitted = useRef(false);
  const sessionEndedRef = useRef(false);
  const answersRef = useRef<AnswerMap>({});
  const attemptIdRef = useRef<string | null>(null);

  useLeaveGuard(
    !allowLeave && (Boolean(attempt && !busy) || submitting || savingInFlight || pendingSave),
  );

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      if (mode === 'start') {
        const data = await startAttempt(id, roundIdParam);
        attemptIdRef.current = data.attempt.id;
        setAttempt(data.attempt);
        setQuestions(data.questions);
        revisionRef.current = data.attempt.revision;
        setAnswers({});
        answersRef.current = {};
        const remaining = Math.max(
          0,
          Math.ceil((new Date(data.attempt.deadlineAt).getTime() - Date.now()) / 1000),
        );
        setSeconds(remaining);
      } else {
        const data = await resumeAttempt(id);
        if (data.submitted && data.result) {
          clearSubmitIdempotencyKey(data.attempt.id);
          if (data.attempt.roundId) {
            navigate(`/assessments/${data.attempt.activityId}`, { replace: true });
          } else {
            navigate(`/results/${data.result.id}`, { replace: true });
          }
          return;
        }
        attemptIdRef.current = data.attempt.id;
        setAttempt(data.attempt);
        setQuestions(data.questions);
        revisionRef.current = data.attempt.revision;
        const mapped: AnswerMap = {};
        for (const r of data.attempt.responses) {
          const parsed = answerFromResponse(r.answer);
          if (parsed) mapped[r.questionVersionId] = parsed;
        }
        setAnswers(mapped);
        answersRef.current = mapped;
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
    async (nextAnswers: AnswerMap) => {
      if (!attempt || sessionEndedRef.current) return;
      const responses = Object.entries(nextAnswers).map(([questionVersionId, answer]) => ({
        questionVersionId,
        answer,
      }));
      if (responses.length === 0) return;
      setSavingInFlight(true);
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
      } finally {
        setSavingInFlight(false);
      }
    },
    [attempt, load, navigate],
  );

  persistRef.current = persist;

  function enqueueSave(next: AnswerMap) {
    saveChainRef.current = saveChainRef.current
      .catch(() => undefined)
      .then(() => persistRef.current(next));
    return saveChainRef.current;
  }

  function queueSave(next: AnswerMap) {
    if (sessionEndedRef.current) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    pendingAnswersRef.current = next;
    setPendingSave(true);
    saveTimer.current = window.setTimeout(() => {
      const latest = pendingAnswersRef.current ?? next;
      pendingAnswersRef.current = null;
      setPendingSave(false);
      void enqueueSave(latest);
    }, 400);
  }

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

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
    const flushKeepalive = () => {
      if (sessionEndedRef.current) return;
      const attemptId = attemptIdRef.current;
      if (!attemptId) return;
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      const latest = pendingAnswersRef.current ?? answersRef.current;
      pendingAnswersRef.current = null;
      const responses = Object.entries(latest).map(([questionVersionId, answer]) => ({
        questionVersionId,
        answer,
      }));
      saveAttemptKeepalive(attemptId, revisionRef.current, responses);
    };
    window.addEventListener('pagehide', flushKeepalive);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushKeepalive();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flushKeepalive);
      document.removeEventListener('visibilitychange', onVisibility);
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
      const key = submitIdempotencyKeyFor(attempt.id);
      try {
        if (Object.keys(latest).length) await enqueueSave(latest);
        await saveChainRef.current.catch(() => undefined);
        const data = await submitAttempt(attempt.id, key);
        clearSubmitIdempotencyKey(attempt.id);
        if (attempt.roundId) {
          navigate(`/assessments/${attempt.activityId}`, { replace: true });
        } else {
          navigate(`/results/${data.result.id}`, { replace: true });
        }
      } catch (err) {
        // Response may have committed on the server — align UI.
        try {
          const resumed = await resumeAttempt(attempt.id);
          if (resumed.submitted && resumed.result) {
            clearSubmitIdempotencyKey(attempt.id);
            setError('');
            if (attempt.roundId) {
              navigate(`/assessments/${attempt.activityId}`, { replace: true });
            } else {
              navigate(`/results/${resumed.result.id}`, { replace: true });
            }
            return;
          }
        } catch {
          /* fall through to error */
        }
        setError(
          err instanceof ApiError
            ? err.message
            : 'Submit failed. If you already submitted, reload to see your result.',
        );
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

  function setAnswer(questionVersionId: string, answer: AttemptAnswerValue) {
    const next = { ...answers, [questionVersionId]: answer };
    setAnswers(next);
    queueSave(next);
  }

  function exitDestination() {
    if (!attempt) return '/dashboard';
    if (attempt.roundId || attempt.activityKind === 'assessment') {
      return `/assessments/${attempt.activityId}`;
    }
    return `/quizzes/${attempt.activityId}`;
  }

  async function confirmExit() {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const latest = pendingAnswersRef.current ?? answers;
    pendingAnswersRef.current = null;
    try {
      if (Object.keys(latest).length) await enqueueSave(latest);
      await saveChainRef.current.catch(() => undefined);
    } catch {
      /* still allow leave — keepalive flush may have covered it */
    }
    setAllowLeave(true);
    setExitConfirm(false);
    navigate(exitDestination());
  }

  const answeredCount = useMemo(
    () => Object.values(answers).filter((a) => isAnswered(a)).length,
    [answers],
  );
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

  const current = answers[q.questionVersionId];
  const singleChosen = current && 'label' in current ? current.label : null;
  const multiChosen = current && 'labels' in current ? new Set(current.labels) : new Set<string>();
  const numericValue =
    current && 'value' in current && Number.isFinite(current.value) ? String(current.value) : '';
  const textValue = current && 'text' in current ? current.text : '';

  return (
    <div className="exam-page">
      <header className="exam-topbar">
        <button className="exam-brand" type="button" onClick={() => setExitConfirm(true)}>
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
        <button className="btn outline exit-btn" type="button" onClick={() => setExitConfirm(true)}>
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
            {q.passageText ? (
              <div
                className="question-passage"
                style={{
                  marginBottom: 16,
                  padding: 12,
                  borderRadius: 12,
                  border: '1px solid var(--border, #e5e7eb)',
                  whiteSpace: 'pre-wrap',
                  maxHeight: 220,
                  overflow: 'auto',
                }}
              >
                {q.passageText}
              </div>
            ) : null}
            {q.questionImageUrl ? (
              <StoredImage
                src={q.questionImageUrl}
                alt=""
                style={{
                  display: 'block',
                  maxWidth: '100%',
                  maxHeight: 220,
                  marginBottom: 12,
                  borderRadius: 12,
                  objectFit: 'contain',
                }}
              />
            ) : null}
            <h1>{q.question}</h1>
            <p className="question-instruction">{instructionForType(q.type)}</p>

            {isSingleSelectType(q.type) || isMultiSelectType(q.type) ? (
              <div className="option-list">
                {q.options.map((op) => {
                  const chosen = isMultiSelectType(q.type)
                    ? multiChosen.has(op.label)
                    : singleChosen === op.label;
                  return (
                    <button
                      key={op.id}
                      type="button"
                      className={`answer-option ${chosen ? 'chosen' : ''}`}
                      onClick={() => {
                        if (isMultiSelectType(q.type)) {
                          const next = new Set(multiChosen);
                          if (next.has(op.label)) next.delete(op.label);
                          else next.add(op.label);
                          setAnswer(q.questionVersionId, { labels: [...next] });
                        } else {
                          setAnswer(q.questionVersionId, { label: op.label });
                        }
                      }}
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
                              maxHeight: 140,
                              borderRadius: 8,
                              objectFit: 'contain',
                            }}
                          />
                        ) : null}
                        <span>{op.body}</span>
                      </span>
                      {chosen && <Check size={17} className="option-check" />}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {q.type === 'numeric' ? (
              <div className="option-list">
                <label className="answer-option" style={{ cursor: 'default' }}>
                  <span className="option-letter">#</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={numericValue}
                    aria-label="Numeric answer"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      border: 'none',
                      background: 'transparent',
                      font: 'inherit',
                      outline: 'none',
                    }}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw.trim() === '') {
                        const next = { ...answers };
                        delete next[q.questionVersionId];
                        setAnswers(next);
                        queueSave(next);
                        return;
                      }
                      const num = Number(raw);
                      if (!Number.isNaN(num)) setAnswer(q.questionVersionId, { value: num });
                    }}
                  />
                </label>
              </div>
            ) : null}

            {q.type === 'short_text' || q.type === 'long_text' ? (
              <div className="option-list">
                <textarea
                  aria-label="Text answer"
                  rows={q.type === 'long_text' ? 6 : 3}
                  value={textValue}
                  style={{
                    width: '100%',
                    minHeight: q.type === 'long_text' ? 140 : 88,
                    resize: 'vertical',
                    borderRadius: 12,
                    border: '1px solid var(--border, #e5e7eb)',
                    padding: 12,
                    font: 'inherit',
                  }}
                  onChange={(e) => setAnswer(q.questionVersionId, { text: e.target.value })}
                />
              </div>
            ) : null}
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
                className={`question-number ${qIndex === i ? 'current' : ''} ${isAnswered(answers[question.questionVersionId]) ? 'answered' : ''} ${marked.includes(i) ? 'marked' : ''}`}
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
      {exitConfirm && (
        <div className="modal-backdrop">
          <div className="confirm-modal" role="dialog" aria-labelledby="exit-attempt-title">
            <div className="modal-icon">
              <LogOut size={22} />
            </div>
            <button
              className="modal-close icon-btn"
              type="button"
              onClick={() => setExitConfirm(false)}
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <h2 id="exit-attempt-title">Leave attempt?</h2>
            <p>
              Your answers are saved. You can return later with Continue before the deadline.
              Leaving does not submit your attempt.
            </p>
            <div className="modal-actions">
              <button className="btn outline" type="button" onClick={() => setExitConfirm(false)}>
                Stay
              </button>
              <button className="btn primary" type="button" onClick={() => void confirmExit()}>
                Leave attempt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
