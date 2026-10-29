import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clock3,
  FileText,
  Search,
  ShieldCheck,
  Target,
  Timer,
  Trophy,
  X,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { LibraryStatsSkeleton } from '../components/skeletons';
import { ActivityCardMedia, ActivityOrganizer } from '../components/activity-images';
import { Heading, KindIcon, Status } from '../components/ui-bits';
import { useAuth } from '../contexts/auth-context';
import { useStudentPages } from '../hooks/use-student-pages';
import { useDebouncedValue } from '../hooks/use-debounced-value';
import { formatDateLabel, formatDuration, formatKind } from '../lib/format';
import { clientQueryKeys } from '../lib/query-keys';
import { listActivities } from '../services/api';
import type { ActivityKind, StudentActivity } from '../services/types';

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
  const { student } = useAuth();
  const pagesQuery = useStudentPages();
  const resultsOn = pagesQuery.data?.results ?? true;
  const studentId = student?.id ?? '';
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  // Clear empties the filter immediately; typing still waits 300ms.
  const search = searchInput === '' ? '' : debouncedSearch;
  const [view, setView] = useState('All');
  const isQuiz = kind === 'quiz';

  const {
    data: items = [],
    isPending: loading,
    isError,
  } = useQuery({
    queryKey: clientQueryKeys.activities(studentId, kind),
    queryFn: () => listActivities(kind),
    enabled: Boolean(studentId),
  });
  const error = isError ? 'Unable to load activities.' : '';

  const filtered = useMemo(() => {
    return items.filter((x) => {
      const hay = `${x.name} ${x.subtitle ?? ''}`.toLowerCase();
      if (search && !hay.includes(search.toLowerCase())) return false;
      if (view === 'Available') {
        if (x.attemptState === 'submitted') return false;
        if (x.canAttempt === false && !x.openAttemptId) return false;
      }
      if (view === 'Completed' && x.attemptState !== 'submitted') return false;
      return true;
    });
  }, [items, search, view]);

  function begin(item: StudentActivity) {
    if (item.attemptState === 'submitted') {
      if (!resultsOn) return;
      if (item.latestResultId) navigate(`/results/${item.latestResultId}`);
      else navigate('/results');
      return;
    }
    const base = kind === 'quiz' ? '/quizzes' : '/assessments';
    navigate(`${base}/${item.activityId}`);
  }

  const availableCount = items.filter(
    (x) => x.attemptState !== 'submitted' && (x.canAttempt !== false || Boolean(x.openAttemptId)),
  ).length;
  const completedCount = items.filter((x) => x.attemptState === 'submitted').length;
  const filtersActive = Boolean(search) || view !== 'All';

  return (
    <div className="page-stack">
      <Heading
        eyebrow={isQuiz ? 'PRACTICE & LEARNING' : 'CHECK YOUR PROGRESS'}
        title={isQuiz ? 'My quizzes' : 'Assessments'}
        description={
          isQuiz
            ? 'Short practice sessions to strengthen your skills, one question at a time.'
            : 'Structured assessments to measure your readiness and progress.'
        }
        action={
          resultsOn ? (
            <button className="btn outline" type="button" onClick={() => navigate('/results')}>
              <Trophy size={16} /> View results
            </button>
          ) : undefined
        }
      />
      {error && <div className="error-text">{error}</div>}
      <div className="library-summary">
        <div className="summary-icon">{isQuiz ? <BookOpen size={21} /> : <Target size={21} />}</div>
        <div>
          <b>{isQuiz ? 'Practice at your pace' : 'Prepare with confidence'}</b>
          <span>
            {isQuiz
              ? 'Timed quizzes use the activity duration set by your coordinator.'
              : 'Review the instructions before you begin a timed assessment.'}
          </span>
        </div>
        {loading ? (
          <LibraryStatsSkeleton />
        ) : (
          <div className="summary-stats">
            <div>
              <b>{items.length}</b>
              <span>{isQuiz ? 'quizzes' : 'assessments'}</span>
            </div>
            <div>
              <b>{availableCount}</b>
              <span>available</span>
            </div>
          </div>
        )}
      </div>
      <div className="library-toolbar">
        <div className="segmented">
          {['All', 'Available', 'Completed'].map((v) => (
            <button
              key={v}
              type="button"
              className={view === v ? 'selected' : ''}
              onClick={() => setView(v)}
              disabled={loading}
            >
              {v}
              <span>
                {loading
                  ? '—'
                  : v === 'All'
                    ? items.length
                    : v === 'Available'
                      ? availableCount
                      : completedCount}
              </span>
            </button>
          ))}
        </div>
        <div className="library-filters">
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label="Search activities"
              placeholder="Search activities"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              disabled={loading}
            />
            {searchInput && (
              <button aria-label="Clear search" type="button" onClick={() => setSearchInput('')}>
                <X size={14} />
              </button>
            )}
          </label>
        </div>
      </div>
      <div className="library-grid" aria-busy={loading || undefined} aria-live="polite">
        {loading ? (
          <>
            <span className="sr-only">Loading activities</span>
            <LibraryGridSkeleton />
          </>
        ) : filtered.length ? (
          filtered.map((x) => (
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
            {items.length === 0 ? (
              <>
                <div className="empty-icon">
                  {isQuiz ? <BookOpen size={22} /> : <Target size={22} />}
                </div>
                <b>{isQuiz ? 'No quizzes yet' : 'No assessments yet'}</b>
                <span>
                  {isQuiz
                    ? 'When your coordinator assigns a quiz, it will appear here.'
                    : 'When your coordinator assigns an assessment, it will appear here.'}
                </span>
              </>
            ) : (
              <>
                <div className="empty-icon">
                  <Search size={22} />
                </div>
                <b>No activities found</b>
                <span>Try changing your search or filters.</span>
                {filtersActive && (
                  <button
                    className="btn outline"
                    type="button"
                    onClick={() => {
                      setSearchInput('');
                      setView('All');
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <div className="library-footnote">
        <ShieldCheck size={16} />
        <span>
          Attempts are saved on the server. You can resume an in-progress attempt after a refresh.
        </span>
      </div>
    </div>
  );
}
