import { ArrowRight, BookOpen, CalendarDays, Clock3, FileText, Target, Timer } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { ActivityCardMedia, ActivityOrganizer } from '../components/activity-images';
import { Heading, KindIcon, Status } from '../components/ui-bits';
import { useAuth } from '../contexts/auth-context';
import { useParticipantPages } from '../hooks/use-participant-pages';
import { formatDateLabel, formatDuration, formatKind } from '../lib/format';
import { clientQueryKeys } from '../lib/query-keys';
import { listActivities } from '../services/api';
import type { ActivityKind, ParticipantActivity } from '../services/types';

function LibraryGridSkeleton() {
  return (
    <div className="library-grid-skeleton" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div className="skeleton-card" key={i}>
          <span className="skeleton-line w-sm" />
          <span className="skeleton-line w-md" />
          <span className="skeleton-line w-full" />
          <span className="skeleton-line w-lg" />
          <span className="skeleton-line h-btn" />
        </div>
      ))}
    </div>
  );
}

export function LibraryPage({ kind }: { kind: ActivityKind }) {
  const navigate = useNavigate();
  const { participant } = useAuth();
  const pagesQuery = useParticipantPages();
  const resultsOn = pagesQuery.data?.results ?? true;
  const participantId = participant?.id ?? '';
  const isQuiz = kind === 'quiz';

  const {
    data: items = [],
    isPending: loading,
    isError,
  } = useQuery({
    queryKey: clientQueryKeys.activities(participantId, kind),
    queryFn: () => listActivities(kind),
    enabled: Boolean(participantId),
  });
  const error = isError ? 'Unable to load activities.' : '';

  function begin(item: ParticipantActivity) {
    if (item.attemptState === 'submitted') {
      if (!resultsOn) return;
      if (item.latestResultId) navigate(`/results/${item.latestResultId}`);
      else navigate('/results');
      return;
    }
    const base = kind === 'quiz' ? '/quizzes' : '/assessments';
    navigate(`${base}/${item.activityId}`);
  }

  return (
    <div className="page-stack">
      <Heading title={isQuiz ? 'My quizzes' : 'Assessments'} />
      {error && <div className="error-text">{error}</div>}
      <div className="library-grid" aria-busy={loading || undefined} aria-live="polite">
        {loading ? (
          <>
            <span className="sr-only">Loading activities</span>
            <LibraryGridSkeleton />
          </>
        ) : items.length ? (
          items.map((x) => (
            <article className="activity-card" key={x.activityId}>
              <ActivityCardMedia item={x}>
                <span className="activity-card-kind">
                  <KindIcon kind={x.kind} /> {formatKind(x.kind)}
                </span>
                <Status
                  value={
                    x.attemptState === 'submitted'
                      ? 'Completed'
                      : x.attemptState === 'in_progress'
                        ? 'In progress'
                        : x.canAttempt === false
                          ? 'Closed'
                          : 'Available'
                  }
                />
              </ActivityCardMedia>
              <div className="activity-card-body">
                <ActivityOrganizer item={x} />
                <h3>{x.name}</h3>
                <p className="activity-card-summary">{x.subtitle ?? 'Assigned activity'}</p>
                <div className="activity-card-meta">
                  {x.durationMinutes != null ? (
                    <span>
                      <Clock3 size={15} />
                      {formatDuration(x.durationMinutes)}
                    </span>
                  ) : null}
                  <span>
                    <FileText size={15} />
                    {x.questionCount} questions
                  </span>
                  <span>
                    <Timer size={15} />
                    Timed
                  </span>
                </div>
              </div>
              <div className="activity-card-bottom">
                <div className="due-label">
                  <CalendarDays size={14} />
                  <span>{x.endsAt ? `Due ${formatDateLabel(x.endsAt)}` : 'Open window'}</span>
                </div>
                <button
                  className={`btn ${x.attemptState === 'submitted' ? 'outline' : 'primary'} small activity-card-action`}
                  type="button"
                  onClick={() => begin(x)}
                >
                  {x.attemptState === 'submitted'
                    ? 'View results'
                    : x.attemptState === 'in_progress'
                      ? 'Continue'
                      : 'View details'}{' '}
                  <ArrowRight size={15} />
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="panel empty-results" role="status">
            <div className="empty-icon">
              {isQuiz ? <BookOpen size={22} /> : <Target size={22} />}
            </div>
            <b>{isQuiz ? 'No quizzes yet' : 'No assessments yet'}</b>
            <span>
              {isQuiz
                ? "No quizzes yet. You'll get an email when one is ready."
                : 'When your coordinator assigns an assessment, it will appear here.'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
