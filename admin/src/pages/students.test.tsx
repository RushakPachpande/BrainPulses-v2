import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { PageHeaderProvider } from '@/contexts/page-header';
import { StudentsPage } from './students';

vi.mock('@/services', async () => {
  const actual = await vi.importActual<typeof import('@/services')>('@/services');
  return {
    ...actual,
    getStudents: vi.fn(async () => [
      {
        id: 'uuid-stu-1',
        code: 'STU-1',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        phone: '555-0100',
        registered: '01 Jan 2026, 10:00 AM',
        activities: 2,
        status: 'Active',
        lastLogin: '02 Jan 2026, 09:00 AM',
        course: 'CSE',
        city: 'London',
      },
    ]),
  };
});

describe('StudentsPage', () => {
  it('shows the students footer count after load', async () => {
    render(
      <MemoryRouter>
        <PageHeaderProvider>
          <StudentsPage />
        </PageHeaderProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Showing 1 to 1 of 1 students/i)).toBeInTheDocument();
    });
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  });
});
