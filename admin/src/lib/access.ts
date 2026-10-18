import type { AuthMembership } from '@/contexts/auth-context';

export type AccessLevel = 'none' | 'view' | 'edit' | 'full';
export type ActivityKind = 'assessment' | 'quiz';

const accessRank: Record<AccessLevel, number> = {
  none: 0,
  view: 1,
  edit: 2,
  full: 3,
};

function normalizeLevel(raw: string | undefined): AccessLevel {
  if (raw === 'none' || raw === 'view' || raw === 'edit' || raw === 'full') return raw;
  return 'none';
}

export function accessForKind(
  membership: AuthMembership | null | undefined,
  kind: ActivityKind,
): AccessLevel {
  if (!membership) return 'none';
  return normalizeLevel(
    kind === 'assessment' ? membership.assessmentAccess : membership.quizAccess,
  );
}

export function maxOrgAccess(membership: AuthMembership | null | undefined): AccessLevel {
  if (!membership) return 'none';
  const a = accessRank[normalizeLevel(membership.assessmentAccess)];
  const q = accessRank[normalizeLevel(membership.quizAccess)];
  const rank = Math.max(a, q);
  const entry = (Object.entries(accessRank) as [AccessLevel, number][]).find(([, v]) => v === rank);
  return entry?.[0] ?? 'none';
}

function meets(
  membership: AuthMembership | null | undefined,
  level: AccessLevel,
  min: AccessLevel,
): boolean {
  if (!membership) return false;
  if (membership.role === 'super_admin') return true;
  return accessRank[level] >= accessRank[min];
}

/** Rank ≥ edit for the given kind (create/update activities, banks, registrations). */
export function canEditKind(
  membership: AuthMembership | null | undefined,
  kind: ActivityKind,
): boolean {
  return meets(membership, accessForKind(membership, kind), 'edit');
}

/** Rank ≥ full for the given kind (publish/archive). */
export function canFullKind(
  membership: AuthMembership | null | undefined,
  kind: ActivityKind,
): boolean {
  return meets(membership, accessForKind(membership, kind), 'full');
}

/** Org-wide student create/update — max(assessment, quiz) ≥ edit. */
export function canMutateOrg(membership: AuthMembership | null | undefined): boolean {
  return meets(membership, maxOrgAccess(membership), 'edit');
}

/** Invite users / settings patch — max ≥ full (matches API requireOrgAccess('full')). */
export function canManageUsersOrSettings(membership: AuthMembership | null | undefined): boolean {
  return meets(membership, maxOrgAccess(membership), 'full');
}
