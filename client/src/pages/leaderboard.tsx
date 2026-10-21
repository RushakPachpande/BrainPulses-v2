import { ArrowLeft, Trophy, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { BronzeMedal, GoldMedal, SilverMedal } from '../components/podium-medals';
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

function scoreTone(percent: number | null | undefined) {
  if (percent == null) return '';
  return percent >= 60 ? 'good' : 'low';
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="leaderboard-rank leaderboard-rank-medal" aria-label="Rank 1">
        <GoldMedal />
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="leaderboard-rank leaderboard-rank-medal" aria-label="Rank 2">
        <SilverMedal />
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="leaderboard-rank leaderboard-rank-medal" aria-label="Rank 3">
        <BronzeMedal />
      </span>
    );
  }
  return (
    <span className="leaderboard-rank" aria-label={`Rank ${rank}`}>
      <span className="tabular-nums">{rank}</span>
    </span>
  );
}

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
        <ArrowLeft size={15} aria-hidden /> Back to quiz
      </button>
      <Heading
        eyebrow="STANDINGS"
        title="Leaderboard"
        description={board?.activityName ?? 'See how you compare with your peers.'}
      />

      <section className="panel leaderboard-board" aria-labelledby="leaderboard-heading">
        <header className="leaderboard-board-header">
          <div className="leaderboard-board-identity">
            <span className="leaderboard-board-icon" aria-hidden>
              {kind === 'individual' ? <Trophy size={18} /> : <Users size={18} />}
            </span>
            <div>
              <h2 id="leaderboard-heading">
                {kind === 'individual' ? 'Individual rankings' : 'Group rankings'}
              </h2>
              <p>{scope === 'daily' ? 'Today’s submissions' : 'All-time best on this quiz'}</p>
            </div>
          </div>
          <div className="leaderboard-filters">
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
        </header>

        {error ? (
          <div className="activity-detail-alert" role="alert">
            <Trophy size={16} aria-hidden />
            <p>{error}</p>
          </div>
        ) : null}

        {loading ? (
          <div className="leaderboard-loading" aria-busy="true">
            <span className="sr-only">Loading leaderboard</span>
            <span className="skeleton-line w-full" />
            <span className="skeleton-line w-lg" />
            <span className="skeleton-line w-md" />
          </div>
        ) : entries.length === 0 ? (
          <div className="leaderboard-empty" role="status">
            <div className="empty-icon">
              <Trophy size={22} aria-hidden />
            </div>
            <b>No rankings yet</b>
            <span>Check back after more students submit this quiz.</span>
          </div>
        ) : kind === 'individual' ? (
          <div className="leaderboard-list" role="table" aria-label="Individual rankings">
            <div className="leaderboard-list-head" role="row">
              <span role="columnheader">Rank</span>
              <span role="columnheader">Student</span>
              <span role="columnheader">Cohort</span>
              <span role="columnheader">Score</span>
            </div>
            {entries.map((row) => (
              <div
                className="leaderboard-list-row"
                role="row"
                key={`${row.rank}-${row.studentCode}`}
              >
                <span className="leaderboard-cell-rank" role="cell">
                  <RankBadge rank={row.rank} />
                </span>
                <span className="leaderboard-cell-person" role="cell">
                  <b>{row.studentName ?? '—'}</b>
                  <small>{row.studentCode ?? ''}</small>
                </span>
                <span className="leaderboard-cell-meta" role="cell" data-label="Cohort">
                  {row.cohort?.trim() || '—'}
                </span>
                <span
                  className={`leaderboard-cell-score table-score ${scoreTone(row.percent)}`}
                  role="cell"
                  data-label="Score"
                >
                  {row.percent != null ? `${Math.round(row.percent)}%` : '—'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="leaderboard-list" role="table" aria-label="Group rankings">
            <div className="leaderboard-list-head" role="row">
              <span role="columnheader">Rank</span>
              <span role="columnheader">Cohort</span>
              <span role="columnheader">Members</span>
              <span role="columnheader">Avg</span>
            </div>
            {entries.map((row) => (
              <div className="leaderboard-list-row" role="row" key={`${row.rank}-${row.cohort}`}>
                <span className="leaderboard-cell-rank" role="cell">
                  <RankBadge rank={row.rank} />
                </span>
                <span className="leaderboard-cell-person" role="cell">
                  <b>{row.cohort ?? '—'}</b>
                </span>
                <span className="leaderboard-cell-meta" role="cell" data-label="Members">
                  {row.members ?? '—'}
                </span>
                <span
                  className={`leaderboard-cell-score table-score ${scoreTone(row.avgPercent)}`}
                  role="cell"
                  data-label="Avg"
                >
                  {row.avgPercent != null ? `${Math.round(row.avgPercent)}%` : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
