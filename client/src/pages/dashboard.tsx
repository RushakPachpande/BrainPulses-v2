import {
  Activity,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  Clock3,
  FileText,
  GraduationCap,
  Target,
  Trophy,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/auth';
import {
  formatDateLabel,
  formatDuration,
  formatKind,
  KindIcon,
  Metric,
  Status,
} from '../components/ui-bits';
import { listActivities, listResults } from '../services/api';
import type { StudentActivity, StudentResultSummary } from '../services/types';

export function DashboardPage() {
  const { student } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<StudentActivity[]>([]);
  const [results, setResults] = useState<StudentResultSummary[]>([]);
  const [error, setError] = useState('');
  const name = student?.name?.split(' ')[0] ?? 'there';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [acts, res] = await Promise.all([listActivities('all'), listResults('all')]);
        if (!cancelled) {
          setItems(acts);
          setResults(res);
        }
      } catch {
        if (!cancelled) setError('Unable to load your dashboard.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const available = items.filter((x) => x.attemptState !== 'submitted').slice(0, 3);
  const average =
    results.length > 0
      ? Math.round(results.reduce((n, a) => n + a.percent, 0) / results.length)
      : null;
  const minutes = results.reduce((total, a) => total + (a.durationMinutes ?? 0), 0);

  function begin(item: StudentActivity) {
    if (item.openAttemptId) navigate(`/attempt/${item.openAttemptId}`);
    else navigate(`/attempt/start/${item.activityId}`);
  }

  return (
    <div className="page-stack">
      {error && <div className="error-text">{error}</div>}
      <section className="welcome-banner">
        <div className="welcome-content">
          <div className="eyebrow light">✦ YOUR LEARNING SPACE</div>
          <h1>Good to see you, {name}.</h1>
          <p>Small steps add up. Here’s what’s happening with your learning today.</p>
          <div className="welcome-meta">
            <span>
              <CalendarDays size={15} />
              {formatDateLabel(new Date().toISOString())}
            </span>
            <span>
              <Target size={15} />
              Your next goal is within reach
            </span>
          </div>
        </div>
        <div className="welcome-art">
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="art-core">
            <GraduationCap size={40} />
          </div>
          <div className="art-chip chip-one">
            <Check size={15} />
          </div>
          <div className="art-chip chip-two">
            <BookOpen size={17} />
          </div>
        </div>
      </section>

      <div className="section-heading">
        <div>
          <h2>Your progress</h2>
          <p>A quick snapshot of your recent activity.</p>
        </div>
        <button className="text-btn" type="button" onClick={() => navigate('/results')}>
          View results <ArrowRight size={15} />
        </button>
      </div>

      <div className="metrics-grid">
        <Metric
          icon={BookOpen}
          label="Activities completed"
          value={String(results.length).padStart(2, '0')}
          detail="Submitted attempts"
        />
        <Metric
          icon={Trophy}
          label="Average score"
          value={average === null ? '—' : `${average}%`}
          detail="Across submitted attempts"
        />
        <Metric
          icon={Clock3}
          label="Time invested"
          value={`${minutes}m`}
          detail="Across submitted attempts"
        />
        <Metric
          icon={Target}
          label="Available to attempt"
          value={String(items.filter((x) => x.attemptState !== 'submitted').length).padStart(2, '0')}
          detail="Quizzes and assessments"
        />
      </div>

      <div className="dashboard-grid">
        <section className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <h2>Pick up where you left off</h2>
              <p>Activities ready when you are.</p>
            </div>
            <button className="text-btn" type="button" onClick={() => navigate('/quizzes')}>
              View all <ArrowRight size={15} />
            </button>
          </div>
          <div className="activity-list">
            {available.length === 0 ? (
              <div className="empty-state">
                <b>Nothing waiting right now</b>
                <span>Check back when your coordinator assigns a new activity.</span>
              </div>
            ) : (
              available.map((x, i) => (
                <div key={x.activityId} className={`activity-row ${i === 0 ? 'featured' : ''}`}>
                  <div className={`activity-type-icon ${x.kind === 'assessment' ? 'assessment' : ''}`}>
                    <KindIcon kind={x.kind} />
                  </div>
                  <div className="activity-row-main">
                    <div className="activity-title-line">
                      <b>{x.name}</b>
                      <Status
                        value={
                          x.attemptState === 'in_progress'
                            ? 'In progress'
                            : x.attemptState === 'submitted'
                              ? 'Completed'
                              : 'Available'
                        }
                      />
                    </div>
                    <p>{x.subtitle ?? formatKind(x.kind)}</p>
                    <div className="activity-meta">
                      <span>
                        <Clock3 size={13} />
                        {formatDuration(x.durationMinutes)}
                      </span>
                      <span>
                        <FileText size={13} />
                        {x.questionCount} questions
                      </span>
                    </div>
                  </div>
                  <button className="btn small outline activity-action" type="button" onClick={() => begin(x)}>
                    {x.attemptState === 'in_progress' ? 'Resume' : 'Start'} <ArrowRight size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel goal-panel">
          <div className="panel-heading">
            <div>
              <h2>Your weekly goal</h2>
              <p>Build a consistent learning habit.</p>
            </div>
            <span className="goal-icon">
              <Target size={18} />
            </span>
          </div>
          <div className="goal-progress">
            <div className="goal-number">
              <strong>{Math.min(results.length, 5)}</strong>
              <span>/ 5 activities</span>
            </div>
            <div className="progress-track">
              <div style={{ width: `${Math.min((results.length / 5) * 100, 100)}%` }} />
            </div>
            <p>Complete a short activity to keep your momentum going.</p>
          </div>
          <div className="goal-tip">
            <div className="tip-icon">
              <Activity size={17} />
            </div>
            <div>
              <b>Consistency beats cramming</b>
              <span>Try a short quiz today to keep your momentum.</span>
            </div>
          </div>
          <button className="btn secondary full" type="button" onClick={() => navigate('/quizzes')}>
            Explore quizzes <ArrowRight size={16} />
          </button>
        </section>
      </div>

      <section className="panel recent-panel">
        <div className="panel-heading">
          <div>
            <h2>Recent results</h2>
            <p>Your latest completed attempts.</p>
          </div>
          <button className="text-btn" type="button" onClick={() => navigate('/results')}>
            All results <ArrowRight size={15} />
          </button>
        </div>
        {results.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Trophy size={22} />
            </div>
            <b>Your results will show up here</b>
            <span>Complete a quiz or assessment to start tracking your progress.</span>
            <button className="btn outline" type="button" onClick={() => navigate('/quizzes')}>
              Browse activities
            </button>
          </div>
        ) : (
          <div className="result-rows">
            {results.slice(0, 3).map((a) => (
              <button
                className="result-row"
                key={a.id}
                type="button"
                onClick={() => navigate(`/results/${a.id}`)}
              >
                <div className="result-file">
                  <FileText size={18} />
                </div>
                <div className="result-main">
                  <b>{a.title}</b>
                  <span>
                    {formatKind(a.kind)} · {formatDateLabel(a.submittedAt)}
                  </span>
                </div>
                <div className="score-block">
                  <b>{Math.round(a.percent)}%</b>
                  <span>Score</span>
                </div>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
