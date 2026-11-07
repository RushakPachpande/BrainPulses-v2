export const DEFAULT_DOMAIN_MESSAGE = 'Please use your {domains} email address to register.';

export const FIELD_TYPES = [
  'text',
  'number',
  'email',
  'phone',
  'textarea',
  'dropdown',
  'multi_select',
  'consent',
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

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
  options?: string[];
  consentText?: string;
  termsLink?: string;
};

export type MatchRule = 'name_and_contact' | 'contact_only';
export type FieldIssue = { field: string; message: string };

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
  registrationCount: number;
  quizzes: ContestFormQuiz[];
  createdAt: string;
  updatedAt: string;
};

export type ContestFormOverview = {
  kpis: { forms: number; liveLinks: number; participants: number; formsWithoutQuiz: number };
  forms: ContestFormRecord[];
  people: {
    id: string;
    code: string;
    name: string;
    email: string;
    sponsorName: string;
    contestName: string;
    quizzesGiven: number;
    registeredAt: string;
  }[];
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
      options: ['Male', 'Female', 'Prefer not to say'],
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

export function registrationUrl(slug: string) {
  const configured = import.meta.env.VITE_PARTICIPANT_ORIGIN?.trim().replace(/\/$/, '');
  if (configured) return `${configured}/register/${slug}`;
  if (typeof window !== 'undefined' && isLocalHost(window.location.hostname)) {
    const url = new URL(window.location.origin);
    url.port = '5175';
    return `${url.origin}/register/${slug}`;
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
    const label = field.label.trim();
    if (!label) {
      issues.push({ field: field.id, message: 'Add a label for this field.' });
      continue;
    }
    const key = label.toLowerCase();
    if (seen.has(key)) {
      issues.push({
        field: field.id,
        message: `Another field is already called "${label}". Use a different label.`,
      });
    }
    seen.add(key);
    if (
      (field.type === 'dropdown' || field.type === 'multi_select') &&
      (field.options?.length ?? 0) < 2
    ) {
      issues.push({ field: field.id, message: 'Add at least 2 options.' });
    }
    if (field.type === 'consent' && !field.consentText?.trim()) {
      issues.push({ field: field.id, message: 'Add the consent text participants will agree to.' });
    }
    if (
      field.type === 'number' &&
      field.minValue != null &&
      field.maxValue != null &&
      field.minValue > field.maxValue
    ) {
      issues.push({ field: field.id, message: "Min value can't be more than max value." });
    }
    if (field.type === 'multi_select') {
      if (
        field.minSelections != null &&
        field.maxSelections != null &&
        field.minSelections > field.maxSelections
      ) {
        issues.push({
          field: field.id,
          message: "Min selections can't be more than max selections.",
        });
      }
      if (field.maxSelections != null && field.maxSelections > (field.options?.length ?? 0)) {
        issues.push({
          field: field.id,
          message: "Max selections can't be more than the number of options.",
        });
      }
    }
  }
  if (input.mode === 'save' && input.domainRestriction) {
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
  return issues;
}

export function previewIssues(
  fields: FormField[],
  answers: Record<string, string | string[] | boolean>,
) {
  const issues: FieldIssue[] = [];
  for (const field of fields.filter((item) => !item.deleted)) {
    const value = answers[field.id];
    const label = field.label.trim() || 'field';
    if (field.type === 'consent') {
      if (field.required && value !== true)
        issues.push({ field: field.id, message: 'Please accept to continue.' });
      continue;
    }
    if (field.type === 'multi_select') {
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
    if (field.type === 'dropdown') {
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
