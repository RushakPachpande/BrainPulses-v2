import { createContext, useContext } from 'react';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

export type AuthOrganization = {
  id: string;
  name: string;
  slug: string;
};

export type AuthMembership = {
  id: string;
  role: 'super_admin' | 'admin';
  assessmentAccess: string;
  quizAccess: string;
};

export type OrgOption = {
  id: string;
  name: string;
  slug: string;
  role: string;
  displayName: string;
};

export type SessionPayload = {
  user: AuthUser;
  organization: AuthOrganization;
  membership: AuthMembership;
};

export type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | {
      status: 'select_organization';
      selectionToken: string;
      organizations: OrgOption[];
    }
  | {
      status: 'authenticated';
      user: AuthUser;
      organization: AuthOrganization;
      membership: AuthMembership;
    };

export type AuthContextValue = AuthState & {
  signIn: (email: string, password: string) => Promise<void>;
  selectOrganization: (organizationId: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
