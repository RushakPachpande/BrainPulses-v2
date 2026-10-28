import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Flag,
  LogOut,
  ShieldCheck,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { AttemptQuestionBlock } from '../components/attempt-question-block';
import { ExamShellSkeleton } from '../components/skeletons';
import { useLeaveGuard } from '../hooks/use-leave-guard';
import { ApiError } from '../lib/api-client';
import {
  answerFromResponse,
  isAnswered,
  type AnswerMap,
  type AttemptAnswerValue,
} from '../lib/attempt-answers';
import { timeRemaining } from '../lib/format';
import {
  clearSubmitIdempotencyKey,
  listActivities,
  resumeAttempt,
  saveAttempt,
  saveAttemptKeepalive,
  startAttempt,
  studentSignOut,
  submitAttempt,
  submitIdempotencyKeyFor,
} from '../services/api';
import type { AttemptPresentation, AttemptQuestion, AttemptState } from '../services/types';

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
  const [presentation, setPresentation] = useState<AttemptPresentation>('one_at_a_time');
  const [forwardOnly, setForwardOnly] = useState(false);
  const [showQuestionPanel, setShowQuestionPanel] = useState(true);
  const [maxVisitedIndex, setMaxVisitedIndex] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [exitConfirm, setExitConfirm] = useState(false);
  /** Pending destination index when confirming leave of an unanswered question. */
  const [skipConfirmIndex, setSkipConfirmIndex] = useState<number | null>(null);
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

  const applyLoadedAttempt = useCallback(
    (data: { attempt: AttemptState; questions: AttemptQuestion[] }) => {
      attemptIdRef.current = data.attempt.id;
      setAttempt(data.attempt);
      setQuestions(data.questions);
      setPresentation(
        data.attempt.presentation === 'all_on_page' ? 'all_on_page' : 'one_at_a_time',
      );
      const fo =
        data.attempt.forwardOnly === true ||
        data.attempt.durationMode === 'per_question' ||
        data.attempt.allowPrevious === false;
      setForwardOnly(fo);
      setShowQuestionPanel(data.attempt.showQuestionPanel !== false);
      setMaxVisitedIndex(0);
      setQIndex(0);
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
    },
    [],
  );

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      if (mode === 'start') {
        let data: { attempt: AttemptState; questions: AttemptQuestion[] };
        try {
          data = await startAttempt(id, roundIdParam);
        } catch (err) {
          // A second Start (Strict Mode, or a double click) finds the attempt the first Start created.
          if (
            !(err instanceof ApiError) ||
            err.status !== 409 ||
            !err.message.includes('Resume it instead')
          ) {
            throw err;
          }
          const rows = await listActivities('all');
          const openId = rows.find((row) => row.activityId === id)?.openAttemptId;
          if (!openId) throw err;
          data = await resumeAttempt(openId);
        }
        applyLoadedAttempt(data);
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
        applyLoadedAttempt(data);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to open attempt.');
    } finally {
      setBusy(false);
    }
  }, [applyLoadedAttempt, id, mode, navigate, roundIdParam]);

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

  const allOnPage = presentation === 'all_on_page';

  useEffect(() => {
    setMaxVisitedIndex((prev) => Math.max(prev, qIndex));
  }, [qIndex]);

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
      // The guard must be off before navigate() runs, so commit the state synchronously.
      const leaveSubmitted = (resultId: string) => {
        flushSync(() => {
          setAllowLeave(true);
          setMarked([]);
        });
        navigate(attempt.roundId ? `/assessments/${attempt.activityId}` : `/results/${resultId}`, {
          replace: true,
        });
      };
      try {
        if (Object.keys(latest).length) await enqueueSave(latest);
        await saveChainRef.current.catch(() => undefined);
        const data = await submitAttempt(attempt.id, key);
        clearSubmitIdempotencyKey(attempt.id);
        leaveSubmitted(data.result.id);
      } catch (err) {
        // Response may have committed on the server — align UI.
        try {
          const resumed = await resumeAttempt(attempt.id);
          if (resumed.submitted && resumed.result) {
            clearSubmitIdempotencyKey(attempt.id);
            setError('');
            leaveSubmitted(resumed.result.id);
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

  function clearAnswer(questionVersionId: string) {
    const next = { ...answers };
    delete next[questionVersionId];
    setAnswers(next);
    queueSave(next);
  }

  function advanceToQuestion(index: number) {
    if (allOnPage) {
      document.getElementById(`attempt-q-${index}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
    setQIndex(index);
  }

  function shouldWarnBeforeLeavingUnanswered() {
    const current = questions[qIndex];
    if (!current) return false;
    if (isAnswered(answers[current.questionVersionId])) return false;
    // One-at-a-time, or forward-only (Previous / earlier overview locked).
    return !allOnPage || forwardOnly;
  }

  function goToQuestion(index: number) {
    if (forwardOnly) {
      // One-at-a-time: no sidebar jumps — only Next / Previous chrome advances.
      if (!allOnPage && index !== qIndex) return;
      // All-on-page: may jump forward, never back past farthest visited.
      if (allOnPage && index < maxVisitedIndex) return;
    }
    if (index === qIndex) {
      advanceToQuestion(index);
      return;
    }
    // Warn when moving ahead past an unanswered question they may not return to.
    if (index > qIndex && shouldWarnBeforeLeavingUnanswered()) {
      setSkipConfirmIndex(index);
      return;
    }
    advanceToQuestion(index);
  }

  function confirmSkipUnanswered() {
    if (skipConfirmIndex == null) return;
    const next = skipConfirmIndex;
    setSkipConfirmIndex(null);
    advanceToQuestion(next);
  }

  function requestNext() {
    const next = qIndex + 1;
    if (next >= questions.length) return;
    if (shouldWarnBeforeLeavingUnanswered()) {
      setSkipConfirmIndex(next);
      return;
    }
    advanceToQuestion(next);
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
  const allAnswered = questions.length > 0 && answeredCount === questions.length;
  const markedSorted = useMemo(() => [...marked].sort((a, b) => a - b), [marked]);
  const q = questions[qIndex];

  function requestSubmit() {
    if (!allAnswered || submitting) return;
    void doSubmit(false);
  }

  function reviewMarked() {
    setConfirm(false);
    const first = markedSorted[0];
    if (first !== undefined) setQIndex(first);
  }

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

  if (!attempt || questions.length === 0 || (!allOnPage && !q)) return null;

  const saving = savingInFlight || pendingSave;
  const progressRatio = allOnPage
    ? answeredCount / questions.length
    : (qIndex + 1) / questions.length;

  return (
    <div className="exam-page">
      <header className="exam-topbar">
        <button className="exam-brand" type="button" onClick={() => setExitConfirm(true)}>
          <img src="/brand.svg" alt="" />
          BrainPulses
        </button>
        <div className="exam-activity-title">
          <span>Attempt</span>
          <b>{allOnPage ? 'All on one page' : 'In progress'}</b>
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
        <div style={{ width: `${progressRatio * 100}%` }} />
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
      <div
        className={`exam-layout ${allOnPage ? 'all-on-page' : ''} ${showQuestionPanel ? '' : 'no-question-panel'}`.trim()}
      >
        <section className="question-column">
          {allOnPage ? (
            questions.map((question, i) => (
              <AttemptQuestionBlock
                key={question.questionVersionId}
                id={`attempt-q-${i}`}
                question={question}
                index={i}
                total={questions.length}
                answer={answers[question.questionVersionId]}
                marked={marked.includes(i)}
                onAnswer={(value) => setAnswer(question.questionVersionId, value)}
                onClear={() => clearAnswer(question.questionVersionId)}
                onToggleMarked={() =>
                  setMarked((p) => (p.includes(i) ? p.filter((idx) => idx !== i) : [...p, i]))
                }
              />
            ))
          ) : q ? (
            <AttemptQuestionBlock
              question={q}
              index={qIndex}
              total={questions.length}
              answer={answers[q.questionVersionId]}
              marked={marked.includes(qIndex)}
              onAnswer={(value) => setAnswer(q.questionVersionId, value)}
              onClear={() => clearAnswer(q.questionVersionId)}
              onToggleMarked={() =>
                setMarked((p) =>
                  p.includes(qIndex) ? p.filter((idx) => idx !== qIndex) : [...p, qIndex],
                )
              }
            />
          ) : null}
          <div className="question-footer">
            {allOnPage || forwardOnly ? (
              <span />
            ) : (
              <button
                className="btn outline"
                type="button"
                disabled={qIndex === 0}
                onClick={() => setQIndex(qIndex - 1)}
              >
                <ArrowLeft size={15} /> Previous
              </button>
            )}
            <div className="question-footer-status" id="attempt-submit-status">
              {answeredCount} of {questions.length} answered
              {saving ? ' · Saving…' : ''}
              {!allAnswered ? ' · Answer every question to submit' : ''}
            </div>
            {allOnPage || qIndex >= questions.length - 1 ? (
              <button
                className="btn primary"
                type="button"
                disabled={submitting || !allAnswered}
                aria-describedby="attempt-submit-status"
                onClick={requestSubmit}
              >
                Submit attempt <Check size={16} />
              </button>
            ) : (
              <button className="btn primary" type="button" onClick={requestNext}>
                Next question <ArrowRight size={15} />
              </button>
            )}
          </div>
        </section>
        {showQuestionPanel ? (
          <aside className="question-sidebar">
            <div className="question-sidebar-head">
              <div>
                <h2>Question overview</h2>
                <p>
                  {forwardOnly && !allOnPage
                    ? 'Use Next to move ahead. Other questions are locked in the overview.'
                    : forwardOnly
                      ? 'Earlier questions are locked. Move forward only.'
                      : allOnPage
                        ? 'Jump to any question on the page.'
                        : 'Navigate through your attempt.'}
                </p>
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
              {questions.map((question, i) => {
                const locked = forwardOnly
                  ? allOnPage
                    ? i < maxVisitedIndex
                    : i !== qIndex
                  : false;
                return (
                  <button
                    key={question.questionVersionId}
                    type="button"
                    disabled={locked}
                    className={`question-number ${!allOnPage && qIndex === i ? 'current' : ''} ${isAnswered(answers[question.questionVersionId]) ? 'answered' : ''} ${marked.includes(i) ? 'marked' : ''} ${locked ? 'is-locked' : ''}`}
                    onClick={() => goToQuestion(i)}
                    aria-label={locked ? `Question ${i + 1} locked` : `Go to question ${i + 1}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
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
            {allAnswered ? (
              <button
                className="btn primary full"
                type="button"
                disabled={submitting}
                onClick={requestSubmit}
              >
                Submit attempt <ArrowRight size={15} />
              </button>
            ) : null}
            <p className="autosave-note">
              <ShieldCheck size={14} /> Answers are saved to the server as you go.
            </p>
          </aside>
        ) : null}
      </div>
      {confirm && (
        <div className="modal-backdrop">
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-attempt-title"
            aria-describedby="submit-attempt-desc"
          >
            <div className={`modal-icon ${markedSorted.length ? 'warning' : ''}`}>
              {markedSorted.length ? <TriangleAlert size={22} /> : <Flag size={22} />}
            </div>
            <button
              className="modal-close icon-btn"
              type="button"
              onClick={() => setConfirm(false)}
              aria-label="Close"
            >
              <X size={18} />
            </button>
            {markedSorted.length ? (
              <>
                <h2 id="submit-attempt-title">Questions marked for review</h2>
                <p id="submit-attempt-desc">
                  You marked{' '}
                  <b>
                    {markedSorted.length} {markedSorted.length === 1 ? 'question' : 'questions'}
                  </b>{' '}
                  for review ({markedSorted.map((i) => `Q${i + 1}`).join(', ')}). Please confirm you
                  want to submit. You can&apos;t change answers after submitting.
                </p>
              </>
            ) : (
              <>
                <h2 id="submit-attempt-title">Submit your attempt?</h2>
                <p id="submit-attempt-desc">
                  You have answered all <b>{questions.length}</b> questions. You can&apos;t change
                  answers after submitting.
                </p>
              </>
            )}
            <div className="modal-actions">
              <button
                className="btn outline"
                type="button"
                onClick={markedSorted.length ? reviewMarked : () => setConfirm(false)}
              >
                {markedSorted.length ? 'Review marked' : 'Review answers'}
              </button>
              <button
                className="btn primary"
                type="button"
                disabled={submitting}
                onClick={() => void doSubmit(true)}
              >
                {markedSorted.length ? 'Submit anyway' : 'Submit attempt'}
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
      {skipConfirmIndex != null && (
        <div className="modal-backdrop">
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="skip-unanswered-title"
            aria-describedby="skip-unanswered-desc"
          >
            <div className="modal-icon warning">
              <TriangleAlert size={22} />
            </div>
            <button
              className="modal-close icon-btn"
              type="button"
              onClick={() => setSkipConfirmIndex(null)}
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <h2 id="skip-unanswered-title">Leave this question unanswered?</h2>
            <p id="skip-unanswered-desc">
              {forwardOnly
                ? 'You have not answered this question. You cannot go back to it after you leave. Continue anyway?'
                : 'You have not answered this question. Continue to the next question?'}
            </p>
            <div className="modal-actions">
              <button
                className="btn outline"
                type="button"
                onClick={() => setSkipConfirmIndex(null)}
              >
                Stay and answer
              </button>
              <button className="btn primary" type="button" onClick={confirmSkipUnanswered}>
                Continue without answering
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
