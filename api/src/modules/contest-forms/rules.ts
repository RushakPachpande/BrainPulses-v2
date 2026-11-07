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
    } else {
      seen.set(key, field.id);
    }
    if (
      (field.type === 'dropdown' || field.type === 'multi_select') &&
      (field.options?.length ?? 0) < 2
    ) {
      issues.push({ field: field.id, message: 'Add at least 2 options.' });
    }
    if (field.type === 'consent' && !field.consentText?.trim()) {
      issues.push({
        field: field.id,
        message: 'Add the consent text participants will agree to.',
      });
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
      const min = field.minSelections;
      const max = field.maxSelections;
      const count = field.options?.length ?? 0;
      if (min != null && max != null && min > max) {
        issues.push({
          field: field.id,
          message: "Min selections can't be more than max selections.",
        });
      }
      if (max != null && max > count) {
        issues.push({
          field: field.id,
          message: "Max selections can't be more than the number of options.",
        });
      }
    }
    if (field.locked && field.key === 'email' && (!field.required || field.deleted)) {
      issues.push({ field: field.id, message: 'Email stays required.' });
    }
  }

  if (input.mode === 'save') {
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

  return issues;
}

export type AnswerValue = string | string[] | boolean | null | undefined;

export function validateAnswers(fields: FormField[], answers: Record<string, AnswerValue>) {
  const issues: FieldIssue[] = [];
  for (const field of fields.filter((item) => !item.deleted)) {
    const value = answers[field.id];
    const label = field.label.trim() || 'field';
    if (field.type === 'consent') {
      if (field.required && value !== true) {
        issues.push({ field: field.id, message: 'Please accept to continue.' });
      }
      continue;
    }
    if (field.type === 'multi_select') {
      const picked = Array.isArray(value) ? value.filter(Boolean) : [];
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
      const picked = typeof value === 'string' ? value.trim() : '';
      if (field.required && !picked) {
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
    if (field.type === 'phone') {
      const mobile = normalizeMobile(text);
      if (!/^[6-9]\d{9}$/.test(mobile)) {
        issues.push({ field: field.id, message: 'Enter a 10-digit mobile number.' });
      }
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
