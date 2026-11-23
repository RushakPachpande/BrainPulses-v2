import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContestFormBuilder } from '@/components/contest-form-builder';
import {
  defaultFields,
  emptyThankYou,
  type FormField,
  type ThankYouDraft,
} from '@/lib/contest-form';
import { renderWithAdminQuery } from '@/test/render-with-query';

function StatefulBuilder() {
  const [fields, setFields] = useState<FormField[]>(defaultFields());
  const [thankYou, setThankYou] = useState<ThankYouDraft>(emptyThankYou());
  return (
    <ContestFormBuilder
      fields={fields}
      contestName="Quiz Registration"
      registeredCount={0}
      issues={{}}
      thankYou={thankYou}
      onFields={setFields}
      onThankYou={(patch) => setThankYou((current) => ({ ...current, ...patch }))}
    />
  );
}

describe('ContestFormBuilder', () => {
  it('adds a field, edits its label, and turns the thank-you message on', async () => {
    const user = userEvent.setup({ delay: null });
    renderWithAdminQuery(<StatefulBuilder />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Short answer field' }));
    const label = screen.getByLabelText(/^Label/);
    expect(label).toHaveValue('Short answer');
    await user.clear(label);
    await user.type(label, 'City');
    expect(screen.getByLabelText(/^Label/)).toHaveValue('City');

    await user.click(screen.getByRole('tab', { name: 'Thank you message' }));
    await user.click(screen.getByRole('switch', { name: 'Enable thank-you message' }));
    expect(screen.getByRole('switch', { name: 'Enable thank-you message' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});
