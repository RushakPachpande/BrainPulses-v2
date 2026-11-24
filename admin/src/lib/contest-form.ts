import { isInstructionsEmpty } from '@/lib/sanitize-html';

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

/** Choice fields can drive assignment rules. Dropdown and radio take one answer. */
const SINGLE_CHOICE: readonly FieldType[] = ['dropdown', 'radio'];
const MULTI_CHOICE: readonly FieldType[] = ['checkboxes', 'multi_select'];
/** Content blocks show text or an image. They collect no answer. */
const CONTENT: readonly FieldType[] = ['heading', 'description', 'image', 'divider'];

export function isChoiceType(type: FieldType) {
  return SINGLE_CHOICE.includes(type) || MULTI_CHOICE.includes(type);
}
export function isMultiChoiceType(type: FieldType) {
  return MULTI_CHOICE.includes(type);
}
export function isContentType(type: FieldType) {
  return CONTENT.includes(type);
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
export type RuleCondition = { id: string; fieldId: string; op: RuleOperator; optionId: string };
export type AssignmentRule = {
  id: string;
  /** Join between conditions[i] and conditions[i+1]. Length is conditions.length - 1. */
  joins: Array<'and' | 'or'>;
  conditions: RuleCondition[];
  activityIds: string[];
};
export type AssignmentMode = 'all' | 'rules';

export const SINGLE_OPS: { value: RuleOperator; label: string }[] = [
  { value: 'is', label: 'is' },
  { value: 'is_not', label: 'is not' },
];
export const MULTI_OPS: { value: RuleOperator; label: string }[] = [
  { value: 'includes', label: 'includes' },
  { value: 'excludes', label: 'does not include' },
];

export type MatchRule = 'name_and_contact' | 'contact_only';
export type ThankYouKind = 'template' | 'custom' | 'image';
export type FieldIssue = { field: string; message: string };

export const MAX_EXTRA_FIELDS = 20;
export const MAX_CONTENT_BLOCKS = 20;

export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  text: 'Short answer',
  number: 'Number',
  email: 'Email',
  phone: 'Phone number',
  textarea: 'Long answer',
  dropdown: 'Dropdown',
  radio: 'Multiple choice',
  checkboxes: 'Checkboxes',
  multi_select: 'Multi-select',
  date: 'Date',
  time: 'Time',
  consent: 'Terms & Conditions',
  heading: 'Heading',
  description: 'Description',
  image: 'Image',
  divider: 'Divider',
};

export const FIELD_PALETTE: {
  id: string;
  label: string;
  items: { type: FieldType; label: string; description: string }[];
}[] = [
  {
    id: 'basic',
    label: 'Basic fields',
    items: [
      { type: 'text', label: 'Short answer', description: 'Single line' },
      { type: 'textarea', label: 'Long answer', description: 'Paragraph' },
      { type: 'number', label: 'Number', description: 'Numeric value' },
    ],
  },
  {
    id: 'choice',
    label: 'Choice fields',
    items: [
      { type: 'dropdown', label: 'Dropdown', description: 'One option, in a list' },
      { type: 'radio', label: 'Multiple choice', description: 'One option, all shown' },
      { type: 'checkboxes', label: 'Checkboxes', description: 'Several, all shown' },
      { type: 'multi_select', label: 'Multi-select', description: 'Several, in a list' },
    ],
  },
  {
    id: 'datetime',
    label: 'Date & time',
    items: [
      { type: 'date', label: 'Date', description: 'Day, month, year' },
      { type: 'time', label: 'Time', description: 'Hours and minutes' },
    ],
  },
  {
    id: 'agreement',
    label: 'Agreement',
    items: [{ type: 'consent', label: 'Terms & Conditions', description: 'Tick to agree' }],
  },
  {
    id: 'content',
    label: 'Content',
    items: [
      { type: 'heading', label: 'Heading', description: 'Section title' },
      { type: 'description', label: 'Description', description: 'A short paragraph' },
      { type: 'image', label: 'Image', description: 'A picture' },
      { type: 'divider', label: 'Divider', description: 'A line between sections' },
    ],
  },
];

