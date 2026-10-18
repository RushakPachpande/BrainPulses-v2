import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { DashboardPage } from './dashboard';

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    status: 'authenticated',
    user: { id: 'u1', email: 'admin@brainpulses.com', name: 'Admin' },
    organization: { id: 'o1', name: 'Demo', slug: 'demo' },
    membership: {
      id: 'm1',
      role: 'super_admin',
      assessmentAccess: 'full',
      quizAccess: 'full',
    },
    signIn: vi.fn(),
    selectOrganization: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock('@/services', async () => {
  const actual = await vi.importActual<typeof import('@/services')>('@/services');
  return {
    ...actual,
    getDashboard: vi.fn(async () => ({
      kpis: [
        ['Total Students', '42', '+2%', 0] as const,
        ['Active Assessments', '3', '', 1] as const,
      ],
      charts: [],
      activity: [['act-1', 'Seeded activity', 'Just now'] as const],
    })),
  };
});

describe('DashboardPage', () => {
  it('renders KPI labels and quick actions', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Total Students')).toBeInTheDocument();
    });
    expect(screen.getByText('Active Assessments')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Create Assessment/i })).toBeInTheDocument();
  });
});
