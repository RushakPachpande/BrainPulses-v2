import { ArrowLeft, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Heading } from '../components/ui-bits';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from '../components/ui/select';
import { ApiError } from '../lib/api-client';
import { getStudentActivityLeaderboard } from '../services/api';
import type { LeaderboardEntry, LeaderboardPayload } from '../services/types';

type Scope = 'daily' | 'overall';
type Kind = 'individual' | 'group';

export function LeaderboardPage() {
  const { activityId = '' } = useParams();
  const navigate = useNavigate();
  const [scope, setScope] = useState<Scope>('overall');
  const [kind, setKind] = useState<Kind>('individual');
  const [board, setBoard] = useState<LeaderboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const data = await getStudentActivityLeaderboard(activityId, { scope, kind });
        if (!cancelled) setBoard(data);
      } catch (err) {
        if (!cancelled) {
          setBoard(null);
          setError(err instanceof ApiError ? err.message : 'Unable to load leaderboard.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activityId, scope, kind]);

  const entries = (board?.entries ?? []) as LeaderboardEntry[];

  return (
    <div className="page-stack">
      <button
        className="back-link"
        type="button"
        onClick={() => navigate(`/quizzes/${activityId}`)}
      >
        <ArrowLeft size={15} /> Back to quiz
      </button>
      <Heading
        eyebrow="STANDINGS"
        title="Leaderboard"
        description={board?.activityName ?? 'See how you compare with your peers.'}
      />
      <div className="results-toolbar">
        <div>
          <h2>{kind === 'individual' ? 'Individual rankings' : 'Group rankings'}</h2>
          <p>{scope === 'daily' ? 'Today’s submissions' : 'All-time best on this quiz'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
            <SelectTrigger aria-label="Scope" className="results-type-filter">
              <span className="select-trigger-label">
                Scope: {scope === 'daily' ? 'Daily' : 'Overall'}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="overall">Overall</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
            <SelectTrigger aria-label="Board type" className="results-type-filter">
              <span className="select-trigger-label">
                Type: {kind === 'individual' ? 'Individual' : 'Group'}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="individual">Individual</SelectItem>
                <SelectItem value="group">Group</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
      {error ? <div className="error-text">{error}</div> : null}
      {loading ? (
        <div className="panel" aria-busy="true">
          <span className="sr-only">Loading leaderboard</span>
          <span className="skeleton-line w-full" />
          <span className="skeleton-line w-lg" />
          <span className="skeleton-line w-md" />
        </div>
      ) : entries.length === 0 ? (
        <div className="panel empty-results" role="status">
          <div className="empty-icon">
            <Trophy size={22} />
          </div>
          <b>No rankings yet</b>
          <span>Check back after more students submit this quiz.</span>
        </div>
      ) : kind === 'individual' ? (
        <div className="results-table panel">
          <div className="results-table-head">
            <span>Rank</span>
            <span>Student</span>
            <span>Cohort</span>
            <span>Score</span>
          </div>
          {entries.map((row) => (
            <div className="results-table-row" key={`${row.rank}-${row.studentCode}`}>
              <span className="tabular-nums">{row.rank}</span>
              <span>
                <b>{row.studentName}</b>
                <small>{row.studentCode}</small>
              </span>
              <span>{row.cohort?.trim() || '—'}</span>
              <span className="table-score good">
                {row.percent != null ? `${Math.round(row.percent)}%` : '—'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="results-table panel">
          <div className="results-table-head">
            <span>Rank</span>
            <span>Cohort</span>
            <span>Members</span>
            <span>Avg</span>
          </div>
          {entries.map((row) => (
            <div className="results-table-row" key={`${row.rank}-${row.cohort}`}>
              <span className="tabular-nums">{row.rank}</span>
              <span>
                <b>{row.cohort}</b>
              </span>
              <span>{row.members ?? '—'}</span>
              <span className="table-score good">
                {row.avgPercent != null ? `${Math.round(row.avgPercent)}%` : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
