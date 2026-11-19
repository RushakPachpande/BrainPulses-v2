import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { PageLoader } from '../components/loading-overlay';
import { PortalHeader } from '../components/portal-header';
import { IconArrow, IconBack, IconCheck } from '../components/portal-icons';
import { useAuth } from '../contexts/auth-context';
import { formatDuration } from '../lib/format';
import { clientQueryKeys } from '../lib/query-keys';
import { isInstructionsEmpty, sanitizeInstructionsHtml } from '../lib/sanitize-html';
import { listActivities } from '../services/api';
import type { ActivityKind, ParticipantActivityRound } from '../services/types';

const OVERALL = [
  'The timer starts when you press Start and keeps running if you leave.',
  'You can move between questions and change answers before you submit.',
  'Use Mark for review to come back to a question later.',
  'When time ends, your answers are submitted automatically.',
];

export function ActivityDetailPage({ kind }: { kind: ActivityKind }) {
  const { activityId = '' } = useParams();
  const navigate = useNavigate();
  const { participant } = useAuth();
  const participantId = participant?.id ?? '';
  const [ack, setAck] = useState(false);
  const [attemptError, setAttemptError] = useState('');
  const libraryPath = kind === 'quiz' ? '/quizzes' : '/assessments';
  const backLabel = kind === 'quiz' ? 'quizzes' : 'assessments';
  const activitiesQuery = useQuery({
    queryKey: clientQueryKeys.activities(participantId, kind),
    queryFn: ({ signal }) => listActivities(kind, signal),
    enabled: Boolean(participantId),
  });
  const item = activitiesQuery.data?.find((row) => row.activityId === activityId) ?? null;
  const loading = activitiesQuery.isPending && !activitiesQuery.data;
  const loadError = activitiesQuery.isError
    ? 'Unable to load activity.'
    : activitiesQuery.isSuccess && !item
      ? 'Activity not found or not assigned to you.'
      : '';
  const error = attemptError || loadError;

  useEffect(() => {
    setAck(false);
    setAttemptError('');
  }, [activityId]);

  const instructionsHtml = item?.instructions?.trim() ?? '';
  const hasInstructions = !isInstructionsEmpty(instructionsHtml);
  const safeInstructionsHtml = hasInstructions ? sanitizeInstructionsHtml(instructionsHtml) : '';
  const resume = Boolean(item?.openAttemptId);
  const used = item?.attemptsUsed ?? 0;
  const total = item?.maxAttempts;
  const left = total == null ? null : Math.max(0, total - used);
  const blocked = !!item && !resume && item.canAttempt === false;
  const rounds = item?.kind === 'assessment' ? (item.rounds ?? []) : [];

  function beginAttempt(roundId?: string) {
    if (!item || !ack) return;
    if (roundId) {
      const round = rounds.find((entry) => entry.id === roundId);
      if (round?.openAttemptId) {
        navigate(`/attempt/${round.openAttemptId}`);
        return;
      }
      navigate(`/attempt/start/${item.activityId}?roundId=${roundId}`);
      return;
    }
    if (item.openAttemptId) {
      navigate(`/attempt/${item.openAttemptId}`);
      return;
    }
    if (item.canAttempt === false) {
      setAttemptError(item.attemptBlockedReason ?? 'This activity is not open for attempts.');
      return;
    }
    navigate(`/attempt/start/${item.activityId}`);
  }

  function viewResult(resultId: string | null) {
    if (!resultId) return;
    navigate(`/results/${resultId}`);
  }

  const windowValue = item?.endsAt
    ? new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(item.endsAt))
    : 'Open';

  return (
    <>
      <PortalHeader showName />
      <div className="pg">
        <button className="back" type="button" onClick={() => navigate(libraryPath)}>
          <IconBack /> Back to {backLabel}
        </button>
        {loading ? (
          <PageLoader />
        ) : !item ? (
          <section className="dcard">
            <h1>{error || 'Activity not found'}</h1>
          </section>
        ) : (
          <section className="dcard">
            <span className="pillt">{item.name}</span>
            <h1>Important instructions</h1>
            <div className="facts">
              <div>
                <small>Questions</small>
                <b>{item.questionCount}</b>
              </div>
              <div>
                <small>Time</small>
                <b>{item.durationMinutes != null ? formatDuration(item.durationMinutes) : '—'}</b>
              </div>
              <div>
                <small>Attempts left</small>
                <b>{left == null ? 'Unlimited' : `${left} of ${total}`}</b>
              </div>
              <div>
                <small>Closes</small>
                <b>{windowValue}</b>
              </div>
            </div>
            {hasInstructions ? (
              <div className="ins-focus" role="region" aria-label="Activity instructions">
                <p className="ins-focus__label">Please read carefully</p>
                <div
                  className="rich-instructions"
                  dangerouslySetInnerHTML={{ __html: safeInstructionsHtml }}
                />
              </div>
            ) : (
              <ul className="ins">
                {OVERALL.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
            {blocked ? (
              <p className="portal-note">
                {item.attemptBlockedReason ?? 'This activity is not open for attempts.'}
              </p>
            ) : null}
            {error && item ? <p className="portal-note">{error}</p> : null}
            <button
              className={`ack ${ack ? 'on' : ''}`}
              id="ack"
              type="button"
              role="checkbox"
              aria-checked={ack}
              onClick={() => setAck((value) => !value)}
            >
              <span className="bx">{ack ? <IconCheck size={16} /> : null}</span>
              <span>I have read the instructions and I am ready to begin.</span>
            </button>
            {rounds.length > 0 ? (
              <div className="grid" style={{ marginTop: 18 }}>
                {rounds.map((round) => {
                  const locked = round.state === 'locked';
                  const pending = Boolean(round.resultPendingPublish);
                  const attemptsLabel =
                    round.maxAttempts == null
                      ? `${round.attemptsUsed ?? 0} used · unlimited`
                      : `${round.attemptsUsed ?? 0} of ${round.maxAttempts}`;
                  return (
                    <article
                      key={round.id}
                      className={`card ${locked ? 'round-locked' : ''}`}
                      aria-disabled={locked || undefined}
                    >
                      <div className="cb">
                        <h4>{round.name}</h4>
                        <p>
                          {locked
                            ? 'Locked until you pass the previous round'
                            : pending
                              ? 'Result pending publish'
                              : round.state === 'completed'
                                ? 'Completed'
                                : round.state === 'in_progress'
                                  ? 'In progress'
                                  : 'Available'}
                        </p>
                        <div className="meta">
                          <div>
                            <small>Questions</small>
                            {round.questionCount}
                          </div>
                          <div>
                            <small>Time</small>
                            {round.durationMinutes != null
                              ? formatDuration(round.durationMinutes)
                              : '—'}
                          </div>
                          <div className="at2">
                            <small>Attempts</small>
                            {attemptsLabel}
                          </div>
                        </div>
                        <RoundAction
                          round={round}
                          ack={ack}
                          onStart={() => beginAttempt(round.id)}
                          onResult={() => viewResult(round.latestResultId)}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <>
                <button
                  className="begin"
                  id="begin"
                  type="button"
                  disabled={!ack || blocked}
                  onClick={() => beginAttempt()}
                >
                  {resume ? 'Resume' : 'Start'} <IconArrow />
                </button>
                <p className="hint" id="hint" style={{ visibility: ack ? 'hidden' : 'visible' }}>
                  Tick the box above to enable {resume ? 'Resume' : 'Start'}.
                </p>
                {item.attemptState === 'submitted' && item.latestResultId ? (
                  <button
                    className="back"
                    type="button"
                    onClick={() => viewResult(item.latestResultId)}
                  >
                    View result
                  </button>
                ) : null}
              </>
            )}
          </section>
        )}
      </div>
    </>
  );
}

function RoundAction({
  round,
  ack,
  onStart,
  onResult,
}: {
  round: ParticipantActivityRound;
  ack: boolean;
  onStart: () => void;
  onResult: () => void;
}) {
  if (round.state === 'completed') {
    if (!round.latestResultId) return null;
    if (round.resultPendingPublish) {
      return (
        <button className="cta off" type="button" disabled>
          Waiting for results
        </button>
      );
    }
    return (
      <button className="cta o" type="button" onClick={onResult}>
        View result <IconArrow />
      </button>
    );
  }
  if (round.resultPendingPublish) {
    return (
      <button className="cta off" type="button" disabled>
        Waiting for results
      </button>
    );
  }
  const locked = round.state === 'locked';
  return (
    <button className="begin" type="button" disabled={!ack || locked} onClick={onStart}>
      {locked ? 'Locked' : round.state === 'in_progress' ? 'Resume' : 'Start'}{' '}
      {locked ? null : <IconArrow />}
    </button>
  );
}
