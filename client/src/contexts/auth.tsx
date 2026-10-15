import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ApiError, getAccessToken } from '../lib/api-client';
import { getMe, studentSignIn, studentSignOut } from '../services/api';
import type { StudentProfile } from '../services/types';

type AuthState = {
  ready: boolean;
  student: StudentProfile | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [student, setStudent] = useState<StudentProfile | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!getAccessToken()) {
      setStudent(null);
      return;
    }
    const me = await getMe();
    setStudent(me);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (getAccessToken()) {
          const me = await getMe();
          if (!cancelled) setStudent(me);
        }
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          studentSignOut();
        }
        if (!cancelled) setStudent(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const data = await studentSignIn(email, password, 'demo');
    const me = await getMe().catch(() => ({
      id: data.student.id,
      code: data.student.code,
      name: data.student.name,
      email: data.student.email,
      phone: null,
      course: null,
      city: null,
      organization: data.organization,
    }));
    setStudent(me);
  }, []);

  const signOut = useCallback(() => {
    studentSignOut();
    setStudent(null);
  }, []);

  const value = useMemo(
    () => ({ ready, student, signIn, signOut, refreshProfile }),
    [ready, student, signIn, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
