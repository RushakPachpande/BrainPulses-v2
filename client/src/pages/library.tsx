import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clock3,
  FileText,
  Search,
  ShieldCheck,
  Target,
  Trophy,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  formatDateLabel,
  formatDuration,
  formatKind,
  Heading,
  KindIcon,
  Status,
} from '../components/ui-bits';
import { useDebouncedValue } from '../hooks/use-debounced-value';
import { listActivities } from '../services/api';
import type { ActivityKind, StudentActivity } from '../services/types';

export function LibraryPage({ kind }: { kind: ActivityKind }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<StudentActivity[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  // Clear empties the filter immediately; typing still waits 300ms.
  const search = searchInput === '' ? '' : debouncedSearch;
  const [view, setView] = useState('All');
  const [error, setError] = useState('');
  const isQuiz = kind === 'quiz';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listActivities(kind);
        if (!cancelled) setItems(rows);
      } catch {
        if (!cancelled) setError('Unable to load activities.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kind]);

  const filtered = useMemo(() => {
    return items.filter((x) => {
      const hay = `${x.name} ${x.subtitle ?? ''}`.toLowerCase();
      if (search && !hay.includes(search.toLowerCase())) return false;
      if (view === 'Available' && x.attemptState === 'submitted') return false;
      if (view === 'Completed' && x.attemptState !== 'submitted') return false;
      return true;
    });
  }, [items, search, view]);

  function begin(item: StudentActivity) {
    if (item.attemptState === 'submitted' && item.latestResultId) {
      navigate(`/results/${item.latestResultId}`);
      return;
    }
    if (item.openAttemptId) navigate(`/attempt/${item.openAttemptId}`);
    else navigate(`/attempt/start/${item.activityId}`);
  }

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
          <button className="btn outline" type="button" onClick={() => navigate('/results')}>
            <Trophy size={16} /> View results
          </button>
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
        <div className="summary-stats">
          <div>
            <b>{items.length}</b>
            <span>{isQuiz ? 'quizzes' : 'assessments'}</span>
          </div>
          <div>
            <b>{items.filter((x) => x.attemptState !== 'submitted').length}</b>
            <span>available</span>
          </div>
        </div>
      </div>
      <div className="library-toolbar">
        <div className="segmented">
          {['All', 'Available', 'Completed'].map((v) => (
            <button key={v} type="button" className={view === v ? 'selected' : ''} onClick={() => setView(v)}>
              {v}
              <span>
                {v === 'All'
                  ? items.length
                  : v === 'Available'
                    ? items.filter((x) => x.attemptState !== 'submitted').length
                    : items.filter((x) => x.attemptState === 'submitted').length}
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
            />
            {searchInput && (
              <button aria-label="Clear search" type="button" onClick={() => setSearchInput('')}>
                <X size={14} />
              </button>
            )}
          </label>
        </div>
      </div>
      <div className="library-grid">
        {filtered.length ? (
          filtered.map((x) => (
            <article className="activity-card" key={x.activityId}>
              <div className="activity-card-top">
                <span className={`type-tag ${x.kind === 'quiz' ? 'quiz-tag' : 'assessment-tag'}`}>
                  <KindIcon kind={x.kind} /> {formatKind(x.kind)}
                </span>
                <Status
                  value={
                    x.attemptState === 'submitted'
                      ? 'Completed'
                      : x.attemptState === 'in_progress'
                        ? 'In progress'
                        : 'Available'
                  }
                />
              </div>
              <h3>{x.name}</h3>
              <p>{x.subtitle ?? 'Assigned activity'}</p>
              <div className="activity-card-meta">
                <span>
                  <Clock3 size={15} />
                  {formatDuration(x.durationMinutes)}
                </span>
                <span>
                  <FileText size={15} />
                  {x.questionCount} questions
                </span>
                <span className="mode-label">Timed</span>
              </div>
              <div className="activity-card-bottom">
                <div className="due-label">
                  <CalendarDays size={14} />
                  <span>{x.endsAt ? `Due ${formatDateLabel(x.endsAt)}` : 'Open window'}</span>
                </div>
                <button
                  className={`btn ${x.attemptState === 'submitted' ? 'outline' : 'primary'} small`}
                  type="button"
                  onClick={() => begin(x)}
                >
                  {x.attemptState === 'submitted'
                    ? 'View results'
                    : x.attemptState === 'in_progress'
                      ? 'Resume'
                      : 'Start activity'}{' '}
                  <ArrowRight size={15} />
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="panel empty-results">
            <Search size={24} />
            <b>No activities found</b>
            <span>Try changing your search or filters.</span>
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
          </div>
        )}
      </div>
      <div className="library-footnote">
        <ShieldCheck size={16} />
        <span>Attempts are saved on the server. You can resume an in-progress attempt after a refresh.</span>
      </div>
    </div>
  );
}
