import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { PageLoader } from '../components/loading-overlay';
import { PortalHeader } from '../components/portal-header';
import { IconArrow, IconBack, IconCheck, IconLock, IconTrophy } from '../components/portal-icons';
import { StoredImage } from '../components/stored-image';
import { useAuth } from '../contexts/auth-context';
import { formatDuration } from '../lib/format';
import { clientQueryKeys } from '../lib/query-keys';
import { isInstructionsEmpty, sanitizeInstructionsHtml } from '../lib/sanitize-html';
import { listActivities } from '../services/api';
import type {
  ActivityKind,
  ParticipantActivity,
  ParticipantActivityRound,
} from '../services/types';

const OVERALL = [
  'The timer starts when you press Start and keeps running if you leave.',
  'You can move between questions and change answers before you submit.',
  'Use Mark for review to come back to a question later.',
  'When time ends, your answers are submitted automatically.',
];

const ROUND_DEFAULTS = [
  'Rounds unlock one after another. Each round shows what opens the next.',
  'Each round has its own timer. It starts when you press Start and keeps running if you leave.',
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
  const [ackedRounds, setAckedRounds] = useState<ReadonlySet<string>>(() => new Set());
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
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
    setAckedRounds(new Set());
    setSelectedRoundId(null);
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
    if (!item) return;
    if (roundId) {
      if (!ackedRounds.has(roundId)) return;
      const round = rounds.find((entry) => entry.id === roundId);
      if (
        !round ||
        round.state === 'locked' ||
        round.state === 'completed' ||
        (round.maxAttempts != null &&
          (round.attemptsUsed ?? 0) >= round.maxAttempts &&
          !round.openAttemptId)
      ) {
        return;
      }
      if (round.openAttemptId) {
        navigate(`/attempt/${round.openAttemptId}`);
        return;
      }
      navigate(`/attempt/start/${item.activityId}?roundId=${roundId}`);
      return;
    }
    if (!ack) return;
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

  if (item && rounds.length > 0) {
    return (
      <>
        <PortalHeader showName />
        <div className="pg">
          <RoundsView
            item={item}
            rounds={rounds}
            backLabel={backLabel}
            error={error}
            blocked={blocked}
            ackedRounds={ackedRounds}
            selectedRoundId={selectedRoundId}
            onBack={() => navigate(libraryPath)}
            onSelect={setSelectedRoundId}
            onToggleAck={(roundId) =>
              setAckedRounds((current) => {
                const next = new Set(current);
                if (next.has(roundId)) next.delete(roundId);
                else next.add(roundId);
                return next;
              })
            }
            onStart={beginAttempt}
            onResult={viewResult}
          />
        </div>
      </>
    );
  }

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
            <InstructionsBody
              html={safeInstructionsHtml}
              hasInstructions={hasInstructions}
              label="Activity instructions"
            />
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
          </section>
        )}
      </div>
    </>
  );
}

function RoundsView({
  item,
  rounds,
  backLabel,
  error,
  blocked,
  ackedRounds,
  selectedRoundId,
  onBack,
  onSelect,
  onToggleAck,
  onStart,
  onResult,
}: {
  item: ParticipantActivity;
  rounds: ParticipantActivityRound[];
  backLabel: string;
  error: string;
  blocked: boolean;
  ackedRounds: ReadonlySet<string>;
  selectedRoundId: string | null;
  onBack: () => void;
  onSelect: (roundId: string) => void;
  onToggleAck: (roundId: string) => void;
  onStart: (roundId: string) => void;
  onResult: (resultId: string | null) => void;
}) {
  const allPass = rounds.every((r) => r.passRequired !== false);
  const noneGated = rounds.every((r) => r.passRequired === false);
  const flow = allPass
    ? 'pass each round to unlock the next'
    : noneGated
      ? 'finish each round to unlock the next'
      : 'complete each round to unlock the next';

  function start(round: ParticipantActivityRound) {
    if (ackedRounds.has(round.id)) {
      onStart(round.id);
      return;
    }
    onSelect(round.id);
    requestAnimationFrame(() => {
      const box = document.getElementById(`ack-${round.id}`);
      box?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      box?.focus({ preventScroll: true });
    });
  }

  return (
    <div className="rp">
      <div className="rp-main">
        <button className="back rp-back" type="button" onClick={onBack}>
          <IconBack /> Back to {backLabel}
        </button>
        <span className="pillt">{item.name}</span>
        <h1 className="rp-title">Your rounds</h1>
        <p className="rp-sub">
          {rounds.length} {rounds.length === 1 ? 'round' : 'rounds'} · {flow}
        </p>
        {blocked ? (
          <p className="portal-note">
            {item.attemptBlockedReason ?? 'This activity is not open for attempts.'}
          </p>
        ) : null}
        {error ? <p className="portal-note">{error}</p> : null}
        <ol className="rp-steps">
          {rounds.map((round, index) => (
            <RoundCard
              key={round.id}
              round={round}
              index={index}
              previous={index > 0 ? rounds[index - 1] : undefined}
              next={rounds[index + 1]}
              selected={round.id === selectedRoundId}
              acked={ackedRounds.has(round.id)}
              onSelect={() => onSelect(round.id)}
              onToggleAck={() => onToggleAck(round.id)}
              onStart={() => start(round)}
              onResult={() => onResult(round.latestResultId)}
            />
          ))}
        </ol>
        <p className="rp-goal">
          <IconTrophy />
          {rounds.length === 1
            ? 'Finish the round to complete the assessment'
            : `Finish ${rounds.length === 2 ? 'both' : `all ${rounds.length}`} rounds to complete the assessment`}
        </p>
      </div>
    </div>
  );
}

