import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { StoredImage } from '../components/stored-image';
import { IconArrow, PulseLine } from '../components/portal-icons';
import { useAuth } from '../contexts/auth-context';
import { useParticipantPages } from '../hooks/use-participant-pages';
import { formatAttemptAllowance } from '../lib/attempt-allowance';
import { formatDuration } from '../lib/format';
import { clientQueryKeys } from '../lib/query-keys';
import { listActivities } from '../services/api';
import type { ActivityKind, ParticipantActivity } from '../services/types';

const STATUS_COLOR: Record<string, string> = {
  Active: '#18B26B',
  'In progress': '#7A5AE0',
  Completed: '#6B6190',
  Upcoming: '#C79A3B',
  Closed: '#B85C38',
};

function firstName(name: string | undefined) {
  const part = name?.trim().split(/\s+/)[0];
  return part || 'there';
}

function windowLabel(item: ParticipantActivity, status: string) {
  const when = status === 'Upcoming' ? item.startsAt : item.endsAt;
  const label = status === 'Upcoming' ? 'Opens' : status === 'Closed' ? 'Ended' : 'Closes';
  if (!when) return { label, value: 'Open' };
  const value = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(when));
  return { label, value };
}

function cardStatus(item: ParticipantActivity) {
  if (item.attemptState === 'submitted') return 'Completed';
  if (item.attemptState === 'in_progress' || item.openAttemptId) return 'In progress';
  if (item.startsAt && new Date(item.startsAt).getTime() > Date.now()) return 'Upcoming';
  if (item.canAttempt === false) return 'Closed';
  return 'Active';
}

function openShort(item: ParticipantActivity) {
  if (!item.startsAt) return 'later';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(
    new Date(item.startsAt),
  );
}

export function LibraryPage({ kind }: { kind: ActivityKind }) {
  const navigate = useNavigate();
  const { participant } = useAuth();
  const pagesQuery = useParticipantPages();
  const resultsOn = pagesQuery.data?.results ?? true;
  const participantId = participant?.id ?? '';
  const word = kind === 'quiz' ? 'quiz' : 'assessment';
  const plural = kind === 'quiz' ? 'quizzes' : 'assessments';
  const base = kind === 'quiz' ? '/quizzes' : '/assessments';

  const {
    data: items = [],
    isPending: loading,
    isError,
  } = useQuery({
    queryKey: clientQueryKeys.activities(participantId, kind),
    queryFn: () => listActivities(kind),
    enabled: Boolean(participantId),
  });

  function open(item: ParticipantActivity) {
    const status = cardStatus(item);
    if (status === 'Completed') {
      if (!resultsOn) return;
      if (item.latestResultId) navigate(`/results/${item.latestResultId}`);
      return;
    }
    if (status === 'Upcoming' || status === 'Closed') return;
    navigate(`${base}/${item.activityId}`);
  }

  return (
    <>
      <h1>Welcome, {firstName(participant?.name)}.</h1>
      <PulseLine />
      <div className="sec2">All {plural}</div>
      {isError ? <p className="portal-note">Unable to load activities.</p> : null}
      <div className="grid" aria-busy={loading || undefined}>
        {loading ? <span className="sr-only">Loading activities</span> : null}
        {!loading && items.length === 0 ? (
          <p className="portal-note" role="status">
            No {plural} yet.
          </p>
        ) : null}
        {items.map((item) => {
          const status = cardStatus(item);
          const win = windowLabel(item, status);
          const attempts = formatAttemptAllowance(item);
          const disabled =
            status === 'Upcoming' || status === 'Closed' || (status === 'Completed' && !resultsOn);
          const label =
            status === 'Upcoming'
              ? `Opens ${openShort(item)}`
              : status === 'Closed'
                ? 'Closed'
                : status === 'In progress'
                  ? 'Continue'
                  : status === 'Completed'
                    ? 'View result'
                    : `Start ${word}`;
          return (
            <article className="card" key={item.activityId}>
              <div className="poster">
                {item.imageFileId || item.contestImageFileId || item.sponsorImageFileId ? (
                  <StoredImage
                    src={`/api/files/${item.imageFileId || item.contestImageFileId || item.sponsorImageFileId}`}
                    alt=""
                  />
                ) : null}
                <span className="st">
                  <i style={{ background: STATUS_COLOR[status] }} />
                  {status}
                </span>
              </div>
              <div className="cb">
                <h4>{item.name}</h4>
                <p>{item.subtitle ?? 'Assigned activity'}</p>
                <div className="meta">
                  <div>
                    <small>{win.label}</small>
                    {win.value}
                  </div>
                  <div>
                    <small>Time</small>
                    {item.durationMinutes != null ? formatDuration(item.durationMinutes) : '—'}
                  </div>
                  <div className="at2">
                    <small>Attempts</small>
                    {attempts}
                  </div>
                </div>
                <button
                  className={`cta ${disabled ? 'off' : ''}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => open(item)}
                >
                  {label} {disabled ? null : <IconArrow />}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