/** Contact fields, shown first and locked until unlocked with the admin password. */
export const CORE_FIELDS: Record<
  string,
  { label: string; alwaysRequired: boolean; canDelete: boolean }
> = {
  first_name: { label: 'First name', alwaysRequired: true, canDelete: false },
  last_name: { label: 'Last name', alwaysRequired: false, canDelete: true },
  email: { label: 'Email', alwaysRequired: true, canDelete: false },
  mobile: { label: 'Mobile number', alwaysRequired: false, canDelete: true },
};

export type ThankYouDraft = {
  thankYouEnabled: boolean;
  thankYouKind: ThankYouKind;
  thankYouTitle: string;
  thankYouHtml: string;
  thankYouImageFileId: string | null;
  thankYouShowNextSteps: boolean;
  thankYouShowQuizzes: boolean;
  thankYouButtonLabel: string;
  thankYouButtonUrl: string;
};

export function emptyThankYou(): ThankYouDraft {
  return {
    thankYouEnabled: false,
    thankYouKind: 'template',
    thankYouTitle: '',
    thankYouHtml: '',
    thankYouImageFileId: null,
    thankYouShowNextSteps: false,
    thankYouShowQuizzes: false,
    thankYouButtonLabel: '',
    thankYouButtonUrl: '',
  };
}

export type ContestFormQuiz = {
  id: string;
  name: string;
  kind?: 'quiz' | 'assessment';
  startsAt: string | null;
  endsAt: string | null;
  availability: 'Draft' | 'Scheduled' | 'Active' | 'Ended';
};

export type ContestFormRecord = {
  id: string;
  status: 'draft' | 'saved';
  sponsorId: string | null;
  sponsorName: string;
  sponsorImageFileId: string | null;
  contestId: string | null;
  contestName: string;
  contestImageFileId: string | null;
  opensAt: string | null;
  closesAt: string | null;
  seats: number | null;
  welcomeMessage: string | null;
  showContestImage: boolean;
  showSponsorName: boolean;
  showRegistrationCloses: boolean;
  showSeatsLeft: boolean;
  fields: FormField[];
  slug: string | null;
  linkActive: boolean;
  domainRestriction: boolean;
  allowedDomains: string[];
  domainMessage: string;
  keepExistingId: boolean;
  matchRule: MatchRule;
  assignmentMode: AssignmentMode;
  rules: AssignmentRule[];
  fallbackActivityIds: string[];
  thankYouEnabled: boolean;
  thankYouKind: ThankYouKind;
  thankYouTitle: string | null;
  thankYouHtml: string | null;
  thankYouImageFileId: string | null;
  thankYouShowNextSteps: boolean;
  thankYouShowQuizzes: boolean;
  thankYouButtonLabel: string | null;
  thankYouButtonUrl: string | null;
  registrationCount: number;
  quizzes: ContestFormQuiz[];
  createdAt: string;
  updatedAt: string;
};

export type ContestFormOverview = {
  kpis: {
    forms: number;
    liveLinks: number;
    participants: number;
    formsWithoutActivity: number;
  };
  forms: ContestFormRecord[];
};

export type ContestFormRegistrant = {
  id: string;
  formId: string;
  participantId: string;
  code: string;
  name: string;
  email: string;
  registeredAt: string;
};

export type ContestFormRegistrantDetail = ContestFormRegistrant & {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  answers: Record<string, string | string[] | boolean | null>;
  fields: FormField[];
};

export function newId() {
  return crypto.randomUUID();
}

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

export function emptyDraft(): Omit<ContestFormRecord, 'id' | 'createdAt' | 'updatedAt'> {
  const opens = new Date();
  return {
    status: 'draft',
    sponsorId: null,
    sponsorName: '',
    sponsorImageFileId: null,
    contestId: null,
    contestName: '',
    contestImageFileId: null,
    opensAt: opens.toISOString(),
    closesAt: null,
    seats: null,
    welcomeMessage: '',
    showContestImage: true,
    showSponsorName: true,
    showRegistrationCloses: true,
    showSeatsLeft: true,
    fields: defaultFields(),
    slug: null,
    linkActive: true,
    domainRestriction: false,
    allowedDomains: [],
    domainMessage: DEFAULT_DOMAIN_MESSAGE,
    keepExistingId: true,
    matchRule: 'name_and_contact',
    assignmentMode: 'all',
    rules: [],
    fallbackActivityIds: [],
    ...emptyThankYou(),
    registrationCount: 0,
    quizzes: [],
  };
}

