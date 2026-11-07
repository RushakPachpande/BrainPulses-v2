import { createContext, useContext } from 'react';
import type { ParticipantProfile } from '../services/types';

export class SessionActiveError extends Error {
  constructor() {
    super('SESSION_ACTIVE');
    this.name = 'SessionActiveError';
  }
}

export type AuthState = {
  ready: boolean;
  participant: ParticipantProfile | null;
  signInWithCode: (code: string, replaceSession?: boolean) => Promise<void>;
  signOut: () => void;
  refreshProfile: () => Promise<void>;
};

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
