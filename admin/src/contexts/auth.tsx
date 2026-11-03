import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  apiPostData,
  apiRequest,
  refreshAuthSession,
  setAccessToken,
  type RefreshedSession,
} from '@/lib/api-client';
import {
  AuthContext,
  type AuthContextValue,
  type AuthState,
  type AuthUser,
  type OrgOption,
  type SessionPayload,
} from '@/contexts/auth-context';
import { clearAllListSelections } from '@/lib/list-selection';
import { clearAdminQueryCache } from '@/lib/query-client';

type SessionWithToken = SessionPayload & { accessToken: string };

function normalizeUser(user: {
  id: string;
  email: string;
  name: string;
  mustChangePassword?: boolean;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    mustChangePassword: user.mustChangePassword === true,
  };
}

function applySession(session: SessionWithToken, setState: (state: AuthState) => void) {
  setAccessToken(session.accessToken);
  setState({
    status: 'authenticated',
    user: normalizeUser(session.user),
    organization: session.organization,
    membership: session.membership,
  });
}

function toSessionWithToken(session: RefreshedSession): SessionWithToken {
  return {
    accessToken: session.accessToken,
    user: normalizeUser(session.user),
    organization: session.organization,
    membership: {
      id: session.membership.id,
      role: session.membership.role as SessionPayload['membership']['role'],
      assessmentAccess: session.membership.assessmentAccess,
      quizAccess: session.membership.quizAccess,
    },
  };
}

async function bootstrapSession(setState: (state: AuthState) => void) {
  const refreshed = await refreshAuthSession();
  if (refreshed) {
    applySession(toSessionWithToken(refreshed), setState);
    return;
  }
  setAccessToken(null);
  setState({ status: 'anonymous' });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    void bootstrapSession(setState);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await apiPostData<
      | { status: 'authenticated'; session: SessionWithToken }
      | { status: 'select_organization'; selectionToken: string; organizations: OrgOption[] }
    >('/api/auth/sign-in', { email, password });

    if (result.status === 'select_organization') {
      setAccessToken(null);
      setState({
        status: 'select_organization',
        selectionToken: result.selectionToken,
        organizations: result.organizations,
      });
      return;
    }

    applySession(
      {
        ...result.session,
        user: normalizeUser(result.session.user),
      },
      setState,
    );
  }, []);

  const selectOrganization = useCallback(
    async (organizationId: string) => {
      if (state.status !== 'select_organization') return;
      const result = await apiPostData<{
        status: 'authenticated';
        session: SessionWithToken;
      }>('/api/auth/select-organization', {
        selectionToken: state.selectionToken,
        organizationId,
      });
      applySession(
        {
          ...result.session,
          user: normalizeUser(result.session.user),
        },
        setState,
      );
    },
    [state],
  );

  const signOut = useCallback(async () => {
    const orgId = state.status === 'authenticated' ? state.organization.id : null;
    try {
      await apiRequest('/api/auth/sign-out', { method: 'POST' });
    } catch {
      /* ignore */
    }
    clearAdminQueryCache(orgId);
    clearAllListSelections();
    setAccessToken(null);
    setState({ status: 'anonymous' });
  }, [state]);

  const acceptSession = useCallback((session: SessionWithToken) => {
    applySession(
      {
        ...session,
        user: normalizeUser(session.user),
        membership: {
          id: session.membership.id,
          role: session.membership.role as SessionPayload['membership']['role'],
          assessmentAccess: session.membership.assessmentAccess,
          quizAccess: session.membership.quizAccess,
        },
      },
      setState,
    );
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signIn,
      selectOrganization,
      signOut,
      acceptSession,
    }),
    [state, signIn, selectOrganization, signOut, acceptSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