export function formatIst(iso: string | null) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

function isLocalHost(hostname: string) {
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true;
  const parts = hostname.split('.').map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10 || a === 127) return true;
  if (a === 192 && b === 168) return true;
  return a === 172 && b >= 16 && b <= 31;
}

/** admin.example.com → https://participant.example.com (used when VITE_PARTICIPANT_ORIGIN is unset). */
export function participantOriginFromAdminHost(hostname: string, protocol: string): string | null {
  if (!hostname.startsWith('admin.')) return null;
  return `${protocol}//participant.${hostname.slice('admin.'.length)}`;
}

export function registrationUrl(slug: string) {
  const configured = import.meta.env.VITE_PARTICIPANT_ORIGIN?.trim().replace(/\/$/, '');
  if (configured) return `${configured}/register/${slug}`;
  if (typeof window !== 'undefined') {
    const { hostname, protocol, origin } = window.location;
    if (isLocalHost(hostname)) {
      const url = new URL(origin);
      const participantPort = import.meta.env.VITE_PARTICIPANT_DEV_PORT?.trim() || '5174';
      url.port = participantPort;
      return `${url.origin}/register/${slug}`;
    }
    const sibling = participantOriginFromAdminHost(hostname, protocol);
    if (sibling) return `${sibling}/register/${slug}`;
  }
  return `/register/${slug}`;
}

export function cleanDomain(raw: string): string | null {
  let text = raw.trim().toLowerCase();
  text = text.replace(/^https?:\/\//, '');
  text = (text.split('/')[0] ?? '').split('?')[0] ?? '';
  text = text.replace(/^@/, '');
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(text)) {
    return null;
  }
  return text;
}

