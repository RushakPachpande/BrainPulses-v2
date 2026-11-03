import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { AttemptQuestionBlock } from '../components/attempt-question-block';
import { PageLoader } from '../components/loading-overlay';
import { ThemeButton } from '../components/theme-button';
import { useLeaveGuard } from '../hooks/use-leave-guard';
import { useParticipantPages } from '../hooks/use-participant-pages';
import { ApiError } from '../lib/api-client';
import {
  answerFromResponse,
  isAnswered,
  type AnswerMap,
  type AttemptAnswerValue,
} from '../lib/attempt-answers';
import { timeRemaining } from '../lib/format';
import { firstEnabledParticipantPath, isParticipantPageOffError } from '../lib/participant-pages';
import {
  advanceAttempt,
  clearSubmitIdempotencyKey,
  listActivities,
  resumeAttempt,
  saveAttempt,
  saveAttemptKeepalive,
  startAttempt,
  participantSignOut,
  submitAttempt,
  submitIdempotencyKeyFor,
} from '../services/api';
import type { AttemptPresentation, AttemptQuestion, AttemptState } from '../services/types';

export function AttemptPage({ mode }: { mode: 'resume' | 'start' }) {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const roundIdParam = searchParams.get('roundId') ?? undefined;
  const navigate = useNavigate();
  const pagesQuery = useParticipantPages();
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
  /** Unanswered submit guard: overall count vs single last question. */
  const [submitUnansweredKind, setSubmitUnansweredKind] = useState<'overall' | 'last' | null>(null);
  const [exitConfirm, setExitConfirm] = useState(false);
  /** Pending destination index when confirming leave of an unanswered question. */
  const [skipConfirmIndex, setSkipConfirmIndex] = useState<number | null>(null);
  const [allowLeave, setAllowLeave] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingInFlight, setSavingInFlight] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);
  /** Per-question timer expired with no answer — do not block compulsory submit. */
  const [timedOutUnanswered, setTimedOutUnanswered] = useState<Set<string>>(() => new Set());
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
    (
      data: { attempt: AttemptState; questions: AttemptQuestion[] },
      opts?: { resume?: boolean },
    ) => {
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
      setShowQuestionPanel(
        data.attempt.durationMode === 'per_question'
          ? false
          : data.attempt.showQuestionPanel !== false,
      );
      revisionRef.current = data.attempt.revision;
      const mapped: AnswerMap = {};
      for (const r of data.attempt.responses) {
        const parsed = answerFromResponse(r.answer);
        if (parsed) mapped[r.questionVersionId] = parsed;
      }
      setAnswers(mapped);
      answersRef.current = mapped;
      setTimedOutUnanswered(new Set());
      let startIndex = 0;
      if (opts?.resume && data.questions.length > 0) {
        const firstOpen = data.questions.findIndex((q) => !isAnswered(mapped[q.questionVersionId]));
        startIndex = firstOpen >= 0 ? firstOpen : Math.max(0, data.questions.length - 1);
      }
      setQIndex(startIndex);
      setMaxVisitedIndex(startIndex);
      autoSubmitted.current = false;
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
        let resumedOpen = false;
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
          resumedOpen = true;
        }
        applyLoadedAttempt(data, { resume: resumedOpen });
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
        applyLoadedAttempt(data, { resume: true });
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

  const pages = pagesQuery.data;
  const pageOff =
    isParticipantPageOffError(error) ||
    (attempt?.activityKind === 'quiz' && pages?.quizzes === false) ||
    (attempt?.activityKind === 'assessment' && pages?.assessments === false);

  useEffect(() => {
    if (!pages || !pageOff) return;
    navigate(firstEnabledParticipantPath(pages) ?? '/', { replace: true });
  }, [navigate, pageOff, pages]);

  useEffect(() => {
    if (!attempt?.softProctoring) return;

    const block = (e: Event) => {
      e.preventDefault();
    };

    document.addEventListener('copy', block);
    document.addEventListener('cut', block);
    document.addEventListener('paste', block);
    document.addEventListener('contextmenu', block);

    return () => {
      document.removeEventListener('copy', block);
      document.removeEventListener('cut', block);
      document.removeEventListener('paste', block);
      document.removeEventListener('contextmenu', block);
    };
  }, [attempt?.softProctoring]);

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
          void participantSignOut();
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

  const goToNextQuestionWithRenewedDeadline = useCallback(async () => {
    if (!attempt || submitting) return;
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const latest = pendingAnswersRef.current ?? answersRef.current;
    pendingAnswersRef.current = null;
    setPendingSave(false);
    try {
      if (Object.keys(latest).length) await enqueueSave(latest);
      await saveChainRef.current.catch(() => undefined);
      const data = await advanceAttempt(attempt.id);
      if (data.submitted && data.result) {
        clearSubmitIdempotencyKey(attempt.id);
        flushSync(() => setAllowLeave(true));
        navigate(
          attempt.roundId ? `/assessments/${attempt.activityId}` : `/results/${data.result.id}`,
          { replace: true },
        );
        return;
      }
      setAttempt(data.attempt);
      const remaining = Math.max(
        0,
        Math.ceil((new Date(data.attempt.deadlineAt).getTime() - Date.now()) / 1000),
      );
      setSeconds(remaining);
      autoSubmitted.current = false;
      setQIndex((i) => Math.min(i + 1, Math.max(0, questions.length - 1)));
    } catch (err) {
      autoSubmitted.current = false;
      setError(err instanceof ApiError ? err.message : 'Could not move to the next question.');
    }
  }, [attempt, navigate, questions.length, submitting]);

  useEffect(() => {
    if (!attempt || busy || seconds > 0 || autoSubmitted.current || submitting) return;
    autoSubmitted.current = true;
    if (attempt.durationMode === 'per_question') {
      const current = questions[qIndex];
      if (current && !isAnswered(answersRef.current[current.questionVersionId])) {
        setTimedOutUnanswered((prev) => {
          if (prev.has(current.questionVersionId)) return prev;
          const next = new Set(prev);
          next.add(current.questionVersionId);
          return next;
        });
      }
      const isLast = qIndex >= questions.length - 1;
      if (isLast) {
        void doSubmit(true);
      } else {
        void goToNextQuestionWithRenewedDeadline();
      }
      return;
    }
    void doSubmit(true);
  }, [
    attempt,
    busy,
    doSubmit,
    goToNextQuestionWithRenewedDeadline,
    qIndex,
    questions,
    seconds,
    submitting,
  ]);

  function setAnswer(questionVersionId: string, answer: AttemptAnswerValue) {
    setTimedOutUnanswered((prev) => {
      if (!prev.has(questionVersionId)) return prev;
      const next = new Set(prev);
      next.delete(questionVersionId);
      return next;
    });
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

  const questionsCompulsory = attempt?.questionsCompulsory !== false;

  function currentQuestionAnswered() {
    const current = questions[qIndex];
    if (!current) return true;
    return isAnswered(answers[current.questionVersionId]);
  }

  function shouldWarnBeforeLeavingUnanswered() {
    if (questionsCompulsory) return false;
    const current = questions[qIndex];
    if (!current) return false;
    if (isAnswered(answers[current.questionVersionId])) return false;
    // Warn only when they cannot return (per-question or Allow Previous off).
    return forwardOnly;
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
    if (attempt?.durationMode === 'per_question') {
      void goToNextQuestionWithRenewedDeadline();
      return;
    }
    advanceToQuestion(next);
  }

  function requestNext() {
    const next = qIndex + 1;
    if (next >= questions.length) return;
    if (questionsCompulsory && !currentQuestionAnswered()) return;
    if (attempt?.durationMode === 'per_question') {
      if (shouldWarnBeforeLeavingUnanswered()) {
        setSkipConfirmIndex(next);
        return;
      }
      void goToNextQuestionWithRenewedDeadline();
      return;
    }
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
  /**
   * Compulsory submit gate. Unanswered does not block when:
   * - the per-question timer expired on that item, or
   * - forward-only / per-question left it behind (cannot go back).
   */
  const allRequiredAnswered = useMemo(() => {
    if (questions.length === 0) return false;
    return questions.every((question, index) => {
      if (isAnswered(answers[question.questionVersionId])) return true;
      if (timedOutUnanswered.has(question.questionVersionId)) return true;
      if (!allOnPage && forwardOnly && index < qIndex) return true;
      return false;
    });
  }, [allOnPage, answers, forwardOnly, qIndex, questions, timedOutUnanswered]);
  const unansweredCount = Math.max(0, questions.length - answeredCount);
  const markedSorted = useMemo(() => [...marked].sort((a, b) => a - b), [marked]);
  const q = questions[qIndex];
  const currentAnswered = q ? isAnswered(answers[q.questionVersionId]) : true;
  const onSubmitSurface = allOnPage || qIndex >= questions.length - 1;
  const nextDisabled = questionsCompulsory && !allOnPage && !currentAnswered;
  const submitDisabled =
    submitting || (questionsCompulsory && onSubmitSurface && !allRequiredAnswered);

  function requestSubmit() {
    if (submitting) return;
    if (questionsCompulsory) {
      if (!allRequiredAnswered) return;
      void doSubmit(false);
      return;
    }
    if (!allAnswered) {
      const onLastOneAtATime = !allOnPage && qIndex >= questions.length - 1;
      setSubmitUnansweredKind(onLastOneAtATime && !currentAnswered ? 'last' : 'overall');
      return;
    }
    void doSubmit(false);
  }

  function reviewMarked() {
    setConfirm(false);
    const first = markedSorted[0];
    if (first !== undefined) setQIndex(first);
  }

  if ((busy && !attempt) || pageOff) {
    return <PageLoader />;
  }

  if (error && !attempt) {
    return (
      <div className="pg">
        <p className="portal-note">{error}</p>
        <button className="begin" type="button" onClick={() => navigate('/dashboard')}>
          Back to home
        </button>
      </div>
    );
  }

  if (!attempt || questions.length === 0 || (!allOnPage && !q)) return null;

  const saving = savingInFlight || pendingSave;
  const perq = attempt.durationMode === 'per_question';
  const low = perq ? seconds <= 3 : seconds <= 60;
  const reviewCount = marked.length;
  const dialog = confirm
    ? {
        title: `Submit your ${attempt.activityKind === 'assessment' ? 'assessment' : 'quiz'}?`,
        body: `You answered ${answeredCount} of ${questions.length} questions.${reviewCount ? ` ${reviewCount} ${reviewCount > 1 ? 'are' : 'is'} marked for review.` : ''} Once you submit, your answers cannot be changed.`,
        stay: 'Keep reviewing',
        go: 'Submit',
        onStay: () => (markedSorted.length ? reviewMarked() : setConfirm(false)),
        onGo: () => void doSubmit(true),
      }
    : exitConfirm
      ? {
          title: 'Leave this attempt?',
          body: 'Your answers are saved and the timer keeps running. You can continue from the activity page.',
          stay: 'Stay',
          go: 'Leave',
          onStay: () => setExitConfirm(false),
          onGo: () => void confirmExit(),
        }
      : submitUnansweredKind != null
        ? {
            title: 'Submit with unanswered questions?',
            body:
              submitUnansweredKind === 'last'
                ? 'You have not answered this question. Once submitted, you cannot change your answers.'
                : `You have ${unansweredCount} unanswered ${unansweredCount === 1 ? 'question' : 'questions'}. Once submitted, you cannot change your answers.`,
            stay: 'Go back',
            go: 'Submit anyway',
            onStay: () => setSubmitUnansweredKind(null),
            onGo: () => {
              setSubmitUnansweredKind(null);
              void doSubmit(true);
            },
          }
        : skipConfirmIndex != null
          ? {
              title: 'Continue without answering?',
              body: 'You have not answered this question. You cannot return to it after moving on.',
              stay: 'Stay here',
              go: 'Continue',
              onStay: () => setSkipConfirmIndex(null),
              onGo: confirmSkipUnanswered,
            }
          : null;

  return (
    <>
      <div className="qbar">
        <div className="brand">
          <img src="/brand.svg" alt="" />
          <span>BrainPulses</span>
        </div>
        <div className={`segs ${perq ? 'perq' : ''}`}>
          {questions.map((question, i) => {
            const answered = isAnswered(answers[question.questionVersionId]);
            const isMarked = marked.includes(i);
            const cls = !allOnPage && i === qIndex ? 'c' : isMarked ? 'r' : answered ? 'a' : '';
            const locked = perq || forwardOnly || !showQuestionPanel;
            return (
              <i
                key={question.questionVersionId}
                className={cls}
                title={`Question ${i + 1}`}
                role="button"
                tabIndex={locked ? -1 : 0}
                onClick={() => {
                  if (!locked) goToQuestion(i);
                }}
                onKeyDown={(event) => {
                  if ((event.key === 'Enter' || event.key === ' ') && !locked) {
                    event.preventDefault();
                    goToQuestion(i);
                  }
                }}
              />
            );
          })}
        </div>
        <div className={`tmr ${low ? 'low' : ''}`}>
          <i>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <circle cx="12" cy="13" r="8" />
              <path d="M12 9v4l2.5 2M9 2h6" />
            </svg>
          </i>
          <span className="tl">
            <small>Time left</small>
            <b>{timeRemaining(Math.max(seconds, 0))}</b>
          </span>
        </div>
        <ThemeButton />
        <button
          className="xb"
          type="button"
          title="Exit"
          aria-label="Exit quiz"
          onClick={() => setExitConfirm(true)}
        >
          ×
        </button>
      </div>
      {error ? <p className="portal-note">{error}</p> : null}
      <div className="qwrap">
        <section className="qcard">
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
                showMarkForReview={!perq}
                perQuestionSeconds={perq ? attempt.perQuestionSeconds : null}
                onAnswer={(value) => setAnswer(question.questionVersionId, value)}
                onClear={() => clearAnswer(question.questionVersionId)}
                onToggleMarked={() =>
                  setMarked((prev) =>
                    prev.includes(i) ? prev.filter((idx) => idx !== i) : [...prev, i],
                  )
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
              showMarkForReview={!perq && !forwardOnly}
              perQuestionSeconds={perq ? attempt.perQuestionSeconds : null}
              onAnswer={(value) => setAnswer(q.questionVersionId, value)}
              onClear={() => clearAnswer(q.questionVersionId)}
              onToggleMarked={() =>
                setMarked((prev) =>
                  prev.includes(qIndex) ? prev.filter((idx) => idx !== qIndex) : [...prev, qIndex],
                )
              }
            />
          ) : null}
          <div className="qf">
            <button
              type="button"
              className="p"
              id="prev"
              disabled={qIndex === 0 || perq || forwardOnly || allOnPage}
              onClick={() => {
                if (qIndex > 0 && !perq && !forwardOnly) setQIndex(qIndex - 1);
              }}
            >
              Previous
            </button>
            <span className="c" id="attempt-submit-status">
              {answeredCount} of {questions.length} answered
              {reviewCount ? ` · ${reviewCount} marked for review` : ''}
              {questionsCompulsory && onSubmitSurface && !allRequiredAnswered
                ? ' · Answer every remaining question to submit'
                : ''}
              {questionsCompulsory && !onSubmitSurface && !currentAnswered
                ? ' · Answer to continue'
                : ''}
              {saving ? ' · Saving…' : ''}
            </span>
            {allOnPage || qIndex >= questions.length - 1 ? (
              <button
                type="button"
                className="nx sub"
                id="next"
                disabled={submitDisabled}
                aria-describedby="attempt-submit-status"
                onClick={requestSubmit}
              >
                Submit
              </button>
            ) : (
              <button
                type="button"
                className="nx"
                id="next"
                disabled={nextDisabled}
                onClick={requestNext}
              >
                Next question
              </button>
            )}
          </div>
        </section>
      </div>
      <div className={`dlg ${dialog ? 'open' : ''}`}>
        {dialog ? (
          <div className="dc" role="dialog" aria-modal="true">
            <h3>{dialog.title}</h3>
            <p>{dialog.body}</p>
            <div className="da">
              <button className="s" type="button" onClick={dialog.onStay}>
                {dialog.stay}
              </button>
              <button className="p" type="button" disabled={submitting} onClick={dialog.onGo}>
                {dialog.go}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
