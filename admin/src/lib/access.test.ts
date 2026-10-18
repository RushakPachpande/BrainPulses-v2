import { describe, expect, it } from 'vitest';
import type { AuthMembership } from '@/contexts/auth-context';
import { canEditKind, canFullKind, canManageUsersOrSettings, canMutateOrg } from '@/lib/access';

const viewer: AuthMembership = {
  id: 'm1',
  role: 'admin',
  assessmentAccess: 'view',
  quizAccess: 'view',
};

const editor: AuthMembership = {
  id: 'm2',
  role: 'admin',
  assessmentAccess: 'edit',
  quizAccess: 'view',
};

const fullAdmin: AuthMembership = {
  id: 'm3',
  role: 'admin',
  assessmentAccess: 'full',
  quizAccess: 'full',
};

const superAdmin: AuthMembership = {
  id: 'm4',
  role: 'super_admin',
  assessmentAccess: 'view',
  quizAccess: 'view',
};

describe('access helpers', () => {
  it('treats view-only as non-mutating', () => {
    expect(canEditKind(viewer, 'assessment')).toBe(false);
    expect(canEditKind(viewer, 'quiz')).toBe(false);
    expect(canFullKind(viewer, 'assessment')).toBe(false);
    expect(canMutateOrg(viewer)).toBe(false);
    expect(canManageUsersOrSettings(viewer)).toBe(false);
  });

  it('allows edit on the kind with edit access only', () => {
    expect(canEditKind(editor, 'assessment')).toBe(true);
    expect(canEditKind(editor, 'quiz')).toBe(false);
    expect(canMutateOrg(editor)).toBe(true);
    expect(canManageUsersOrSettings(editor)).toBe(false);
  });

  it('allows full and user/settings for full admin', () => {
    expect(canFullKind(fullAdmin, 'quiz')).toBe(true);
    expect(canManageUsersOrSettings(fullAdmin)).toBe(true);
  });

  it('bypasses ranks for super_admin', () => {
    expect(canEditKind(superAdmin, 'assessment')).toBe(true);
    expect(canManageUsersOrSettings(superAdmin)).toBe(true);
  });
});
