export const DEFAULT_DOMAIN_MESSAGE = 'Please use your {domains} email address to register.';

export const FIELD_TYPES = [
  'text',
  'number',
  'email',
  'phone',
  'textarea',
  'dropdown',
  'radio',
  'checkboxes',
  'multi_select',
  'date',
  'time',
  'consent',
  'heading',
  'description',
  'image',
  'divider',
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

/** Choice fields can drive assignment rules. One answer: dropdown, radio. Several: the rest. */
export const SINGLE_CHOICE_TYPES: readonly FieldType[] = ['dropdown', 'radio'];
export const MULTI_CHOICE_TYPES: readonly FieldType[] = ['checkboxes', 'multi_select'];
/** Content blocks show text or an image to participants. They collect no answer. */
export const CONTENT_TYPES: readonly FieldType[] = ['heading', 'description', 'image', 'divider'];

export function isChoiceType(type: FieldType) {
  return SINGLE_CHOICE_TYPES.includes(type) || MULTI_CHOICE_TYPES.includes(type);
}
export function isMultiChoiceType(type: FieldType) {
  return MULTI_CHOICE_TYPES.includes(type);
}
export function isContentType(type: FieldType) {
  return CONTENT_TYPES.includes(type);
}

export type FieldOption = { id: string; label: string };

export type FormField = {
  id: string;
  key: string;
  locked: boolean;
  deleted?: boolean;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  help?: string;
  maxCharacters?: number | null;
  minValue?: number | null;
  maxValue?: number | null;
  minSelections?: number | null;
  maxSelections?: number | null;
  options?: FieldOption[];
  consentText?: string;
  termsLink?: string;
  /** Description block text. */
  text?: string;
  /** Image block. */
  imageFileId?: string | null;
  imageAlt?: string;
};

export type RuleOperator = 'is' | 'is_not' | 'includes' | 'excludes';

export type RuleCondition = {
  id: string;
  fieldId: string;
  op: RuleOperator;
  optionId: string;
};

export type AssignmentRule = {
  id: string;
  /** Join between conditions[i] and conditions[i+1]. Length is conditions.length - 1. */
  joins: Array<'and' | 'or'>;
  conditions: RuleCondition[];
  activityIds: string[];
};

export type AssignmentMode = 'all' | 'rules';

export type MatchRule = 'name_and_contact' | 'contact_only';
export type ThankYouKind = 'template' | 'custom' | 'image';

const THANK_YOU_TAGS = new Set(['p', 'br', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'h2', 'h3']);

/** Keep the same tags the admin instruction sanitizer allows. Attributes are dropped. */
export function sanitizeThankYouHtml(html: string): string {
  const withoutDanger = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  return withoutDanger
    .replace(/<\/?([a-zA-Z0-9]+)(\s[^>]*)?\/?>/g, (match, tag: string) => {
      const name = tag.toLowerCase();
      if (!THANK_YOU_TAGS.has(name)) return '';
      if (name === 'br') return '<br>';
      return match.startsWith('</') ? `</${name}>` : `<${name}>`;
    })
    .trim();
}

export function thankYouHtmlText(html: string): string {
  return sanitizeThankYouHtml(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export type PublicThankYouQuiz = { id: string; name: string; kind: 'quiz' | 'assessment' };

export type PublicThankYou = {
  enabled: boolean;
  kind: ThankYouKind;
  title: string | null;
  html: string | null;
  image: boolean;
  showNextSteps: boolean;
  showQuizzes: boolean;
  quizzes?: PublicThankYouQuiz[];
  buttonLabel: string | null;
  buttonUrl: string | null;
};

export function publicThankYou(input: {
  enabled: boolean;
  kind: ThankYouKind;
  title: string | null;
  html: string | null;
  hasImage: boolean;
  showNextSteps: boolean;
  showQuizzes: boolean;
  quizzes: PublicThankYouQuiz[];
  buttonLabel: string | null;
  buttonUrl: string | null;
}): PublicThankYou {
  if (!input.enabled) {
    return {
      enabled: false,
      kind: input.kind,
      title: null,
      html: null,
      image: false,
      showNextSteps: false,
      showQuizzes: false,
      buttonLabel: null,
      buttonUrl: null,
    };
  }
  const quizzes = input.showQuizzes ? input.quizzes : [];
  return {
    enabled: true,
    kind: input.kind,
    title: input.title,
    html: input.kind === 'custom' ? input.html : null,
    image: input.kind === 'image' && input.hasImage,
    showNextSteps: input.showNextSteps,
    showQuizzes: quizzes.length > 0,
    ...(quizzes.length > 0 ? { quizzes } : {}),
    buttonLabel: input.buttonLabel,
    buttonUrl: input.buttonUrl,
  };
}

export type FieldIssue = { field: string; message: string };

export type SavedPerson = {
  id: string;
  firstName: string;
  email: string;
  mobile: string;
  createdAt: number;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function defaultFields(): FormField[] {
  return [
    locked('first_name', 'First name', 'text', true),
    locked('last_name', 'Last name', 'text', true),
    locked('email', 'Email', 'email', true),
    locked('mobile', 'Mobile number', 'phone', true),
    {
      id: 'gender',
      key: 'gender',
      locked: false,
      label: 'Gender',
      type: 'dropdown',
      required: false,
      options: [
        { id: 'gender-male', label: 'Male' },
        { id: 'gender-female', label: 'Female' },
        { id: 'gender-none', label: 'Prefer not to say' },
      ],
    },
    {
      id: 'terms',
      key: 'terms',
      locked: false,
      label: 'Terms & Conditions',
      type: 'consent',
      required: true,
      consentText: 'I agree to the terms and conditions.',
    },
  ];
}

function locked(key: string, label: string, type: FieldType, required: boolean): FormField {
  return { id: key, key, locked: true, label, type, required };
}

export function slugifyContest(name: string) {
  const base = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || 'contest';
}

export function cleanDomain(raw: string): string | null {
  let text = raw.trim().toLowerCase();
  text = text.replace(/^https?:\/\//, '');
  text = text.split('/')[0] ?? '';
  text = text.split('?')[0] ?? '';
  text = text.replace(/^@/, '');
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(text)) {
    return null;
  }
  return text;
}

export function domainMessagePreview(template: string, domains: string[]) {
  const joined = domains.map((domain) => `@${domain}`).join(' or ');
  return template.replaceAll('{domains}', joined);
}

export function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeMobile(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export function findReturningParticipant(
  people: SavedPerson[],
  input: { firstName: string; email: string; mobile: string },
  rule: MatchRule,
  keepExistingId: boolean,
) {
  if (!keepExistingId) return null;
  const first = normalizeName(input.firstName);
  const email = normalizeEmail(input.email);
  const mobile = normalizeMobile(input.mobile);
  const hits = people.filter((person) => {
    const emailHit = email.length > 0 && normalizeEmail(person.email) === email;
    const mobileHit = mobile.length === 10 && normalizeMobile(person.mobile) === mobile;
    if (!emailHit && !mobileHit) return false;
    if (rule === 'contact_only') return true;
    return first.length > 0 && normalizeName(person.firstName) === first;
  });
  hits.sort((a, b) => a.createdAt - b.createdAt);
  return hits[0] ?? null;
}

export type QuizTiming = {
  status: 'draft' | 'active' | 'completed' | 'archived';
  startsAt: Date | null;
  endsAt: Date | null;
};

export function quizAvailability(quiz: QuizTiming, now: Date) {
  if (quiz.status === 'completed' || quiz.status === 'archived') return 'Ended' as const;
  if (quiz.endsAt && quiz.endsAt.getTime() <= now.getTime()) return 'Ended' as const;
  if (quiz.status === 'draft') return 'Draft' as const;
  if (quiz.startsAt && quiz.startsAt.getTime() > now.getTime()) return 'Scheduled' as const;
  return 'Active' as const;
}

export function validateForm(input: {
  mode: 'draft' | 'step1' | 'save';
  sponsorId?: string | null;
  contestId?: string | null;
  opensAt?: string | null;
  closesAt?: string | null;
  seats?: number | null;
  fields?: FormField[];
  domainRestriction?: boolean;
  allowedDomains?: string[];
  domainMessage?: string;
  thankYouEnabled?: boolean;
  thankYouKind?: ThankYouKind;
  thankYouHtml?: string | null;
  thankYouImageFileId?: string | null;
  thankYouButtonLabel?: string | null;
  thankYouButtonUrl?: string | null;
  assignmentMode?: AssignmentMode;
  rules?: AssignmentRule[];
}): FieldIssue[] {
  if (input.mode === 'draft') return [];
  const issues: FieldIssue[] = [];
  const fields = (input.fields ?? []).filter((field) => !field.deleted);

  if (!input.sponsorId) issues.push({ field: 'sponsorId', message: 'Choose the sponsor.' });
  if (!input.contestId) {
    issues.push({
      field: 'contestId',
      message: input.sponsorId
        ? 'Choose the contest.'
        : 'Choose a sponsor first, then the contest.',
    });
  }
  if (!input.opensAt) {
    issues.push({ field: 'opensAt', message: 'Choose when registration opens.' });
  }
  if (!input.closesAt) {
    issues.push({ field: 'closesAt', message: 'Choose when registration closes.' });
  }
  if (input.opensAt && input.closesAt) {
    const opens = new Date(input.opensAt).getTime();
    const closes = new Date(input.closesAt).getTime();
    if (!Number.isNaN(opens) && !Number.isNaN(closes) && closes <= opens) {
      issues.push({
        field: 'closesAt',
        message: 'Closing time must be after the opening time.',
      });
    }
  }
  if (
    input.seats != null &&
    (!Number.isInteger(input.seats) || input.seats < 1 || input.seats > 100_000)
  ) {
    issues.push({
      field: 'seats',
      message: 'Enter a whole number from 1 to 100,000, or leave it empty for unlimited.',
    });
  }

  const seen = new Map<string, string>();
  for (const field of fields) {
    issues.push(...fieldIssues(field, input.mode));
    if (isContentType(field.type)) continue;
    const label = field.label.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) {
      issues.push({
        field: field.id,
        message: `Another field is already called "${label}". Use a different label.`,
      });
    } else {
      seen.set(key, field.id);
    }
  }

  if (input.mode === 'save') {
    issues.push(...assignmentIssues(fields, input.assignmentMode ?? 'all', input.rules ?? []));
    if (input.domainRestriction) {
      if (!input.allowedDomains?.length) {
        issues.push({
          field: 'allowedDomains',
          message: 'Add at least one allowed domain, or turn this setting off.',
        });
      }
      if (!input.domainMessage?.trim()) {
        issues.push({
          field: 'domainMessage',
          message: "Add the message participants see when their email domain isn't allowed.",
        });
      }
    }
  }

  if (input.thankYouEnabled) {
    if (input.thankYouKind === 'custom' && !thankYouHtmlText(input.thankYouHtml ?? '')) {
      issues.push({ field: 'thankYouHtml', message: 'Add the thank-you message.' });
    }
    if (input.thankYouKind === 'image' && !input.thankYouImageFileId) {
      issues.push({
        field: 'thankYouImageFileId',
        message: 'Add an image for the thank-you message.',
      });
    }
    const buttonLabel = input.thankYouButtonLabel?.trim() ?? '';
    const buttonUrl = input.thankYouButtonUrl?.trim() ?? '';
    if (buttonLabel || buttonUrl) {
      if (!buttonLabel) {
        issues.push({ field: 'thankYouButtonLabel', message: 'Add the button label.' });
      }
      if (!isSafeHttpUrl(buttonUrl)) {
        issues.push({ field: 'thankYouButtonUrl', message: 'Use an http or https link.' });
      }
    }
  }

  return issues;
}

function fieldIssues(field: FormField, mode: 'draft' | 'step1' | 'save'): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const add = (message: string) => issues.push({ field: field.id, message });
  if (field.type === 'divider') return issues;
  if (field.type === 'description') {
    if (!field.text?.trim()) add('Add the text for this block.');
    return issues;
  }
  if (field.type === 'image') {
    if (mode !== 'draft' && !field.imageFileId) add('Add an image, or remove this block.');
    return issues;
  }
  if (!field.label.trim()) {
    add(field.type === 'heading' ? 'Add the heading text.' : 'Add a label for this field.');
    return issues;
  }
  if (field.type === 'heading') return issues;
  if (isChoiceType(field.type)) {
    const options = field.options ?? [];
    const filled = options.filter((option) => option.label.trim());
    if (filled.length < 2) add('Add at least 2 options.');
    if (filled.length !== options.length) add('Fill in every option, or remove the empty one.');
    const labels = new Set(filled.map((option) => option.label.trim().toLowerCase()));
    if (labels.size !== filled.length)
      add('Two options have the same text. Make each one different.');
    const ids = new Set(options.map((option) => option.id));
    if (ids.size !== options.length) add('Two options share an ID. Remove one and add it again.');
  }
  if (field.type === 'consent' && !field.consentText?.trim()) {
    add('Add the consent text participants will agree to.');
  }
  if (
    field.type === 'number' &&
    field.minValue != null &&
    field.maxValue != null &&
    field.minValue > field.maxValue
  ) {
    add("Min value can't be more than max value.");
  }
  if (isMultiChoiceType(field.type)) {
    const min = field.minSelections;
    const max = field.maxSelections;
    const count = field.options?.length ?? 0;
    if (min != null && max != null && min > max) {
      add("Min selections can't be more than max selections.");
    }
    if (max != null && max > count) {
      add("Max selections can't be more than the number of options.");
    }
  }
  if (field.locked && field.key === 'email' && (!field.required || field.deleted)) {
    add('Email stays required.');
  }
  if (field.locked && field.key === 'first_name' && (!field.required || field.deleted)) {
    add('First name stays required.');
  }
  return issues;
}

const SINGLE_OPS: readonly RuleOperator[] = ['is', 'is_not'];
const MULTI_OPS: readonly RuleOperator[] = ['includes', 'excludes'];

/**
 * Checks the rules against the fields they point at. A rule may only use a choice field
 * that is still on the form, and an option that field still has.
 */
export function assignmentIssues(
  fields: FormField[],
  mode: AssignmentMode,
  rules: AssignmentRule[],
): FieldIssue[] {
  if (mode !== 'rules') return [];
  const issues: FieldIssue[] = [];
  if (rules.length === 0) {
    issues.push({ field: 'rules', message: 'Add at least one rule, or use Default Assignment.' });
    return issues;
  }
  const live = new Map(fields.filter((field) => !field.deleted).map((field) => [field.id, field]));
  rules.forEach((rule, index) => {
    const name = `Rule ${index + 1}`;
    const at = `rule:${rule.id}`;
    if (rule.conditions.length === 0) {
      issues.push({ field: at, message: `${name} needs at least one condition.` });
    }
    for (const condition of rule.conditions) {
      const field = live.get(condition.fieldId);
      if (!field || !isChoiceType(field.type)) {
        issues.push({ field: at, message: `${name} uses a field that is no longer on the form.` });
        continue;
      }
      if (!field.options?.some((option) => option.id === condition.optionId)) {
        issues.push({
          field: at,
          message: `${name} uses an answer that "${field.label}" no longer has.`,
        });
        continue;
      }
      const ops = isMultiChoiceType(field.type) ? MULTI_OPS : SINGLE_OPS;
      if (!ops.includes(condition.op)) {
        issues.push({
          field: at,
          message: `${name} has a comparison that doesn't fit "${field.label}".`,
        });
      }
    }
    if (rule.activityIds.length === 0) {
      issues.push({ field: at, message: `${name} needs at least one quiz or assessment.` });
    }
  });
  return issues;
}

/** Rules pointing at a field or option that is no longer on the form. */
export function ruleReferenceIssues(fields: FormField[], rules: AssignmentRule[]): FieldIssue[] {
  const live = new Map(fields.filter((field) => !field.deleted).map((field) => [field.id, field]));
  const issues: FieldIssue[] = [];
  rules.forEach((rule, index) => {
    for (const condition of rule.conditions) {
      if (!condition.fieldId) continue;
      const field = live.get(condition.fieldId);
      if (!field || !isChoiceType(field.type)) {
        issues.push({
          field: `rule:${rule.id}`,
          message: `Rule ${index + 1} uses a field that is no longer on the form. Change the rule first.`,
        });
      } else if (
        condition.optionId &&
        !field.options?.some((option) => option.id === condition.optionId)
      ) {
        issues.push({
          field: `rule:${rule.id}`,
          message: `Rule ${index + 1} uses an answer that "${field.label}" no longer has. Change the rule first.`,
        });
      }
    }
  });
  return issues;
}

/** Fields and options a rule depends on. Used to block deleting them. */
export function ruleReferences(rules: AssignmentRule[]) {
  const fieldIds = new Set<string>();
  const optionIds = new Set<string>();
  for (const rule of rules) {
    for (const condition of rule.conditions) {
      fieldIds.add(condition.fieldId);
      optionIds.add(`${condition.fieldId}:${condition.optionId}`);
    }
  }
  return { fieldIds, optionIds };
}

function conditionMatches(
  condition: RuleCondition,
  fields: Map<string, FormField>,
  answers: Record<string, AnswerValue>,
) {
  const field = fields.get(condition.fieldId);
  if (!field) return false;
  const value = answers[field.id];
  const picked = Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : [];
  const has = picked.includes(condition.optionId);
  if (condition.op === 'is' || condition.op === 'includes') return has;
  return !has;
}

/**
 * The activities one person gets.
 * Default mode: the ticked list. Rules mode: everything from every rule they match;
 * if they match none, the fallback list.
 */
export function activitiesFor(input: {
  mode: AssignmentMode;
  defaultActivityIds: string[];
  rules: AssignmentRule[];
  fallbackActivityIds: string[];
  fields: FormField[];
  answers: Record<string, AnswerValue>;
}): string[] {
  if (input.mode !== 'rules') return [...new Set(input.defaultActivityIds)];
  const fields = new Map(
    input.fields.filter((field) => !field.deleted).map((field) => [field.id, field]),
  );
  const result = new Set<string>();
  let matched = false;
  for (const rule of input.rules) {
    if (rule.conditions.length === 0) continue;
    const hits = rule.conditions.map((condition) =>
      conditionMatches(condition, fields, input.answers),
    );
    const ok = ruleMatchesLeftToRight(hits, rule.joins);
    if (!ok) continue;
    matched = true;
    for (const id of rule.activityIds) result.add(id);
  }
  if (!matched) for (const id of input.fallbackActivityIds) result.add(id);
  return [...result];
}

/** Every activity the form can give: the union used for counts and for the form's activity list. */
export function formActivityIds(input: {
  mode: AssignmentMode;
  defaultActivityIds: string[];
  rules: AssignmentRule[];
  fallbackActivityIds: string[];
}) {
  if (input.mode !== 'rules') return [...new Set(input.defaultActivityIds)];
  return [
    ...new Set([...input.rules.flatMap((rule) => rule.activityIds), ...input.fallbackActivityIds]),
  ];
}

/**
 * Reads stored fields. Forms saved before option IDs existed kept options as plain strings;
 * those get stable IDs from their position so the form keeps working.
 */
export function normalizeFields(value: unknown): FormField[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is FormField => {
      if (!item || typeof item !== 'object') return false;
      const row = item as Partial<FormField>;
      return typeof row.id === 'string' && typeof row.key === 'string';
    })
    .map((field) => {
      if (!Array.isArray(field.options)) return field;
      const options = (field.options as unknown[]).map((option, index) =>
        typeof option === 'string'
          ? { id: `opt-${index + 1}`, label: option }
          : (option as FieldOption),
      );
      return { ...field, options };
    });
}

/** Left-to-right fold: ((c1 ∧ c2) ∨ c3) … matching the UI chip order. */
export function ruleMatchesLeftToRight(hits: boolean[], joins: Array<'and' | 'or'>): boolean {
  if (hits.length === 0) return false;
  let ok = Boolean(hits[0]);
  for (let i = 1; i < hits.length; i += 1) {
    const join = joins[i - 1] === 'or' ? 'or' : 'and';
    ok = join === 'or' ? ok || Boolean(hits[i]) : ok && Boolean(hits[i]);
  }
  return ok;
}

/** Keep joins length in sync with conditions (legacy `join` → fill every edge). */
export function normalizeRule(raw: unknown): AssignmentRule | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Partial<AssignmentRule> & { join?: 'and' | 'or' };
  if (typeof row.id !== 'string' || !Array.isArray(row.conditions)) return null;
  const conditions = row.conditions as RuleCondition[];
  const activityIds = Array.isArray(row.activityIds)
    ? row.activityIds.filter((id): id is string => typeof id === 'string')
    : [];
  const legacy = row.join === 'or' ? 'or' : 'and';
  const base = Array.isArray(row.joins) ? row.joins : [];
  const need = Math.max(0, conditions.length - 1);
  const joins: Array<'and' | 'or'> = [];
  for (let i = 0; i < need; i += 1) {
    const edge = base[i];
    joins.push(edge === 'or' || edge === 'and' ? edge : legacy);
  }
  return { id: row.id, joins, conditions, activityIds };
}

export function normalizeRules(value: unknown): AssignmentRule[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeRule).filter((rule): rule is AssignmentRule => rule !== null);
}

