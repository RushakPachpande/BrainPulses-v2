import { ArrowRight, CalendarDays, Clock3, FileText, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Heading, KindIcon, Status } from '../components/ui-bits';
import { formatDateLabel, formatDuration, formatKind } from '../lib/format';
import { listActivities } from '../services/api';
import type { ActivityKind, StudentActivity } from '../services/types';

export function ActivityDetailPage({ kind }: { kind: ActivityKind }) {
  const { activityId = '' } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<StudentActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const libraryPath = kind === 'quiz' ? '/quizzes' : '/assessments';

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

  function startOrResume() {
    if (!item) return;
    if (item.attemptState === 'submitted') {
      if (item.latestResultId) navigate(`/results/${item.latestResultId}`);
      else navigate('/results');
      return;
    }
    if (item.openAttemptId) navigate(`/attempt/${item.openAttemptId}`);
    else navigate(`/attempt/start/${item.activityId}`);
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
            </p>
            <div className="library-footnote" style={{ marginBottom: '1.25rem' }}>
              <ShieldCheck size={16} />
              <span>This is a timed attempt. Leaving the page does not submit for you.</span>
            </div>
            <button
              className={`btn ${item.attemptState === 'submitted' ? 'outline' : 'primary'}`}
              type="button"
              onClick={startOrResume}
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
          </section>
        </>
      )}
    </div>
  );
}
