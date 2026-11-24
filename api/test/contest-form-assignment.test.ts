import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  activitiesFor,
  assignmentIssues,
  formActivityIds,
  normalizeFields,
  normalizeRules,
  ruleReferenceIssues,
  validateAnswers,
  type AssignmentRule,
  type FormField,
} from '../src/modules/contest-forms/rules.js';

const city: FormField = {
  id: 'city',
  key: 'city',
  locked: false,
  label: 'City',
  type: 'dropdown',
  required: true,
  options: [
    { id: 'pune', label: 'Pune' },
    { id: 'blr', label: 'Bengaluru' },
  ],
};
const course: FormField = {
  id: 'course',
  key: 'course',
  locked: false,
  label: 'Course',
  type: 'radio',
  required: false,
  options: [
    { id: 'bsc', label: 'BSc' },
    { id: 'btech', label: 'BTech' },
  ],
};
const topics: FormField = {
  id: 'topics',
  key: 'topics',
  locked: false,
  label: 'Topics',
  type: 'checkboxes',
  required: false,
  options: [
    { id: 'ai', label: 'AI' },
    { id: 'web', label: 'Web' },
  ],
};
const fields = [city, course, topics];

const rules: AssignmentRule[] = [
  {
    id: 'r1',
    joins: [],
    conditions: [{ id: 'c1', fieldId: 'city', op: 'is', optionId: 'pune' }],
    activityIds: ['A', 'B'],
  },
  {
    id: 'r2',
    joins: ['and'],
    conditions: [
      { id: 'c2', fieldId: 'city', op: 'is', optionId: 'blr' },
      { id: 'c3', fieldId: 'course', op: 'is', optionId: 'btech' },
    ],
    activityIds: ['D'],
  },
  {
    id: 'r3',
    joins: ['or'],
    conditions: [
      { id: 'c4', fieldId: 'topics', op: 'includes', optionId: 'ai' },
      { id: 'c5', fieldId: 'course', op: 'is', optionId: 'bsc' },
    ],
    activityIds: ['E'],
  },
];

function given(answers: Record<string, string | string[]>) {
  return activitiesFor({
    mode: 'rules',
    defaultActivityIds: [],
    rules,
    fallbackActivityIds: ['F'],
    fields,
    answers,
  }).sort();
}

