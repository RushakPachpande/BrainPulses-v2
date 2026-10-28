import {
  ArrowRight,
  CalendarDays,
  Clock3,
  FileText,
  Hash,
  Lock,
  ShieldCheck,
  Trophy,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Heading, KindIcon, Status } from '../components/ui-bits';
import { ActivityCover, ActivityCredit } from '../components/activity-images';
import { formatDateLabel, formatDuration, formatKind } from '../lib/format';
import { listActivities } from '../services/api';
import type { ActivityKind, StudentActivity, StudentActivityRound } from '../services/types';

function roundStatusLabel(state: StudentActivityRound['state']) {
  if (state === 'completed') return 'Completed';
  if (state === 'in_progress') return 'In progress';
  if (state === 'available') return 'Available';
  return 'Locked';
}

function activityStatusLabel(item: StudentActivity) {
  if (item.attemptState === 'submitted') return 'Completed';
  if (item.openAttemptId) return 'In progress';
  if (item.canAttempt === false) return 'Closed';
  return 'Available';
}

export function ActivityDetailPage({ kind }: { kind: ActivityKind }) {
  const { activityId = '' } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<StudentActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [instructionsAck, setInstructionsAck] = useState(false);
  const libraryPath = kind === 'quiz' ? '/quizzes' : '/assessments';
  const isAssessment = kind === 'assessment';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const rows = await listActivities(kind);
        const found = rows.find((r) => r.activityId === activityId) ?? null;
        if (!cancelled) {
          if (!found) setError('Activity not found or not assigned to you.');
          setItem(found);
          setInstructionsAck(false);
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load activity.');
          setItem(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activityId, kind]);

  function startOrResumeQuiz() {
    if (!item) return;
    if (item.attemptState === 'submitted') {
      if (item.latestResultId) navigate(`/results/${item.latestResultId}`);
      else navigate('/results');
      return;
    }
    if (item.openAttemptId) {
      navigate(`/attempt/${item.openAttemptId}`);
      return;
    }
    if (item.canAttempt === false) {
      setError(item.attemptBlockedReason ?? 'This activity is not open for attempts.');
      return;
    }
    navigate(`/attempt/start/${item.activityId}`);
  }

  function startOrResumeRound(round: StudentActivityRound) {
    if (!item) return;
    if (round.state === 'locked') return;
    if (round.state === 'completed') {
      if (round.latestResultId) navigate(`/results/${round.latestResultId}`);
      else navigate('/results');
      return;
    }
    if (round.openAttemptId) {
      navigate(`/attempt/${round.openAttemptId}`);
      return;
    }
    if (item.canAttempt === false) {
      setError(item.attemptBlockedReason ?? 'This activity is not open for attempts.');
      return;
    }
    navigate(`/attempt/start/${item.activityId}?roundId=${round.id}`);
  }

  const startBlocked =
    !!item && item.attemptState !== 'submitted' && !item.openAttemptId && item.canAttempt === false;
  const instructionsText = item?.instructions?.trim() ?? '';
  const needsInstructionsAck =
    Boolean(instructionsText) && !!item && item.attemptState !== 'submitted' && !item.openAttemptId;
  const startDisabled = startBlocked || (needsInstructionsAck && !instructionsAck);

  return (
    <div className="page-stack">
      <button className="back-link" type="button" onClick={() => navigate(libraryPath)}>
        ← Back to {kind === 'quiz' ? 'quizzes' : 'assessments'}
      </button>
      {loading ? (
        <div className="panel activity-detail" aria-busy="true">
          <span className="sr-only">Loading activity</span>
          <span className="skeleton-line w-md" />
          <span className="skeleton-line w-full" />
          <span className="skeleton-line w-lg" />
        </div>
      ) : error && !item ? (
        <div className="panel empty-results" role="status">
          <b>{error || 'Activity not found'}</b>
          <button className="btn outline" type="button" onClick={() => navigate(libraryPath)}>
            Back to library
          </button>
        </div>
      ) : !item ? null : (
        <>
          <Heading
            eyebrow={kind === 'quiz' ? 'QUIZ' : 'ASSESSMENT'}
            title={item.name}
            description={item.subtitle ?? 'Review the schedule and instructions before you begin.'}
          />
          <ActivityCover
            item={item}
            className="activity-detail-media"
            imgClassName="activity-detail-photo"
          />
          <ActivityCredit item={item} />

          <section className="panel activity-detail" aria-labelledby="activity-detail-heading">
            <header className="activity-detail-header">
              <div className="activity-detail-identity">
                <span
                  className={`type-tag ${item.kind === 'quiz' ? 'quiz-tag' : 'assessment-tag'}`}
                >
                  <KindIcon kind={item.kind} /> {formatKind(item.kind)}
                </span>
                <h2 id="activity-detail-heading" className="activity-detail-title">
                  Before you start
                </h2>
              </div>
              <Status value={activityStatusLabel(item)} />
            </header>

            <dl className="activity-detail-facts">
              <div className="activity-detail-fact">
                <dt>
                  <Clock3 size={16} aria-hidden />
                  Duration
                </dt>
                <dd>{formatDuration(item.durationMinutes)}</dd>
              </div>
              <div className="activity-detail-fact">
                <dt>
                  <FileText size={16} aria-hidden />
                  Questions
                </dt>
                <dd>
                  {item.questionCount} {item.questionCount === 1 ? 'question' : 'questions'}
                </dd>
              </div>
              <div className="activity-detail-fact">
                <dt>
                  <CalendarDays size={16} aria-hidden />
                  Opens
                </dt>
                <dd>{item.startsAt ? formatDateLabel(item.startsAt) : 'Open now'}</dd>
              </div>
              <div className="activity-detail-fact">
                <dt>
                  <CalendarDays size={16} aria-hidden />
                  Due
                </dt>
                <dd>{item.endsAt ? formatDateLabel(item.endsAt) : 'No end date'}</dd>
              </div>
            </dl>

            {startBlocked ? (
              <div className="activity-detail-alert" role="status">
                <Lock size={16} aria-hidden />
                <p>{item.attemptBlockedReason ?? 'This activity is not open for attempts.'}</p>
              </div>
            ) : null}

            {error && item ? (
              <div className="activity-detail-alert" role="alert">
                <Lock size={16} aria-hidden />
                <p>{error}</p>
              </div>
            ) : null}

            {instructionsText ? (
              <div className="activity-detail-instructions">
                <h3 className="activity-detail-rounds-title">Instructions</h3>
                <p className="activity-detail-instructions-body">{instructionsText}</p>
                {needsInstructionsAck ? (
                  <label className="activity-detail-ack">
                    <input
                      type="checkbox"
                      checked={instructionsAck}
                      onChange={(e) => setInstructionsAck(e.target.checked)}
                    />
                    <span>I have read the instructions</span>
                  </label>
                ) : null}
              </div>
            ) : null}

            <div className="activity-detail-notes">
              <p>
                <span className="activity-detail-code">
                  <Hash size={14} aria-hidden />
                  {item.code}
                </span>
                <span className="activity-detail-note-text">
                  Answers save automatically while the attempt is open. Submit before the deadline.
                  {isAssessment ? ' Complete each round in order to unlock the next.' : null}
                </span>
              </p>
              <p className="activity-detail-footnote">
                <ShieldCheck size={16} aria-hidden />
                Timed attempt — leaving this page does not submit for you.
              </p>
            </div>

            {isAssessment && item.rounds && item.rounds.length > 0 ? (
              <div className="activity-detail-rounds">
                <h3 className="activity-detail-rounds-title">Rounds</h3>
                <ul className="activity-round-list">
                  {item.rounds.map((round, index) => (
                    <li key={round.id} className="activity-round-card">
                      <div className="activity-round-main">
                        <div className="activity-round-heading">
                          <span className="activity-round-index" aria-hidden>
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <div className="activity-round-copy">
                            <b>{round.name}</b>
                            <div className="activity-card-meta">
                              <span>
                                <Clock3 size={15} aria-hidden />
                                {formatDuration(round.durationMinutes)}
                              </span>
                              <span>
                                <FileText size={15} aria-hidden />
                                {round.questionCount} questions
                              </span>
                            </div>
                          </div>
                          <Status value={roundStatusLabel(round.state)} />
                        </div>
                      </div>
                      <button
                        className={`btn ${round.state === 'completed' || round.state === 'locked' ? 'outline' : 'primary'}`}
                        type="button"
                        disabled={round.state === 'locked'}
                        onClick={() => startOrResumeRound(round)}
                      >
                        {round.state === 'locked' ? (
                          <>
                            <Lock size={15} aria-hidden /> Locked
                          </>
                        ) : round.state === 'completed' ? (
                          <>
                            View results <ArrowRight size={15} aria-hidden />
                          </>
                        ) : round.state === 'in_progress' ? (
                          <>
                            Resume round <ArrowRight size={15} aria-hidden />
                          </>
                        ) : (
                          <>
                            Start round <ArrowRight size={15} aria-hidden />
                          </>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="activity-detail-actions">
                <button
                  className={`btn ${item.attemptState === 'submitted' || startDisabled ? 'outline' : 'primary'}`}
                  type="button"
                  disabled={startDisabled}
                  onClick={startOrResumeQuiz}
                >
                  {item.attemptState === 'submitted'
                    ? item.latestResultId
                      ? 'View results'
                      : 'Open results list'
                    : item.openAttemptId
                      ? 'Resume attempt'
                      : startBlocked
                        ? 'Closed'
                        : 'Start activity'}
                  {startBlocked ? (
                    <Lock size={15} aria-hidden />
                  ) : (
                    <ArrowRight size={15} aria-hidden />
                  )}
                </button>
                {item.leaderboardAvailable ? (
                  <button
                    className="btn outline"
                    type="button"
                    onClick={() => navigate(`/quizzes/${item.activityId}/leaderboard`)}
                  >
                    <Trophy size={15} aria-hidden /> Leaderboard
                  </button>
                ) : null}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
