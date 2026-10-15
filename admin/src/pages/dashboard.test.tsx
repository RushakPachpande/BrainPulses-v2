import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { DashboardPage } from './dashboard';

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
