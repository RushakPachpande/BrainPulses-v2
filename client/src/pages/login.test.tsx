/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { expect, it } from 'vitest';
import { AuthContext, type AuthState } from '../contexts/auth-context';
import { LoginPage } from '../pages/login';

const auth: AuthState = {
  ready: true,
  student: null,
  signInWithCode: async () => undefined,
  requestPhoneOtp: async () => undefined,
  resendPhoneOtp: async () => undefined,
  verifyPhoneOtp: async () => undefined,
  signOut: () => undefined,
  refreshProfile: async () => undefined,
};

it('shows the Unique ID field and sign-in button', () => {
  render(
    <MemoryRouter>
      <AuthContext.Provider value={auth}>
        <LoginPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );

  expect(screen.getByRole('textbox', { name: 'Unique ID' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
});
