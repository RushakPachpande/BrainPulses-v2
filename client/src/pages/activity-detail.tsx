import {
  ArrowRight,
  CalendarDays,
  Clock3,
  FileText,
  Lock,
  ShieldCheck,
  Trophy,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Heading, KindIcon, Status } from '../components/ui-bits';
import { formatDateLabel, formatDuration, formatKind } from '../lib/format';
import { listActivities } from '../services/api';
import type { ActivityKind, StudentActivity, StudentActivityRound } from '../services/types';

function roundStatusLabel(state: StudentActivityRound['state']) {
  if (state === 'completed') return 'Completed';
  if (state === 'in_progress') return 'In progress';
  if (state === 'available') return 'Available';
  return 'Locked';
}

export function ActivityDetailPage({ kind }: { kind: ActivityKind }) {
  const { activityId = '' } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<StudentActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
    if (item.openAttemptId) navigate(`/attempt/${item.openAttemptId}`);
    else navigate(`/attempt/start/${item.activityId}`);
  }

  function startOrResumeRound(round: StudentActivityRound) {
    if (!item) return;
    if (round.state === 'locked') return;
    if (round.state === 'completed') {
      if (round.latestResultId) navigate(`/results/${round.latestResultId}`);
      else navigate('/results');
      return;
    }
    if (round.openAttemptId) navigate(`/attempt/${round.openAttemptId}`);
    else navigate(`/attempt/start/${item.activityId}?roundId=${round.id}`);
  }

  return (
    <div className="page-stack">
      <button className="back-link" type="button" onClick={() => navigate(libraryPath)}>
        ← Back to {kind === 'quiz' ? 'quizzes' : 'assessments'}
      </button>
      {loading ? (
        <div className="panel" aria-busy="true">
          <span className="sr-only">Loading activity</span>
          <span className="skeleton-line w-md" />
          <span className="skeleton-line w-full" />
          <span className="skeleton-line w-lg" />
        </div>
      ) : error || !item ? (
        <div className="panel empty-results" role="status">
          <b>{error || 'Activity not found'}</b>
          <button className="btn outline" type="button" onClick={() => navigate(libraryPath)}>
            Back to library
          </button>
        </div>
      ) : (
        <>
          <Heading
            eyebrow={kind === 'quiz' ? 'QUIZ' : 'ASSESSMENT'}
            title={item.name}
            description={item.subtitle ?? 'Review the schedule and instructions before you begin.'}
          />
          <section className="panel">
            <div className="activity-card-top" style={{ marginBottom: '1rem' }}>
              <span className={`type-tag ${item.kind === 'quiz' ? 'quiz-tag' : 'assessment-tag'}`}>
                <KindIcon kind={item.kind} /> {formatKind(item.kind)}
              </span>
              <Status
                value={
                  item.attemptState === 'submitted'
                    ? 'Completed'
                    : item.attemptState === 'in_progress'
                      ? 'In progress'
                      : 'Available'
                }
              />
            </div>
            <div className="activity-card-meta" style={{ marginBottom: '1.25rem' }}>
              <span>
                <Clock3 size={15} />
                {formatDuration(item.durationMinutes)}
              </span>
              <span>
                <FileText size={15} />
                {item.questionCount} questions
              </span>
              <span>
                <CalendarDays size={15} />
                {item.startsAt ? `Opens ${formatDateLabel(item.startsAt)}` : 'Open now'}
              </span>
              <span>
                <CalendarDays size={15} />
                {item.endsAt ? `Due ${formatDateLabel(item.endsAt)}` : 'No end date'}
              </span>
            </div>
            <p className="muted" style={{ marginBottom: '1.25rem' }}>
              Code <b>{item.code}</b>. Your answers save automatically while the attempt is open.
              Submit before the deadline.
              {isAssessment ? ' Complete each round in order to unlock the next.' : null}
            </p>
            <div className="library-footnote" style={{ marginBottom: '1.25rem' }}>
              <ShieldCheck size={16} />
              <span>This is a timed attempt. Leaving the page does not submit for you.</span>
            </div>

            {isAssessment && item.rounds && item.rounds.length > 0 ? (
              <div className="flex flex-col gap-3">
                {item.rounds.map((round) => (
                  <div
                    key={round.id}
                    className="panel"
                    style={{
                      margin: 0,
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                    }}
                  >
                    <div className="activity-card-top" style={{ marginBottom: 0 }}>
                      <b>{round.name}</b>
                      <Status value={roundStatusLabel(round.state)} />
                    </div>
                    <div className="activity-card-meta">
                      <span>
                        <Clock3 size={15} />
                        {formatDuration(round.durationMinutes)}
                      </span>
                      <span>
                        <FileText size={15} />
                        {round.questionCount} questions
                      </span>
                    </div>
                    <button
                      className={`btn ${round.state === 'completed' ? 'outline' : round.state === 'locked' ? 'outline' : 'primary'}`}
                      type="button"
                      disabled={round.state === 'locked'}
                      onClick={() => startOrResumeRound(round)}
                    >
                      {round.state === 'locked' ? (
                        <>
                          <Lock size={15} /> Locked
                        </>
                      ) : round.state === 'completed' ? (
                        <>
                          View results <ArrowRight size={15} />
                        </>
                      ) : round.state === 'in_progress' ? (
                        <>
                          Resume round <ArrowRight size={15} />
                        </>
                      ) : (
                        <>
                          Start round <ArrowRight size={15} />
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  className={`btn ${item.attemptState === 'submitted' ? 'outline' : 'primary'}`}
                  type="button"
                  onClick={startOrResumeQuiz}
                >
                  {item.attemptState === 'submitted'
                    ? item.latestResultId
                      ? 'View results'
                      : 'Open results list'
                    : item.attemptState === 'in_progress'
                      ? 'Resume attempt'
                      : 'Start activity'}{' '}
                  <ArrowRight size={15} />
                </button>
                {item.leaderboardAvailable ? (
                  <button
                    className="btn outline"
                    type="button"
                    onClick={() => navigate(`/quizzes/${item.activityId}/leaderboard`)}
                  >
                    <Trophy size={15} /> Leaderboard
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