/** Turns stored option IDs back into the text participants saw. */
export function answerLabel(field: FormField, value: AnswerValue): string {
  if (value == null) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const ids = Array.isArray(value) ? value : [value];
  if (!isChoiceType(field.type)) return ids.join(', ');
  return ids.map((id) => field.options?.find((option) => option.id === id)?.label ?? id).join(', ');
}

export type AnswerValue = string | string[] | boolean | null | undefined;

export function validateAnswers(fields: FormField[], answers: Record<string, AnswerValue>) {
  const issues: FieldIssue[] = [];
  for (const field of fields.filter((item) => !item.deleted && !isContentType(item.type))) {
    const value = answers[field.id];
    const label = field.label.trim() || 'field';
    const optionIds = new Set((field.options ?? []).map((option) => option.id));
    if (field.type === 'consent') {
      if (field.required && value !== true) {
        issues.push({ field: field.id, message: 'Please accept to continue.' });
      }
      continue;
    }
    if (isMultiChoiceType(field.type)) {
      const picked = Array.isArray(value) ? value.filter(Boolean) : [];
      if (picked.some((id) => !optionIds.has(id))) {
        issues.push({ field: field.id, message: 'Choose from the options shown.' });
        continue;
      }
      if (field.required && picked.length === 0) {
        issues.push({ field: field.id, message: 'Pick at least one option.' });
      }
      if (field.minSelections != null && picked.length > 0 && picked.length < field.minSelections) {
        issues.push({ field: field.id, message: `Pick at least ${field.minSelections}.` });
      }
      if (field.maxSelections != null && picked.length > field.maxSelections) {
        issues.push({ field: field.id, message: `Pick up to ${field.maxSelections}.` });
      }
      continue;
    }
    if (SINGLE_CHOICE_TYPES.includes(field.type)) {
      const picked = typeof value === 'string' ? value.trim() : '';
      if (field.required && !picked) {
        issues.push({ field: field.id, message: `Choose your ${label}.` });
      } else if (picked && !optionIds.has(picked)) {
        issues.push({ field: field.id, message: 'Choose from the options shown.' });
      }
      continue;
    }
    const text = typeof value === 'string' ? value.trim() : '';
    if (field.required && !text) {
      issues.push({ field: field.id, message: `Enter your ${label}.` });
      continue;
    }
    if (!text) continue;
    if (field.type === 'email' && !EMAIL_RE.test(text)) {
      issues.push({ field: field.id, message: 'Enter a valid email, like name@example.com.' });
    }
    if (field.type === 'phone') {
      const mobile = normalizeMobile(text);
      if (!/^[6-9]\d{9}$/.test(mobile)) {
        issues.push({ field: field.id, message: 'Enter a 10-digit mobile number.' });
      }
    }
    if (field.type === 'date' && !isValidDate(text)) {
      issues.push({ field: field.id, message: 'Enter a valid date.' });
    }
    if (field.type === 'time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) {
      issues.push({ field: field.id, message: 'Enter a valid time.' });
    }
    if (field.type === 'number') {
      const num = Number(text);
      if (!Number.isFinite(num)) {
        issues.push({ field: field.id, message: 'Enter a number.' });
      } else if (field.minValue != null && num < field.minValue) {
        issues.push({ field: field.id, message: `Enter ${field.minValue} or more.` });
      } else if (field.maxValue != null && num > field.maxValue) {
        issues.push({ field: field.id, message: `Enter ${field.maxValue} or less.` });
      }
    }
    if (
      (field.type === 'text' || field.type === 'textarea') &&
      field.maxCharacters != null &&
      text.length > field.maxCharacters
    ) {
      issues.push({
        field: field.id,
        message: `Enter at most ${field.maxCharacters} characters.`,
      });
    }
  }
  return issues;
}

export function emailDomain(email: string) {
  const at = email.lastIndexOf('@');
  return at >= 0 ? email.slice(at + 1).toLowerCase() : '';
}

function isValidDate(text: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
