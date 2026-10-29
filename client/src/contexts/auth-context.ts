import { createContext, useContext } from 'react';
import type { StudentProfile } from '../services/types';

export class SessionActiveError extends Error {
  constructor() {
    super('SESSION_ACTIVE');
    this.name = 'SessionActiveError';
  }
}

export type AuthState = {
  ready: boolean;
  student: StudentProfile | null;
  signInWithCode: (code: string, replaceSession?: boolean) => Promise<void>;
  requestPhoneOtp: (countryCode: string, mobileNumber: string) => Promise<void>;
  resendPhoneOtp: (countryCode: string, mobileNumber: string) => Promise<void>;
  verifyPhoneOtp: (
    countryCode: string,
    mobileNumber: string,
    otp: string,
    replaceSession?: boolean,
  ) => Promise<void>;
  signOut: () => void;
  refreshProfile: () => Promise<void>;
};

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
