import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContestFormBuilder } from '@/components/contest-form-builder';
import {
  defaultFields,
  emptyThankYou,
  type AssignmentRule,
  type FormField,
  type ThankYouDraft,
} from '@/lib/contest-form';
import { renderWithAdminQuery } from '@/test/render-with-query';

function StatefulBuilder({ rules = [] }: { rules?: AssignmentRule[] }) {
  const [fields, setFields] = useState<FormField[]>(defaultFields());
  const [thankYou, setThankYou] = useState<ThankYouDraft>(emptyThankYou());
  return (
    <ContestFormBuilder
      fields={fields}
      contestName="Quiz Registration"
      registeredCount={0}
      issues={{}}
      thankYou={thankYou}
      rules={rules}
      coreUnlocked={false}
      onUnlockCore={() => undefined}
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

    await user.click(screen.getByRole('tab', { name: 'Thank You Message' }));
    await user.click(screen.getByRole('switch', { name: 'Enable thank-you message' }));
    expect(screen.getByRole('switch', { name: 'Enable thank-you message' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('puts the field back when Cancel is pressed, and keeps it after Save field', async () => {
    const user = userEvent.setup({ delay: null });
    renderWithAdminQuery(<StatefulBuilder />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Short answer field' }));
    const label = screen.getByLabelText(/^Label/);
    await user.clear(label);
    await user.type(label, 'School');
    expect(screen.getByText(/Unsaved changes/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText(/^Label/)).toHaveValue('Short answer');

    await user.clear(screen.getByLabelText(/^Label/));
    await user.type(screen.getByLabelText(/^Label/), 'School');
    await user.click(screen.getByRole('button', { name: 'Save field' }));
    expect(screen.queryByText(/Unsaved changes/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Label/)).toHaveValue('School');
  });

  it('keeps contact fields locked until unlocked', async () => {
    const user = userEvent.setup({ delay: null });
    renderWithAdminQuery(<StatefulBuilder />);
    await user.click(screen.getByRole('button', { name: 'Settings for Email' }));
    expect(screen.getByText('Locked contact field')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Label/)).not.toBeInTheDocument();
  });

  it("won't delete an option a rule uses", async () => {
    const user = userEvent.setup({ delay: null });
    const rules: AssignmentRule[] = [
      {
        id: 'r1',
        joins: [],
        conditions: [{ id: 'c1', fieldId: 'gender', op: 'is', optionId: 'gender-female' }],
        activityIds: ['a1'],
      },
    ];
    renderWithAdminQuery(<StatefulBuilder rules={rules} />);
    await user.click(screen.getByRole('button', { name: 'Settings for Gender' }));
    expect(
      screen.getByRole('button', { name: "Option 2 is used in Rule 1 and can't be deleted" }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete option 1' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
  });
});