function RoundCard({
  round,
  index,
  previous,
  next,
  selected,
  acked,
  onSelect,
  onToggleAck,
  onStart,
  onResult,
}: {
  round: ParticipantActivityRound;
  index: number;
  previous?: ParticipantActivityRound;
  next?: ParticipantActivityRound;
  selected: boolean;
  acked: boolean;
  onSelect: () => void;
  onToggleAck: () => void;
  onStart: () => void;
  onResult: () => void;
}) {
  const locked = round.state === 'locked';
  const completed = round.state === 'completed';
  const pending = Boolean(round.resultPendingPublish);
  const outOfAttempts = round.maxAttempts != null && (round.attemptsUsed ?? 0) >= round.maxAttempts;
  const canStart =
    (round.state === 'available' || round.state === 'in_progress') && !round.resultPendingPublish;
  const showPrep = selected && canStart;
  const instructionHtml = round.instructions?.trim() ?? '';
  const hasInstructions = !isInstructionsEmpty(instructionHtml);
  const previousDone = previous
    ? previous.passRequired === false
      ? (previous.attemptsUsed ?? 0) > 0 || previous.state === 'completed'
      : previous.state === 'completed'
    : true;
  const attemptsLabel =
    round.maxAttempts == null
      ? `${round.attemptsUsed ?? 0} used`
      : `${round.attemptsUsed ?? 0} of ${round.maxAttempts}`;

  const chip = pending
    ? { tone: 'wait', label: 'Result pending' }
    : completed
      ? { tone: 'done', label: 'Completed' }
      : round.state === 'in_progress'
        ? { tone: 'live', label: 'In progress' }
        : locked
          ? { tone: 'lock', label: 'Locked' }
          : { tone: 'ok', label: 'Available' };

  const gate = locked
    ? previous && !previousDone
      ? previous.passRequired === false
        ? `Unlocks after you finish ${previous.name}`
        : `Unlocks after you pass ${previous.name}`
      : outOfAttempts
        ? 'No attempts left'
        : 'Not open right now'
    : pending
      ? 'Your result will be published soon'
      : completed
        ? next
          ? `${next.name} is unlocked`
          : 'All rounds done'
        : next
          ? round.passRequired === false
            ? `Finish to unlock ${next.name}`
            : `Pass to unlock ${next.name}`
          : 'Final round';

  return (
    <li className={`rp-step ${locked ? 'is-locked' : ''} ${completed ? 'is-done' : ''}`}>
      <div className="rp-rail" aria-hidden>
        <span className="rp-dot">
          {completed ? <IconCheck size={16} /> : locked ? <IconLock size={14} /> : index + 1}
        </span>
      </div>
      <article
        className={`rp-card ${selected ? 'is-selected' : ''}`}
        aria-label={`Round ${index + 1}: ${round.name}`}
        onClick={(event) => {
          const target = event.target;
          if (!(target instanceof Element) || target.closest('button, a')) return;
          onSelect();
        }}
      >
        <div className="rp-art">
          {round.imageFileId ? (
            <StoredImage src={`/api/files/${round.imageFileId}`} alt="" />
          ) : (
            <div className="rp-tile">
              <span>Round {index + 1}</span>
              <strong>{round.name}</strong>
            </div>
          )}
          {locked ? (
            <span className="rp-art__lock">
              <IconLock size={18} />
            </span>
          ) : null}
        </div>
        <div className="rp-body">
          <div className="rp-head">
            <div className="rp-name">
              <small>Round {index + 1}</small>
              <h3>
                <button
                  type="button"
                  className="rp-name__btn"
                  aria-pressed={selected}
                  aria-expanded={showPrep}
                  aria-controls={showPrep ? `before-start-${round.id}` : undefined}
                  onClick={onSelect}
                >
                  {round.name}
                </button>
              </h3>
            </div>
            <span className={`rp-chip rp-chip--${chip.tone}`}>
              {chip.tone === 'lock' ? <IconLock size={12} /> : <i />}
              {chip.label}
            </span>
          </div>
          <dl className="rp-meta">
            <div>
              <dt>Questions</dt>
              <dd>{round.questionCount}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{round.durationMinutes != null ? formatDuration(round.durationMinutes) : '—'}</dd>
            </div>
            <div>
              <dt>Attempts</dt>
              <dd>{attemptsLabel}</dd>
            </div>
          </dl>
          <div className="rp-foot">
            <p>{gate}</p>
            <RoundAction
              round={round}
              index={index}
              hideStart={showPrep}
              onStart={onStart}
              onResult={onResult}
            />
          </div>
        </div>
        {showPrep ? (
          <div className="rp-prep" id={`before-start-${round.id}`}>
            <h2 className="rp-prep__title" id={`before-start-title-${round.id}`}>
              Before you start
            </h2>
            <InstructionsBody
              html={hasInstructions ? sanitizeInstructionsHtml(instructionHtml) : ''}
              hasInstructions={hasInstructions}
              label={`${round.name} instructions`}
              defaults={ROUND_DEFAULTS}
            />
            <button
              className={`ack ${acked ? 'on' : ''}`}
              id={`ack-${round.id}`}
              type="button"
              role="checkbox"
              aria-checked={acked}
              onClick={onToggleAck}
            >
              <span className="bx">{acked ? <IconCheck size={16} /> : null}</span>
              <span>I have read the instructions and I am ready to begin.</span>
            </button>
            <p className="hint" style={{ visibility: acked ? 'hidden' : 'visible' }}>
              Tick the box to enable {round.state === 'in_progress' ? 'Resume' : 'Begin'}.
            </p>
            <button className="rp-cta rp-cta--p" type="button" disabled={!acked} onClick={onStart}>
              {round.state === 'in_progress' ? 'Resume' : 'Begin'} <IconArrow />
            </button>
          </div>
        ) : null}
      </article>
    </li>
  );
}

