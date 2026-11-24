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

describe('contest form rules in the builder', () => {
  const rules = [
    {
      id: 'r1',
      joins: [] as Array<'and' | 'or'>,
      conditions: [{ id: 'c1', fieldId: 'gender', op: 'is' as const, optionId: 'gender-male' }],
      activityIds: [] as string[],
    },
  ];

  it('stops publishing a rule with no activity, but not saving a draft step', () => {
    const save = validateBuilder({ ...base, mode: 'save', assignmentMode: 'rules', rules });
    expect(
      save.some((issue) => issue.message === 'Rule 1 needs at least one quiz or assessment.'),
    ).toBe(true);
    const step1 = validateBuilder({ ...base, assignmentMode: 'rules', rules });
    expect(step1).toEqual([]);
  });

  it('flags a rule whose field was removed', () => {
    const fields = defaultFields().filter((field) => field.key !== 'gender');
    const issues = validateBuilder({ ...base, fields, assignmentMode: 'rules', rules });
    expect(issues[0]?.field).toBe('rule:r1');
  });

  it('gives a duplicated choice field new option IDs', () => {
    const result = duplicateField(defaultFields(), 'gender');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const copy = result.fields.find((field) => field.id === result.id)!;
    expect(copy.options?.map((option) => option.label)).toEqual([
      'Male',
      'Female',
      'Prefer not to say',
    ]);
    expect(copy.options?.some((option) => option.id === 'gender-male')).toBe(false);
  });

  it("doesn't count content blocks toward the 20 extra fields", () => {
    let fields = defaultFields();
    for (let i = 0; i < 18; i += 1) {
      const next = addPaletteField(fields, 'text');
      if (next.ok) fields = next.fields;
    }
    expect(addPaletteField(fields, 'text').ok).toBe(false);
    expect(addPaletteField(fields, 'heading').ok).toBe(true);
  });

  it('keeps First name and Email on the form', () => {
    expect(removeField(defaultFields(), 'first_name')).toEqual(defaultFields());
    expect(
      removeField(defaultFields(), 'mobile').find((field) => field.key === 'mobile')?.deleted,
    ).toBe(true);
  });
});