export function domainMessagePreview(template: string, domains: string[]) {
  return template.replaceAll('{domains}', domains.map((domain) => `@${domain}`).join(' or '));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeMobile(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export function validateBuilder(input: {
  mode: 'draft' | 'step1' | 'save';
  sponsorId: string | null;
  contestId: string | null;
  opensAt: string | null;
  closesAt: string | null;
  seats: number | null;
  fields: FormField[];
  domainRestriction: boolean;
  allowedDomains: string[];
  domainMessage: string;
  thankYouEnabled: boolean;
  thankYouKind: ThankYouKind;
  thankYouHtml: string;
  thankYouImageFileId: string | null;
  thankYouButtonLabel: string;
  thankYouButtonUrl: string;
  assignmentMode?: AssignmentMode;
  rules?: AssignmentRule[];
}): FieldIssue[] {
  if (input.mode === 'draft') return [];
  const issues: FieldIssue[] = [];
  const fields = input.fields.filter((field) => !field.deleted);
  if (!input.sponsorId) issues.push({ field: 'sponsorId', message: 'Choose the sponsor.' });
  if (!input.contestId) {
    issues.push({
      field: 'contestId',
      message: input.sponsorId
        ? 'Choose the contest.'
        : 'Choose a sponsor first, then the contest.',
    });
  }
  if (!input.opensAt) issues.push({ field: 'opensAt', message: 'Choose when registration opens.' });
  if (!input.closesAt)
    issues.push({ field: 'closesAt', message: 'Choose when registration closes.' });
  if (input.opensAt && input.closesAt && new Date(input.closesAt) <= new Date(input.opensAt)) {
    issues.push({ field: 'closesAt', message: 'Closing time must be after the opening time.' });
  }
  if (
    input.seats != null &&
    (!Number.isInteger(input.seats) || input.seats < 1 || input.seats > 100000)
  ) {
    issues.push({
      field: 'seats',
      message: 'Enter a whole number from 1 to 100,000, or leave it empty for unlimited.',
    });
  }
  const seen = new Set<string>();
  for (const field of fields) {
    const fieldProblem = fieldIssue(field);
    if (fieldProblem) issues.push({ field: field.id, message: fieldProblem });
    if (isContentType(field.type) || !field.label.trim()) continue;
    const key = field.label.trim().toLowerCase();
    if (seen.has(key)) {
      issues.push({
        field: field.id,
        message: `Another field is already called "${field.label.trim()}". Use a different label.`,
      });
    }
    seen.add(key);
  }
  issues.push(...ruleReferenceIssues(fields, input.rules ?? []));
  if (input.mode === 'save') {
    issues.push(...ruleIssues(input.assignmentMode ?? 'all', input.rules ?? []));
    if (input.domainRestriction) {
      if (input.allowedDomains.length === 0) {
        issues.push({
          field: 'allowedDomains',
          message: 'Add at least one allowed domain, or turn this setting off.',
        });
      }
      if (!input.domainMessage.trim()) {
        issues.push({
          field: 'domainMessage',
          message: "Add the message participants see when their email domain isn't allowed.",
        });
      }
    }
  }
  issues.push(...thankYouIssues(input));
  return issues;
}

/** The first problem with one field's settings, or null. Used by Save field and by Publish. */
export function fieldIssue(field: FormField): string | null {
  if (field.type === 'divider') return null;
  if (field.type === 'description')
    return field.text?.trim() ? null : 'Add the text for this block.';
  if (field.type === 'image')
    return field.imageFileId ? null : 'Add an image, or remove this block.';
  if (!field.label.trim()) {
    return field.type === 'heading' ? 'Add the heading text.' : 'Add a label for this field.';
  }
  if (isChoiceType(field.type)) {
    const options = field.options ?? [];
    const filled = options.filter((option) => option.label.trim());
    if (filled.length < 2) return 'Add at least 2 options.';
    if (filled.length !== options.length) return 'Fill in every option, or remove the empty one.';
    const labels = new Set(filled.map((option) => option.label.trim().toLowerCase()));
    if (labels.size !== filled.length)
      return 'Two options have the same text. Make each one different.';
  }
  if (field.type === 'consent' && !field.consentText?.trim()) {
    return 'Add the consent text participants will agree to.';
  }
  if (
    field.type === 'number' &&
    field.minValue != null &&
    field.maxValue != null &&
    field.minValue > field.maxValue
  ) {
    return "Min value can't be more than max value.";
  }
  if (isMultiChoiceType(field.type)) {
    if (
      field.minSelections != null &&
      field.maxSelections != null &&
      field.minSelections > field.maxSelections
    ) {
      return "Min selections can't be more than max selections.";
    }
    if (field.maxSelections != null && field.maxSelections > (field.options?.length ?? 0)) {
      return "Max selections can't be more than the number of options.";
    }
  }
  return null;
}

/** Rules that point at a field or option no longer on the form. */
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
          message: `Rule ${index + 1} uses a field that is no longer on the form.`,
        });
      } else if (
        condition.optionId &&
        !field.options?.some((option) => option.id === condition.optionId)
      ) {
        issues.push({
          field: `rule:${rule.id}`,
          message: `Rule ${index + 1} uses an answer that "${field.label}" no longer has.`,
        });
      }
    }
  });
  return issues;
}

/** Problems that stop publishing in rules mode. */
export function ruleIssues(mode: AssignmentMode, rules: AssignmentRule[]): FieldIssue[] {
  if (mode !== 'rules') return [];
  if (rules.length === 0) {
    return [{ field: 'rules', message: 'Add at least one rule, or use Default Assignment.' }];
  }
  const issues: FieldIssue[] = [];
  rules.forEach((rule, index) => {
    if (rule.conditions.some((condition) => !condition.fieldId || !condition.optionId)) {
      issues.push({
        field: `rule:${rule.id}`,
        message: `Finish Rule ${index + 1}: choose a field and an answer for every condition.`,
      });
    }
    if (rule.activityIds.length === 0) {
      issues.push({
        field: `rule:${rule.id}`,
        message: `Rule ${index + 1} needs at least one quiz or assessment.`,
      });
    }
  });
  return issues;
}

