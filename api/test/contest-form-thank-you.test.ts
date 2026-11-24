import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { saveFormSchema } from '../src/modules/contest-forms/schema.js';
import { publicThankYou, validateForm } from '../src/modules/contest-forms/rules.js';

const open = {
  mode: 'step1' as const,
  sponsorId: '11111111-1111-4111-8111-111111111111',
  contestId: '22222222-2222-4222-8222-222222222222',
  opensAt: '2026-11-01T00:00:00.000Z',
  closesAt: '2026-12-01T00:00:00.000Z',
  seats: null,
  fields: [],
};

describe('contest form thank-you', () => {
  it('accepts a safe button link and rejects a javascript link', () => {
    const safe = saveFormSchema.safeParse({
      ...open,
      thankYouEnabled: true,
      thankYouKind: 'template',
      thankYouButtonLabel: 'Continue',
      thankYouButtonUrl: 'https://brainpulses.com/quiz',
    });
    assert.equal(safe.success, true);

    const unsafe = saveFormSchema.safeParse({
      ...open,
      thankYouButtonUrl: 'javascript:alert(1)',
    });
    assert.equal(unsafe.success, false);
  });

  it('keeps a disabled thank-you from publishing quiz names', () => {
    const hidden = publicThankYou({
      enabled: false,
      kind: 'template',
      title: 'Thanks',
      html: '<p>Hello</p>',
      hasImage: true,
      showNextSteps: true,
      showQuizzes: true,
      quizzes: [{ id: 'q1', name: 'Round 1', kind: 'quiz' }],
      buttonLabel: 'Go',
      buttonUrl: 'https://example.com',
    });
    assert.equal(hidden.enabled, false);
    assert.equal(hidden.title, null);
    assert.equal('quizzes' in hidden, false);

    const shown = publicThankYou({
      enabled: true,
      kind: 'custom',
      title: 'Thanks',
      html: '<p>Hello</p>',
      hasImage: false,
      showNextSteps: false,
      showQuizzes: true,
      quizzes: [{ id: 'q1', name: 'Round 1', kind: 'quiz' }],
      buttonLabel: null,
      buttonUrl: null,
    });
    assert.deepEqual(shown.quizzes, [{ id: 'q1', name: 'Round 1', kind: 'quiz' }]);
  });

  it('asks for a custom message when the thank-you is enabled', () => {
    const issues = validateForm({
      ...open,
      thankYouEnabled: true,
      thankYouKind: 'custom',
      thankYouHtml: '<script>alert(1)</script>',
    });
    assert.equal(
      issues.some((issue) => issue.field === 'thankYouHtml'),
      true,
    );
  });
});
