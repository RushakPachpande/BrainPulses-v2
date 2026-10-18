import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, getAccessToken, isSessionActiveConflict } from '../lib/api-client';
import {
  getMe,
  studentRequestOtp,
  studentResendOtp,
  studentSignInByCode,
  studentSignOut,
  studentVerifyOtp,
} from '../services/api';
import type { StudentProfile } from '../services/types';
import { AuthContext, SessionActiveError } from './auth-context';

const DEFAULT_ORG_SLUG = 'demo';

async function profileFromAuth(data: {
  student: { id: string; code: string; name: string; email: string };
  organization: { id: string; name: string; slug: string };
}): Promise<StudentProfile> {
  return getMe().catch(() => ({
    id: data.student.id,
    code: data.student.code,
    name: data.student.name,
    email: data.student.email,
    phone: null,
    course: null,
    city: null,
    organization: data.organization,
  }));
}

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

  const signInWithCode = useCallback(async (code: string, replaceSession?: boolean) => {
    try {
      const data = await studentSignInByCode(code.trim(), DEFAULT_ORG_SLUG, replaceSession);
      setStudent(await profileFromAuth(data));
    } catch (err) {
      if (!replaceSession && isSessionActiveConflict(err)) throw new SessionActiveError();
      throw err;
    }
  }, []);

  const requestPhoneOtp = useCallback(async (countryCode: string, mobileNumber: string) => {
    await studentRequestOtp(countryCode, mobileNumber, DEFAULT_ORG_SLUG);
  }, []);

  const resendPhoneOtp = useCallback(async (countryCode: string, mobileNumber: string) => {
    await studentResendOtp(countryCode, mobileNumber, DEFAULT_ORG_SLUG);
  }, []);

  const verifyPhoneOtp = useCallback(
    async (countryCode: string, mobileNumber: string, otp: string, replaceSession?: boolean) => {
      try {
        const data = await studentVerifyOtp(
          countryCode,
          mobileNumber,
          otp,
          DEFAULT_ORG_SLUG,
          replaceSession,
        );
        setStudent(await profileFromAuth(data));
      } catch (err) {
        if (!replaceSession && isSessionActiveConflict(err)) throw new SessionActiveError();
        throw err;
      }
    },
    [],
  );

  const signOut = useCallback(() => {
    void studentSignOut().finally(() => setStudent(null));
  }, []);

  const value = useMemo(
    () => ({
      ready,
      student,
      signInWithCode,
      requestPhoneOtp,
      resendPhoneOtp,
      verifyPhoneOtp,
      signOut,
      refreshProfile,
    }),
    [
      ready,
      student,
      signInWithCode,
      requestPhoneOtp,
      resendPhoneOtp,
      verifyPhoneOtp,
      signOut,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