/** Rule numbers (1-based) that use a field, or one option of it. */
export function rulesUsing(rules: AssignmentRule[], fieldId: string, optionId?: string) {
  const hits: number[] = [];
  rules.forEach((rule, index) => {
    if (
      rule.conditions.some(
        (condition) =>
          condition.fieldId === fieldId && (!optionId || condition.optionId === optionId),
      )
    ) {
      hits.push(index + 1);
    }
  });
  return hits;
}

/** Every activity the form can give. */
export function formActivityIds(input: {
  assignmentMode: AssignmentMode;
  quizzes: { id: string }[];
  rules: AssignmentRule[];
  fallbackActivityIds: string[];
}) {
  if (input.assignmentMode !== 'rules') return input.quizzes.map((quiz) => quiz.id);
  return [
    ...new Set([...input.rules.flatMap((rule) => rule.activityIds), ...input.fallbackActivityIds]),
  ];
}

export function newRule(): AssignmentRule {
  return {
    id: newId(),
    joins: [],
    conditions: [{ id: newId(), fieldId: '', op: 'is', optionId: '' }],
    activityIds: [],
  };
}

/** Keep joins length in sync with conditions (legacy `join` → fill every edge). */
export function normalizeRule(raw: AssignmentRule & { join?: 'and' | 'or' }): AssignmentRule {
  const legacy = raw.join === 'or' ? 'or' : 'and';
  const need = Math.max(0, raw.conditions.length - 1);
  const base = Array.isArray(raw.joins) && raw.joins.length > 0 ? raw.joins : [];
  const joins: Array<'and' | 'or'> = [];
  for (let i = 0; i < need; i += 1) {
    const edge = base[i];
    joins.push(edge === 'or' || edge === 'and' ? edge : legacy);
  }
  return { id: raw.id, joins, conditions: raw.conditions, activityIds: raw.activityIds };
}

function thankYouIssues(input: {
  thankYouEnabled: boolean;
  thankYouKind: ThankYouKind;
  thankYouHtml: string;
  thankYouImageFileId: string | null;
  thankYouButtonLabel: string;
  thankYouButtonUrl: string;
}): FieldIssue[] {
  if (!input.thankYouEnabled) return [];
  const issues: FieldIssue[] = [];
  if (input.thankYouKind === 'custom' && isInstructionsEmpty(input.thankYouHtml)) {
    issues.push({ field: 'thankYouHtml', message: 'Add the thank-you message.' });
  }
  if (input.thankYouKind === 'image' && !input.thankYouImageFileId) {
    issues.push({
      field: 'thankYouImageFileId',
      message: 'Add an image for the thank-you message.',
    });
  }
  const buttonLabel = input.thankYouButtonLabel.trim();
  const buttonUrl = input.thankYouButtonUrl.trim();
  if (buttonLabel || buttonUrl) {
    if (!buttonLabel) {
      issues.push({ field: 'thankYouButtonLabel', message: 'Add the button label.' });
    }
    if (!isSafeHttpUrl(buttonUrl)) {
      issues.push({ field: 'thankYouButtonUrl', message: 'Use an http or https link.' });
    }
  }
  return issues;
}

