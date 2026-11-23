// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { RegisterSuccess, type PublicThankYou } from './register-success';

const off: PublicThankYou = {
  enabled: false,
  kind: 'template',
  title: 'Hidden title',
  html: '<p>Hidden</p>',
  image: false,
  showNextSteps: false,
  showQuizzes: false,
  buttonLabel: null,
  buttonUrl: null,
};

function renderSuccess(thankYou?: PublicThankYou) {
  return render(
    <MemoryRouter>
      <RegisterSuccess
        headingRef={createRef()}
        contestName="Quiz Registration"
        firstName="Asha"
        code="BP00000001"
        slug="quiz"
        thankYou={thankYou}
        onCopy={() => undefined}
      />
    </MemoryRouter>,
  );
}

describe('RegisterSuccess', () => {
  it('keeps the standard success screen when the thank-you is off', () => {
    renderSuccess(off);
    expect(screen.getByRole('heading', { name: "You're registered!" })).toBeInTheDocument();
    expect(screen.getByText('BP00000001')).toBeInTheDocument();
    expect(screen.queryByText('Hidden title')).not.toBeInTheDocument();
  });

  it('shows a custom title and still shows the Registration ID', () => {
    renderSuccess({
      ...off,
      enabled: true,
      kind: 'custom',
      title: 'Thank you for registering!',
      html: '<p>Your registration has been submitted.</p>',
    });
    expect(screen.getByRole('heading', { name: 'Thank you for registering!' })).toBeInTheDocument();
    expect(screen.getByText('Your registration has been submitted.')).toBeInTheDocument();
    expect(screen.getByText('BP00000001')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Log in to BrainPulses/ })).toBeInTheDocument();
  });
});
