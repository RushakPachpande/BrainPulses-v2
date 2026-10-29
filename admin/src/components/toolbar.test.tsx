import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toolbar } from './toolbar';

describe('Toolbar', () => {
  it('exposes search by accessible label and Clear Filters action', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    const onClear = vi.fn();

    render(
      <Toolbar
        searchPlaceholder="Search students"
        searchValue=""
        onSearchChange={onSearchChange}
        filters={[
          {
            name: 'Status',
            options: ['All', 'Active'],
            value: 'All',
            onValueChange: vi.fn(),
          },
        ]}
        actions={
          <button type="button" onClick={onClear}>
            Clear Filters
          </button>
        }
      />,
    );

    expect(screen.getByRole('searchbox', { name: 'Search students' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear Filters' }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('clears the search input when Clear Filters is clicked', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    const onClear = vi.fn();

    render(
      <Toolbar
        searchPlaceholder="Search students"
        searchValue=""
        onSearchChange={onSearchChange}
        filters={[
          {
            name: 'Status',
            options: ['All', 'Active'],
            value: 'All',
            onValueChange: vi.fn(),
          },
        ]}
        actions={
          <button type="button" onClick={onClear}>
            Clear Filters
          </button>
        }
      />,
    );

    const search = screen.getByRole('searchbox', { name: 'Search students' });
    await user.type(search, 'priya');
    expect(search).toHaveValue('priya');

    await user.click(screen.getByRole('button', { name: 'Clear Filters' }));
    expect(onClear).toHaveBeenCalledOnce();
    expect(search).toHaveValue('');
  });
});