export function isSafeHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function previewIssues(
  fields: FormField[],
  answers: Record<string, string | string[] | boolean>,
) {
  const issues: FieldIssue[] = [];
  for (const field of fields.filter((item) => !item.deleted && !isContentType(item.type))) {
    const value = answers[field.id];
    const label = field.label.trim() || 'field';
    if (field.type === 'consent') {
      if (field.required && value !== true)
        issues.push({ field: field.id, message: 'Please accept to continue.' });
      continue;
    }
    if (isMultiChoiceType(field.type)) {
      const picked = Array.isArray(value) ? value : [];
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
    if (isChoiceType(field.type)) {
      if (field.required && !(typeof value === 'string' && value.trim())) {
        issues.push({ field: field.id, message: `Choose your ${label}.` });
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
    if (field.type === 'phone' && !/^[6-9]\d{9}$/.test(normalizeMobile(text))) {
      issues.push({ field: field.id, message: 'Enter a 10-digit mobile number.' });
    }
    if (field.type === 'number') {
      const num = Number(text);
      if (!Number.isFinite(num)) issues.push({ field: field.id, message: 'Enter a number.' });
      else if (field.minValue != null && num < field.minValue) {
        issues.push({ field: field.id, message: `Enter ${field.minValue} or more.` });
      } else if (field.maxValue != null && num > field.maxValue) {
        issues.push({ field: field.id, message: `Enter ${field.maxValue} or less.` });
      }
    }
  }
  return issues;
}

export function sampleRegistrationId() {
  return `BP${String(Math.floor(Math.random() * 100_000_000)).padStart(8, '0')}`;
}

export type FieldEdit =
  { ok: true; fields: FormField[]; id: string } | { ok: false; message: string };

export function newOption(label: string): FieldOption {
  return { id: newId(), label };
}

function blankField(type: FieldType): FormField {
  const id = newId();
  const field: FormField = {
    id,
    key: id,
    locked: false,
    label: FIELD_TYPE_LABEL[type],
    type,
    required: false,
  };
  if (type === 'text') field.maxCharacters = 100;
  if (isChoiceType(type)) field.options = [newOption('Option 1'), newOption('Option 2')];
  if (type === 'consent') {
    field.required = true;
    field.consentText = 'I agree to the terms and conditions.';
  }
  if (type === 'description') field.text = '';
  if (type === 'image') {
    field.label = '';
    field.imageFileId = null;
    field.imageAlt = '';
  }
  if (type === 'divider') field.label = '';
  return field;
}

/** Answer fields beyond the four contact fields. Content blocks don't count. */
export function extraFieldCount(fields: FormField[]) {
  return fields.filter((field) => !field.locked && !field.deleted && !isContentType(field.type))
    .length;
}

function contentCount(fields: FormField[]) {
  return fields.filter((field) => !field.deleted && isContentType(field.type)).length;
}

export function addPaletteField(fields: FormField[], type: FieldType): FieldEdit {
  if (type === 'email' || type === 'phone') {
    const key = type === 'email' ? 'email' : 'mobile';
    const existing = fields.find((field) => field.key === key);
    if (existing) {
      return {
        ok: true,
        id: existing.id,
        fields: existing.deleted
          ? fields.map((field) => (field.id === existing.id ? { ...field, deleted: false } : field))
          : fields,
      };
    }
  }
  if (isContentType(type)) {
    if (contentCount(fields) >= MAX_CONTENT_BLOCKS) {
      return { ok: false, message: 'You can add up to 20 content blocks.' };
    }
  } else if (extraFieldCount(fields) >= MAX_EXTRA_FIELDS) {
    return { ok: false, message: 'You can add up to 20 extra fields.' };
  }
  const field = blankField(type);
  return { ok: true, id: field.id, fields: [...fields, field] };
}

export function duplicateField(fields: FormField[], id: string): FieldEdit {
  const field = fields.find((item) => item.id === id && !item.deleted);
  if (!field) return { ok: false, message: 'That field is not on the form.' };
  if (field.locked) return { ok: false, message: 'Built-in fields stay as they are.' };
  if (
    isContentType(field.type)
      ? contentCount(fields) >= MAX_CONTENT_BLOCKS
      : extraFieldCount(fields) >= MAX_EXTRA_FIELDS
  ) {
    return {
      ok: false,
      message: isContentType(field.type)
        ? 'You can add up to 20 content blocks.'
        : 'You can add up to 20 extra fields.',
    };
  }
  const copyId = newId();
  const copy: FormField = {
    ...field,
    id: copyId,
    key: copyId,
    locked: false,
    label: field.label ? `${field.label} copy`.slice(0, 120) : '',
    // New option IDs so rules on the original don't apply to the copy.
    options: field.options?.map((option) => newOption(option.label)),
  };
  const index = fields.findIndex((item) => item.id === id);
  const next = [...fields];
  next.splice(index + 1, 0, copy);
  return { ok: true, id: copyId, fields: next };
}

export function removeField(fields: FormField[], id: string): FormField[] {
  const field = fields.find((item) => item.id === id);
  if (!field) return fields;
  if (field.locked && !CORE_FIELDS[field.key]?.canDelete) return fields;
  if (field.locked) {
    return fields.map((item) => (item.id === id ? { ...item, deleted: true } : item));
  }
  return fields.filter((item) => item.id !== id);
}

export function moveCustomField(fields: FormField[], id: string, direction: -1 | 1): FormField[] {
  const locked = fields.filter((field) => field.locked);
  const custom = fields.filter((field) => !field.locked);
  const index = custom.findIndex((field) => field.id === id && !field.deleted);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= custom.length || custom[next]?.deleted) return fields;
  const reordered = [...custom];
  const [item] = reordered.splice(index, 1);
  reordered.splice(next, 0, item!);
  return [...locked, ...reordered];
}

export function reorderCustomFields(
  fields: FormField[],
  activeId: string,
  overId: string,
): FormField[] {
  if (activeId === overId) return fields;
  const locked = fields.filter((field) => field.locked);
  const custom = fields.filter((field) => !field.locked);
  const oldIndex = custom.findIndex((field) => field.id === activeId);
  const newIndex = custom.findIndex((field) => field.id === overId);
  if (oldIndex < 0 || newIndex < 0) return fields;
  const reordered = [...custom];
  const [item] = reordered.splice(oldIndex, 1);
  reordered.splice(newIndex, 0, item!);
  return [...locked, ...reordered];
}

export function patchField(field: FormField, patch: Partial<FormField>): FormField {
  const next: FormField = { ...field, ...patch };
  if (next.locked && CORE_FIELDS[next.key]?.alwaysRequired) next.required = true;
  return next;
}

/** Readable text for a stored answer: option IDs become their labels. */
export function answerText(field: FormField, value: string | string[] | boolean | undefined) {
  if (value == null) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const ids = Array.isArray(value) ? value : [value];
  if (!isChoiceType(field.type)) return ids.join(', ');
  return ids.map((id) => field.options?.find((option) => option.id === id)?.label ?? id).join(', ');
}

/**
 * Reads stored fields. Forms saved before option IDs existed kept options as plain text;
 * the API now returns them with IDs, and this keeps older cached data safe too.
 */
export function normalizeFields(fields: FormField[]): FormField[] {
  return fields.map((field) =>
    Array.isArray(field.options)
      ? {
          ...field,
          options: (field.options as unknown[]).map((option, index) =>
            typeof option === 'string'
              ? { id: `opt-${index + 1}`, label: option }
              : (option as FieldOption),
          ),
        }
      : field,
  );
}

export function availabilityTone(value: string): 'ok' | 'gy' | 'wn' {
  if (value === 'Active') return 'ok';
  if (value === 'Ended') return 'gy';
  return 'wn';
}

export function endsBeforeClose(activity: ContestFormQuiz, closesAt: string | null) {
  return Boolean(closesAt && activity.endsAt && new Date(activity.endsAt) < new Date(closesAt));
}

const OP_LABEL: Record<RuleOperator, string> = Object.fromEntries(
  [...SINGLE_OPS, ...MULTI_OPS].map((op) => [op.value, op.label]),
) as Record<RuleOperator, string>;

/** "If City is Pune and Course is BTech → Maths G5, Science G5" */
export function ruleSentence(
  rule: AssignmentRule,
  fields: FormField[],
  names: Map<string, { name: string }>,
) {
  const parts = rule.conditions.map((condition, index) => {
    const field = fields.find((item) => item.id === condition.fieldId);
    const option = field?.options?.find((item) => item.id === condition.optionId);
    const text = `${field?.label ?? '?'} ${OP_LABEL[condition.op] ?? 'is'} ${option?.label ?? '?'}`;
    if (index === 0) return text;
    const join = rule.joins[index - 1] === 'or' ? 'or' : 'and';
    return `${join} ${text}`;
  });
  const activities =
    rule.activityIds.map((id) => names.get(id)?.name ?? 'Removed activity').join(', ') ||
    'nothing chosen';
  return `If ${parts.join(' ')} → ${activities}`;
}
