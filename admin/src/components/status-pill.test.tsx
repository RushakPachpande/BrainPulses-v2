import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AttemptStatusPill, FlowStatusPill, StatusPill } from './status-pill';

describe('StatusPill', () => {
  it('renders the status value with the given tone', () => {
    render(<StatusPill value="Active" tone="ok" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Active').closest('[data-tone]')).toHaveAttribute('data-tone', 'ok');
  });

  it('uses pr tone for Completed flow status', () => {
    render(<FlowStatusPill status="Completed" />);
    expect(screen.getByText('Completed').closest('[data-tone]')).toHaveAttribute('data-tone', 'pr');
  });

  it('uses ok tone for Completed attempt status', () => {
    const { container } = render(<AttemptStatusPill value="Completed" />);
    expect(container.querySelector('[data-tone]')).toHaveAttribute('data-tone', 'ok');
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });
});
