import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { PageHeaderProvider } from '@/contexts/page-header';
import { renderWithAdminQuery } from '@/test/render-with-query';
import { ParticipantsPage } from './participants';

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    status: 'authenticated',
    user: {
      id: 'u1',
      email: 'viewer@brainpulses.com',
      name: 'Viewer',
      mustChangePassword: false,
    },
    organization: { id: 'o1', name: 'NextGenInnov8', slug: 'nextgeninnov8' },
    membership: {
      id: 'm1',
      role: 'admin',
      assessmentAccess: 'view',
      quizAccess: 'view',
    },
    signIn: vi.fn(),
    selectOrganization: vi.fn(),
    signOut: vi.fn(),
    acceptSession: vi.fn(),
  }),
}));

vi.mock('@/services/contest-forms', () => ({
  getContestFormOverview: vi.fn(async () => ({
    kpis: { forms: 1, liveLinks: 1, participants: 1, formsWithoutQuiz: 0 },
    forms: [
      {
        id: 'form-1',
        status: 'saved',
        sponsorId: 's1',
        sponsorName: 'Acme',
        sponsorImageFileId: null,
        contestId: 'c1',
        contestName: 'Code Quest',
        contestImageFileId: null,
        opensAt: null,
        closesAt: null,
        seats: null,
        welcomeMessage: '',
        showContestImage: true,
        showSponsorName: true,
        showRegistrationCloses: true,
        showSeatsLeft: true,
        fields: [],
        slug: 'code-quest',
        linkActive: true,
        domainRestriction: false,
        allowedDomains: [],
        domainMessage: '',
        keepExistingId: true,
        matchRule: 'name_and_contact',
        registrationCount: 1,
        quizzes: [
          { id: 'q1', name: 'Round 1', startsAt: null, endsAt: null, availability: 'Active' },
        ],
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      },
    ],
    people: [
      {
        id: 'sub-1',
        code: 'BP48210937',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        sponsorName: 'Acme',
        contestName: 'Code Quest',
        quizzesGiven: 1,
        registeredAt: '2026-11-02T04:30:00.000Z',
      },
    ],
  })),
}));

describe('ParticipantsPage', () => {
  it('shows saved forms and people who registered through them', async () => {
    renderWithAdminQuery(
      <MemoryRouter>
        <PageHeaderProvider>
          <ParticipantsPage />
        </PageHeaderProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Code Quest')).toBeInTheDocument();
    });
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText(/Showing 1 to 1 of 1 participants/i)).toBeInTheDocument();
  });
});
