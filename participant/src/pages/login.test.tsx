/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../contexts/auth-context';
import { LoginPage } from '../pages/login';

const { loginOptions } = vi.hoisted(() => ({
  loginOptions: vi.fn(async () => ({ phoneLogin: false, loginImage: false })),
}));

vi.mock('../services/api', () => ({
  getParticipantLoginOptions: loginOptions,
}));

const auth: AuthState = {
  ready: true,
  participant: null,
  signInWithCode: async () => undefined,
  requestPhoneOtp: async () => undefined,
  resendPhoneOtp: async () => undefined,
  verifyPhoneOtp: async () => undefined,
  signOut: () => undefined,
  refreshProfile: async () => undefined,
};

it('shows the Registration ID field and sign-in button', async () => {
  render(
    <MemoryRouter>
      <AuthContext.Provider value={auth}>
        <LoginPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );

  expect(screen.getByRole('textbox', { name: 'Registration ID' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.queryByLabelText('Mobile number')).not.toBeInTheDocument();
  });
});

it('shows phone sign-in only when the server offers it', async () => {
  loginOptions.mockResolvedValueOnce({ phoneLogin: true, loginImage: false });
  render(
    <MemoryRouter>
      <AuthContext.Provider value={auth}>
        <LoginPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );

  expect(await screen.findByLabelText('Mobile number')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Send code' })).toBeInTheDocument();
});
