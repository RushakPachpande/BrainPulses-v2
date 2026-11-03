import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, getAccessToken, isSessionActiveConflict } from '../lib/api-client';
import {
  getMe,
  participantRequestOtp,
  participantResendOtp,
  participantSignInByCode,
  participantSignOut,
  participantVerifyOtp,
} from '../services/api';
import type { ParticipantProfile } from '../services/types';
import { clearClientQueryCache } from '../lib/query-client';
import { AuthContext, SessionActiveError } from './auth-context';

const DEFAULT_ORG_SLUG = 'nextgeninnov8';

async function profileFromAuth(data: {
  participant: { id: string; code: string; name: string; email: string };
  organization: { id: string; name: string; slug: string };
}): Promise<ParticipantProfile> {
  return getMe().catch(() => ({
    id: data.participant.id,
    code: data.participant.code,
    name: data.participant.name,
    email: data.participant.email,
    phone: null,
    course: null,
    city: null,
    organization: data.organization,
  }));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [participant, setParticipant] = useState<ParticipantProfile | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!getAccessToken()) {
      setParticipant(null);
      return;
    }
    const me = await getMe();
    setParticipant(me);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (getAccessToken()) {
          const me = await getMe();
          if (!cancelled) setParticipant(me);
        }
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          participantSignOut();
        }
        if (!cancelled) setParticipant(null);
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
      const data = await participantSignInByCode(code.trim(), DEFAULT_ORG_SLUG, replaceSession);
      setParticipant(await profileFromAuth(data));
    } catch (err) {
      if (!replaceSession && isSessionActiveConflict(err)) throw new SessionActiveError();
      throw err;
    }
  }, []);

  const requestPhoneOtp = useCallback(async (countryCode: string, mobileNumber: string) => {
    await participantRequestOtp(countryCode, mobileNumber, DEFAULT_ORG_SLUG);
  }, []);

  const resendPhoneOtp = useCallback(async (countryCode: string, mobileNumber: string) => {
    await participantResendOtp(countryCode, mobileNumber, DEFAULT_ORG_SLUG);
  }, []);

  const verifyPhoneOtp = useCallback(
    async (countryCode: string, mobileNumber: string, otp: string, replaceSession?: boolean) => {
      try {
        const data = await participantVerifyOtp(
          countryCode,
          mobileNumber,
          otp,
          DEFAULT_ORG_SLUG,
          replaceSession,
        );
        setParticipant(await profileFromAuth(data));
      } catch (err) {
        if (!replaceSession && isSessionActiveConflict(err)) throw new SessionActiveError();
        throw err;
      }
    },
    [],
  );

  const signOut = useCallback(() => {
    const participantId = participant?.id ?? null;
    void participantSignOut().finally(() => {
      clearClientQueryCache(participantId);
      setParticipant(null);
    });
  }, [participant?.id]);

  const value = useMemo(
    () => ({
      ready,
      participant,
      signInWithCode,
      requestPhoneOtp,
      resendPhoneOtp,
      verifyPhoneOtp,
      signOut,
      refreshProfile,
    }),
    [
      ready,
      participant,
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