function InstructionsBody({
  html,
  hasInstructions,
  label,
  defaults = OVERALL,
}: {
  html: string;
  hasInstructions: boolean;
  label: string;
  defaults?: string[];
}) {
  if (hasInstructions) {
    return (
      <div className="ins-focus" role="region" aria-label={label}>
        <p className="ins-focus__label">Please read carefully</p>
        <div className="rich-instructions" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    );
  }
  return (
    <ul className="ins">
      {defaults.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}

function RoundAction({
  round,
  index,
  hideStart,
  onStart,
  onResult,
}: {
  round: ParticipantActivityRound;
  index: number;
  hideStart: boolean;
  onStart: () => void;
  onResult: () => void;
}) {
  if (round.resultPendingPublish) {
    return (
      <button className="rp-cta" type="button" disabled>
        Waiting for results
      </button>
    );
  }
  if (round.state === 'completed') {
    if (!round.latestResultId) return null;
    return (
      <button className="rp-cta rp-cta--o" type="button" onClick={onResult}>
        View result <IconArrow />
      </button>
    );
  }
  if (round.state === 'locked') {
    return (
      <button className="rp-cta" type="button" disabled>
        Locked
      </button>
    );
  }
  if (hideStart) return null;
  return (
    <button className="rp-cta rp-cta--p" type="button" onClick={onStart}>
      {round.state === 'in_progress' ? 'Resume' : 'Start'} round {index + 1} <IconArrow />
    </button>
  );
}
