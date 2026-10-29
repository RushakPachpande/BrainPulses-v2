/** Display labels derived from stored FlowStatus + schedule window. */
export type ActivityStatusDisplay =
  'Draft' | 'Scheduled' | 'Active' | 'Expired' | 'Completed' | 'Archived';

export function activityStatusDisplay(
  status: string,
  startsAt: Date | string | null | undefined,
  endsAt: Date | string | null | undefined,
  now: Date = new Date(),
): ActivityStatusDisplay {
  const key = status.trim().toLowerCase();
  if (key === 'draft') return 'Draft';
  if (key === 'completed') return 'Completed';
  if (key === 'archived') return 'Archived';
  if (key !== 'active') {
    return (status.charAt(0).toUpperCase() + status.slice(1)) as ActivityStatusDisplay;
  }

  const start = startsAt ? new Date(startsAt) : null;
  const end = endsAt ? new Date(endsAt) : null;
  if (start && !Number.isNaN(start.getTime()) && start > now) return 'Scheduled';
  if (end && !Number.isNaN(end.getTime()) && end < now) return 'Expired';
  return 'Active';
}
