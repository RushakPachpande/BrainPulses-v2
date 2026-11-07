import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  cleanDomain,
  defaultFields,
  domainMessagePreview,
  findReturningParticipant,
  quizAvailability,
  validateAnswers,
  validateForm,
  type SavedPerson,
} from '../src/modules/contest-forms/rules.js';

const riya: SavedPerson = {
  id: 'riya',
  firstName: 'Riya',
  email: 'riya@gmail.com',
  mobile: '9811022334',
  createdAt: 1,
};

function match(
  input: { firstName: string; email: string; mobile: string },
  rule: 'name_and_contact' | 'contact_only',
) {
  return findReturningParticipant([riya], input, rule, true)?.id ?? null;
}

describe('contest form rules', () => {
  it('keeps a returning participant when the spec examples match', () => {
    const same = { firstName: 'Riya', email: 'riya@gmail.com', mobile: '98110 22334' };
    assert.equal(match(same, 'name_and_contact'), 'riya');
    assert.equal(match(same, 'contact_only'), 'riya');
    assert.equal(
      match(
        { firstName: 'Riya', email: 'riya@gmail.com', mobile: '9988776655' },
        'name_and_contact',
      ),
      'riya',
    );
    assert.equal(
      match(
        { firstName: 'Riya', email: 'riya.s@yahoo.com', mobile: '9811022334' },
        'name_and_contact',
      ),
      'riya',
    );
    assert.equal(
      match(
        { firstName: 'Priya', email: 'riya@gmail.com', mobile: '9811022334' },
        'name_and_contact',
      ),
      null,
    );
    assert.equal(
      match({ firstName: 'Priya', email: 'riya@gmail.com', mobile: '9811022334' }, 'contact_only'),
      'riya',
    );
    assert.equal(
      match(
        { firstName: 'Riya', email: 'riya.new@gmail.com', mobile: '9000022222' },
        'name_and_contact',
      ),
      null,
    );
    assert.equal(
      findReturningParticipant(
        [],
        { firstName: 'Aman', email: 'aman@gmail.com', mobile: '9000011111' },
        'name_and_contact',
        true,
      ),
      null,
    );
  });

  it('issues a new id when returning participants are turned off', () => {
    assert.equal(
      findReturningParticipant(
        [riya],
        { firstName: 'Riya', email: 'riya@gmail.com', mobile: '9811022334' },
        'name_and_contact',
        false,
      ),
      null,
    );
  });

  it('cleans domains and rejects junk', () => {
    assert.equal(cleanDomain(' HTTPS://Infosys.com/path '), 'infosys.com');
    assert.equal(cleanDomain('@tcs.com'), 'tcs.com');
    assert.equal(cleanDomain('not a domain'), null);
    assert.equal(
      domainMessagePreview('Please use your {domains} email address to register.', [
        'infosys.com',
        'tcs.com',
      ]),
      'Please use your @infosys.com or @tcs.com email address to register.',
    );
  });

  it('requires a closing time after opening, and two dropdown options', () => {
    const fields = defaultFields().map((field) =>
      field.key === 'gender' ? { ...field, options: ['Male'] } : field,
    );
    const issues = validateForm({
      mode: 'save',
      sponsorId: 's',
      contestId: 'c',
      opensAt: '2026-11-08T10:00:00.000Z',
      closesAt: '2026-11-08T09:00:00.000Z',
      fields,
      domainRestriction: true,
      allowedDomains: [],
      domainMessage: '',
    });
    assert.ok(
      issues.some((issue) => issue.message === 'Closing time must be after the opening time.'),
    );
    assert.ok(issues.some((issue) => issue.message === 'Add at least 2 options.'));
    assert.ok(
      issues.some(
        (issue) => issue.message === 'Add at least one allowed domain, or turn this setting off.',
      ),
    );
  });

  it('checks a mobile number and a required consent box', () => {
    const fields = defaultFields();
    const answers: Record<string, string | boolean> = {
      first_name: 'Aman',
      last_name: 'Shah',
      email: 'aman@gmail.com',
      mobile: '12345',
      terms: false,
    };
    const issues = validateAnswers(fields, answers);
    assert.ok(issues.some((issue) => issue.message === 'Enter a 10-digit mobile number.'));
    assert.ok(issues.some((issue) => issue.message === 'Please accept to continue.'));
  });

  it('marks a quiz ended when its end time has passed', () => {
    const now = new Date('2026-11-07T12:00:00.000Z');
    assert.equal(
      quizAvailability(
        {
          status: 'active',
          startsAt: new Date('2026-11-01T00:00:00.000Z'),
          endsAt: new Date('2026-11-02T00:00:00.000Z'),
        },
        now,
      ),
      'Ended',
    );
    assert.equal(
      quizAvailability(
        { status: 'active', startsAt: new Date('2026-12-01T00:00:00.000Z'), endsAt: null },
        now,
      ),
      'Scheduled',
    );
  });
});