describe('contest form assignment rules', () => {
  it('gives everything from every rule a person matches', () => {
    assert.deepEqual(given({ city: 'pune', topics: ['ai'] }), ['A', 'B', 'E']);
  });

  it('needs every condition for AND, any condition for OR', () => {
    assert.deepEqual(given({ city: 'blr', course: 'btech' }), ['D']);
    assert.deepEqual(given({ city: 'blr', course: 'bsc' }), ['E']);
  });

  it('evaluates mixed AND/OR left to right per edge', () => {
    const mixed: AssignmentRule[] = [
      {
        id: 'mix',
        joins: ['and', 'or'],
        conditions: [
          { id: 'c1', fieldId: 'city', op: 'is', optionId: 'pune' },
          { id: 'c2', fieldId: 'course', op: 'is', optionId: 'btech' },
          { id: 'c3', fieldId: 'topics', op: 'includes', optionId: 'ai' },
        ],
        activityIds: ['M'],
      },
    ];
    const run = (answers: Record<string, string | string[]>) =>
      activitiesFor({
        mode: 'rules',
        defaultActivityIds: [],
        rules: mixed,
        fallbackActivityIds: [],
        fields,
        answers,
      });
    // (Pune AND BTech) OR AI → AI alone matches
    assert.deepEqual(run({ city: 'blr', course: 'bsc', topics: ['ai'] }), ['M']);
    // Pune AND BTech matches without AI
    assert.deepEqual(run({ city: 'pune', course: 'btech', topics: [] }), ['M']);
    // Pune alone does not
    assert.deepEqual(run({ city: 'pune', course: 'bsc', topics: [] }), []);
  });

  it('migrates legacy single join into per-edge joins', () => {
    const migrated = normalizeRules([
      {
        id: 'legacy',
        join: 'or',
        conditions: [
          { id: 'c1', fieldId: 'city', op: 'is', optionId: 'pune' },
          { id: 'c2', fieldId: 'course', op: 'is', optionId: 'btech' },
          { id: 'c3', fieldId: 'topics', op: 'includes', optionId: 'ai' },
        ],
        activityIds: ['X'],
      },
    ]);
    assert.deepEqual(migrated[0]?.joins, ['or', 'or']);
  });

  it('uses the fallback only when no rule matches', () => {
    assert.deepEqual(given({ city: 'blr' }), ['F']);
  });

  it('gives the ticked list to everyone in default mode', () => {
    const ids = activitiesFor({
      mode: 'all',
      defaultActivityIds: ['A', 'A', 'C'],
      rules,
      fallbackActivityIds: ['F'],
      fields,
      answers: {},
    });
    assert.deepEqual(ids, ['A', 'C']);
  });

  it('treats "does not include" as true when the option was not picked', () => {
    const ids = activitiesFor({
      mode: 'rules',
      defaultActivityIds: [],
      rules: [
        {
          id: 'x',
          joins: [],
          conditions: [{ id: 'c', fieldId: 'topics', op: 'excludes', optionId: 'web' }],
          activityIds: ['G'],
        },
      ],
      fallbackActivityIds: [],
      fields,
      answers: { topics: ['ai'] },
    });
    assert.deepEqual(ids, ['G']);
  });

  it('lists every activity the form can give', () => {
    const ids = formActivityIds({
      mode: 'rules',
      defaultActivityIds: [],
      rules,
      fallbackActivityIds: ['F', 'A'],
    }).sort();
    assert.deepEqual(ids, ['A', 'B', 'D', 'E', 'F']);
  });

  it('flags rules that point at a removed field or option', () => {
    const withoutCourse = [city, topics];
    const issues = ruleReferenceIssues(withoutCourse, rules);
    assert.ok(issues.some((issue) => issue.message.startsWith('Rule 2 uses a field')));
    const fewerOptions = [
      { ...city, options: [{ id: 'blr', label: 'Bengaluru' }] },
      course,
      topics,
    ];
    const optionIssues = ruleReferenceIssues(fewerOptions, rules);
    assert.ok(optionIssues.some((issue) => issue.message.startsWith('Rule 1 uses an answer')));
  });

  it('asks for at least one rule and an activity in every rule', () => {
    assert.ok(assignmentIssues(fields, 'rules', []).some((issue) => issue.field === 'rules'));
    const empty = assignmentIssues(fields, 'rules', [{ ...rules[0]!, activityIds: [] }]);
    assert.ok(
      empty.some((issue) => issue.message === 'Rule 1 needs at least one quiz or assessment.'),
    );
    assert.deepEqual(assignmentIssues(fields, 'all', []), []);
  });

  it('accepts option IDs and rejects text that is not an option', () => {
    assert.deepEqual(validateAnswers(fields, { city: 'pune', topics: ['ai', 'web'] }), []);
    const bad = validateAnswers(fields, { city: 'Mumbai' });
    assert.equal(bad[0]?.message, 'Choose from the options shown.');
  });

  it('checks dates and times, and skips content blocks', () => {
    const extra: FormField[] = [
      {
        id: 'dob',
        key: 'dob',
        locked: false,
        label: 'Date of birth',
        type: 'date',
        required: true,
      },
      { id: 'slot', key: 'slot', locked: false, label: 'Slot', type: 'time', required: false },
      { id: 'h', key: 'h', locked: false, label: 'About you', type: 'heading', required: false },
    ];
    assert.deepEqual(validateAnswers(extra, { dob: '2008-02-29', slot: '09:30' }), []);
    const issues = validateAnswers(extra, { dob: '2007-02-29', slot: '25:00' });
    assert.deepEqual(
      issues.map((issue) => issue.message),
      ['Enter a valid date.', 'Enter a valid time.'],
    );
  });

  it('gives old plain-text options stable IDs', () => {
    const [field] = normalizeFields([{ ...city, options: ['Pune', 'Bengaluru'] }]);
    assert.deepEqual(field?.options, [
      { id: 'opt-1', label: 'Pune' },
      { id: 'opt-2', label: 'Bengaluru' },
    ]);
  });
});
