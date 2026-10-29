import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ModuleNav } from './module-nav';

describe('ModuleNav', () => {
  it('marks the active overview link for assessments', () => {
    render(
      <MemoryRouter initialEntries={['/assessments']}>
        <ModuleNav pathname="/assessments" />
      </MemoryRouter>,
    );

    const overview = screen.getByRole('link', { name: 'Overview' });
    expect(overview).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('navigation', { name: 'Assessment navigation' })).toBeInTheDocument();
  });
});
