import { describe, expect, it } from 'vitest';
import {
  addPaletteField,
  defaultFields,
  duplicateField,
  emptyThankYou,
  removeField,
  reorderCustomFields,
  validateBuilder,
} from './contest-form';

const base = {
  mode: 'step1' as const,
  sponsorId: 'sponsor',
  contestId: 'contest',
  opensAt: '2026-11-01T00:00:00.000Z',
  closesAt: '2026-12-01T00:00:00.000Z',
  seats: null,
  fields: defaultFields(),
  domainRestriction: false,
  allowedDomains: [] as string[],
  domainMessage: '',
  ...emptyThankYou(),
};

describe('contest form builder fields', () => {
  it('keeps locked fields first when custom fields are reordered', () => {
    const fields = defaultFields();
    const custom = fields.filter((field) => !field.locked);
    const reordered = reorderCustomFields(fields, custom[1]!.id, custom[0]!.id);
    expect(reordered.filter((field) => field.locked).map((field) => field.key)).toEqual([
      'first_name',
      'last_name',
      'email',
      'mobile',
    ]);
    expect(reordered.find((field) => !field.locked)?.id).toBe(custom[1]!.id);
  });

  it('adds a short answer and refuses a duplicate of a locked field', () => {
    const added = addPaletteField(defaultFields(), 'text');
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(added.fields.filter((field) => !field.locked && !field.deleted)).toHaveLength(3);

    const email = addPaletteField(defaultFields(), 'email');
    expect(email.ok).toBe(true);
    if (!email.ok) return;
    expect(email.fields).toEqual(defaultFields());
    expect(email.id).toBe('email');

    const duplicated = duplicateField(defaultFields(), 'email');
    expect(duplicated.ok).toBe(false);
  });

  it('does not remove the email field', () => {
    expect(removeField(defaultFields(), 'email')).toEqual(defaultFields());
  });

  it('requires thank-you copy, an image, and an http link only when enabled', () => {
    expect(validateBuilder(base)).toEqual([]);
    expect(
      validateBuilder({
        ...base,
        thankYouEnabled: true,
        thankYouKind: 'custom',
        thankYouHtml: '<p> </p>',
      }).some((issue) => issue.field === 'thankYouHtml'),
    ).toBe(true);
    expect(
      validateBuilder({
        ...base,
        thankYouEnabled: true,
        thankYouKind: 'image',
      }).some((issue) => issue.field === 'thankYouImageFileId'),
    ).toBe(true);
    expect(
      validateBuilder({
        ...base,
        thankYouEnabled: true,
        thankYouButtonLabel: 'Go',
        thankYouButtonUrl: 'javascript:alert(1)',
      }).some((issue) => issue.field === 'thankYouButtonUrl'),
    ).toBe(true);
  });
});
