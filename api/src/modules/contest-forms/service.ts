import { randomBytes } from 'node:crypto';
import type { FlowStatus } from '#prisma';
import { writeAudit } from '../../lib/audit.js';
import { invalidateDashboard } from '../../lib/cache.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { nextRegistrationId } from '../../lib/registration-id.js';
import { placeOwnedImage } from '../files/place.js';
import { readInlineImage } from '../files/service.js';
import type { SaveFormInput } from './schema.js';
import {
  type AnswerValue,
  type AssignmentMode,
  type FormField,
  activitiesFor,
  cleanDomain,
  defaultFields,
  domainMessagePreview,
  emailDomain,
  findReturningParticipant,
  formActivityIds,
  normalizeFields,
  normalizeRules,
  ruleReferenceIssues,
  normalizeEmail,
  normalizeMobile,
  normalizeName,
  publicThankYou,
  quizAvailability,
  sanitizeThankYouHtml,
  slugifyContest,
  validateAnswers,
  validateForm,
} from './rules.js';

const formInclude = {
  sponsor: { select: { id: true, name: true, imageFileId: true } },
  contest: { select: { id: true, name: true, imageFileId: true } },
  quizzes: {
    include: {
      activity: {
        select: { id: true, name: true, kind: true, status: true, startsAt: true, endsAt: true },
      },
    },
  },
  _count: { select: { submissions: true } },
} as const;

type FormRow = Awaited<ReturnType<typeof loadForm>>;

async function loadForm(organizationId: string, id: string) {
  const row = await prisma.contestRegistrationForm.findFirst({
    where: { organizationId, id },
    include: formInclude,
  });
  if (!row) throw notFound('Registration form not found.');
  return row;
}

function asFields(value: unknown): FormField[] {
  return normalizeFields(value);
}

/** The assignment settings stored on a form row. */
function assignmentOf(row: {
  assignmentMode: AssignmentMode;
  rules: unknown;
  fallbackActivityIds: string[];
  quizzes: { activityId: string }[];
}) {
  const mode = row.assignmentMode;
  const rules = normalizeRules(row.rules);
  const all = row.quizzes.map((quiz) => quiz.activityId);
  return {
    mode,
    rules,
    fallbackActivityIds: row.fallbackActivityIds,
    // In "all" mode the form's activity list is the ticked list.
    defaultActivityIds: mode === 'all' ? all : [],
  };
}

function mapQuiz(
  activity: {
    id: string;
    name: string;
    kind: 'quiz' | 'assessment';
    status: FlowStatus;
    startsAt: Date | null;
    endsAt: Date | null;
  },
  now: Date,
) {
  return {
    id: activity.id,
    name: activity.name,
    kind: activity.kind,
    startsAt: activity.startsAt,
    endsAt: activity.endsAt,
    availability: quizAvailability(
      { status: activity.status, startsAt: activity.startsAt, endsAt: activity.endsAt },
      now,
    ),
  };
}

function mapForm(row: NonNullable<FormRow>, now = new Date()) {
  const quizzes = row.quizzes
    .filter((quiz) => quiz.activity.kind === 'quiz' || quiz.activity.kind === 'assessment')
    .map((quiz) => mapQuiz(quiz.activity, now));
  return {
    id: row.id,
    status: row.status,
    sponsorId: row.sponsorId,
    sponsorName: row.sponsor?.name ?? '',
    sponsorImageFileId: row.sponsor?.imageFileId ?? null,
    contestId: row.contestId,
    contestName: row.contest?.name ?? '',
    contestImageFileId: row.contest?.imageFileId ?? null,
    opensAt: row.opensAt,
    closesAt: row.closesAt,
    seats: row.seats,
    welcomeMessage: row.welcomeMessage,
    showContestImage: row.showContestImage,
    showSponsorName: row.showSponsorName,
    showRegistrationCloses: row.showRegistrationCloses,
    showSeatsLeft: row.showSeatsLeft,
    fields: asFields(row.fields),
    slug: row.slug,
    linkActive: row.linkActive,
    domainRestriction: row.domainRestriction,
    allowedDomains: row.allowedDomains,
    domainMessage: row.domainMessage,
    keepExistingId: row.keepExistingId,
    matchRule: row.matchRule,
    assignmentMode: row.assignmentMode,
    rules: normalizeRules(row.rules),
    fallbackActivityIds: row.fallbackActivityIds,
    thankYouEnabled: row.thankYouEnabled,
    thankYouKind: row.thankYouKind,
    thankYouTitle: row.thankYouTitle,
    thankYouHtml: row.thankYouHtml,
    thankYouImageFileId: row.thankYouImageFileId,
    thankYouShowNextSteps: row.thankYouShowNextSteps,
    thankYouShowQuizzes: row.thankYouShowQuizzes,
    thankYouButtonLabel: row.thankYouButtonLabel,
    thankYouButtonUrl: row.thankYouButtonUrl,
    registrationCount: row._count.submissions,
    quizzes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function assertIssues(issues: { field: string; message: string }[]) {
  if (issues.length === 0) return;
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    if (!fields[issue.field]) fields[issue.field] = issue.message;
  }
  throw badRequest(`Fix ${issues.length} fields before continuing.`, fields);
}

async function assertSponsorContest(
  organizationId: string,
  sponsorId: string | null | undefined,
  contestId: string | null | undefined,
  formId?: string,
) {
  if (!sponsorId && !contestId) return;
  if (contestId && !sponsorId) throw badRequest('Choose a sponsor first, then the contest.');
  if (sponsorId) {
    const sponsor = await prisma.sponsor.findFirst({
      where: { organizationId, id: sponsorId },
      select: { id: true },
    });
    if (!sponsor) throw badRequest('Choose the sponsor.');
  }
  if (contestId && sponsorId) {
    const contest = await prisma.contest.findFirst({
      where: { organizationId, id: contestId, sponsorId },
      select: { id: true, name: true },
    });
    if (!contest) throw badRequest('Choose the contest.');
    const taken = await prisma.contestRegistrationForm.findFirst({
      where: { contestId, ...(formId ? { NOT: { id: formId } } : {}) },
      select: { id: true },
    });
    if (taken) throw conflict('That contest already has a registration form.');
    return contest;
  }
  return null;
}

async function uniqueSlug(base: string, formId?: string) {
  let slug = base;
  let n = 2;
  for (;;) {
    const taken = await prisma.contestRegistrationForm.findFirst({
      where: {
        OR: [{ slug }, { retiredSlugs: { has: slug } }],
        ...(formId ? { NOT: { id: formId } } : {}),
      },
      select: { id: true },
    });
    if (!taken) return slug;
    slug = `${base}-${n}`;
    n += 1;
  }
}

async function replaceQuizzes(
  organizationId: string,
  formId: string,
  quizIds: string[] | undefined,
  contestId: string | null,
  now: Date,
): Promise<string[]> {
  if (!quizIds) return [];
  const existing = await prisma.contestFormQuiz.findMany({
    where: { organizationId, formId },
    select: { activityId: true },
  });
  const kept = new Set(existing.map((row) => row.activityId));
  const next = new Set(quizIds);
  if (contestId) {
    const activities = await prisma.activity.findMany({
      where: {
        organizationId,
        contestId,
        kind: { in: ['quiz', 'assessment'] },
        id: { in: quizIds },
      },
      select: { id: true, status: true, startsAt: true, endsAt: true },
    });
    if (activities.length !== new Set(quizIds).size) {
      throw badRequest('Choose activities that belong to this contest.');
    }
    for (const activity of activities) {
      const availability = quizAvailability(activity, now);
      if (availability === 'Ended' && !kept.has(activity.id)) {
        throw badRequest('Ended activities can’t be given.');
      }
    }
  } else if (quizIds.length > 0) {
    throw badRequest('Choose the contest before giving a quiz.');
  }
  const remove = [...kept].filter((id) => !next.has(id));
  if (remove.length) {
    await prisma.contestFormQuiz.deleteMany({
      where: { organizationId, formId, activityId: { in: remove } },
    });
  }
  const add = quizIds.filter((id) => !kept.has(id));
  if (add.length) {
    await prisma.contestFormQuiz.createMany({
      data: add.map((activityId) => ({ organizationId, formId, activityId })),
    });
  }
  return remove;
}

function dataFromInput(input: SaveFormInput, status: 'draft' | 'saved') {
  return {
    ...(input.sponsorId !== undefined ? { sponsorId: input.sponsorId } : {}),
    ...(input.contestId !== undefined ? { contestId: input.contestId } : {}),
    ...(input.opensAt !== undefined
      ? { opensAt: input.opensAt ? new Date(input.opensAt) : null }
      : {}),
    ...(input.closesAt !== undefined
      ? { closesAt: input.closesAt ? new Date(input.closesAt) : null }
      : {}),
    ...(input.seats !== undefined ? { seats: input.seats } : {}),
    ...(input.welcomeMessage !== undefined ? { welcomeMessage: input.welcomeMessage } : {}),
    ...(input.showContestImage !== undefined ? { showContestImage: input.showContestImage } : {}),
    ...(input.showSponsorName !== undefined ? { showSponsorName: input.showSponsorName } : {}),
    ...(input.showRegistrationCloses !== undefined
      ? { showRegistrationCloses: input.showRegistrationCloses }
      : {}),
    ...(input.showSeatsLeft !== undefined ? { showSeatsLeft: input.showSeatsLeft } : {}),
    ...(input.fields !== undefined ? { fields: input.fields } : {}),
    ...(input.linkActive !== undefined ? { linkActive: input.linkActive } : {}),
    ...(input.domainRestriction !== undefined
      ? { domainRestriction: input.domainRestriction }
      : {}),
    ...(input.allowedDomains !== undefined ? { allowedDomains: input.allowedDomains } : {}),
    ...(input.domainMessage !== undefined ? { domainMessage: input.domainMessage } : {}),
    ...(input.keepExistingId !== undefined ? { keepExistingId: input.keepExistingId } : {}),
    ...(input.matchRule !== undefined ? { matchRule: input.matchRule } : {}),
    ...(input.assignmentMode !== undefined ? { assignmentMode: input.assignmentMode } : {}),
    ...(input.rules !== undefined ? { rules: normalizeRules(input.rules) } : {}),
    ...(input.fallbackActivityIds !== undefined
      ? { fallbackActivityIds: [...new Set(input.fallbackActivityIds)] }
      : {}),
    ...(input.thankYouEnabled !== undefined ? { thankYouEnabled: input.thankYouEnabled } : {}),
    ...(input.thankYouKind !== undefined ? { thankYouKind: input.thankYouKind } : {}),
    ...(input.thankYouTitle !== undefined
      ? { thankYouTitle: blankToNull(input.thankYouTitle) }
      : {}),
    ...(input.thankYouHtml !== undefined
      ? { thankYouHtml: storedThankYouHtml(input.thankYouHtml) }
      : {}),
    ...(input.thankYouImageFileId !== undefined
      ? { thankYouImageFileId: input.thankYouImageFileId }
      : {}),
    ...(input.thankYouShowNextSteps !== undefined
      ? { thankYouShowNextSteps: input.thankYouShowNextSteps }
      : {}),
    ...(input.thankYouShowQuizzes !== undefined
      ? { thankYouShowQuizzes: input.thankYouShowQuizzes }
      : {}),
    ...(input.thankYouButtonLabel !== undefined
      ? { thankYouButtonLabel: blankToNull(input.thankYouButtonLabel) }
      : {}),
    ...(input.thankYouButtonUrl !== undefined
      ? { thankYouButtonUrl: blankToNull(input.thankYouButtonUrl) }
      : {}),
    status,
  };
}

function blankToNull(value: string | null | undefined) {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

function storedThankYouHtml(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const clean = sanitizeThankYouHtml(value);
  return clean || null;
}

export async function listOverview(organizationId: string) {
  const now = new Date();
  const [forms, submissions] = await Promise.all([
    prisma.contestRegistrationForm.findMany({
      where: { organizationId },
      include: formInclude,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.contestFormSubmission.findMany({
      where: { organizationId },
      include: {
        participant: { select: { id: true, code: true, name: true, email: true } },
        form: {
          include: {
            sponsor: { select: { name: true } },
            contest: { select: { name: true } },
            quizzes: { select: { id: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  const mapped = forms.map((row) => mapForm(row, now));
  const saved = mapped.filter((form) => form.status === 'saved');
  return {
    kpis: {
      forms: saved.length,
      liveLinks: saved.filter((form) => form.linkActive).length,
      participants: submissions.length,
      formsWithoutActivity: saved.filter((form) => form.quizzes.length === 0).length,
    },
    forms: mapped,
  };
}

export async function getForm(organizationId: string, id: string) {
  return mapForm(await loadForm(organizationId, id));
}

export async function listFormRegistrants(organizationId: string, formId: string) {
  await loadForm(organizationId, formId);
  const submissions = await prisma.contestFormSubmission.findMany({
    where: { organizationId, formId },
    include: {
      participant: { select: { id: true, code: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return submissions.map((row) => ({
    id: row.id,
    formId,
    participantId: row.participantId,
    code: row.participant.code,
    name: row.participant.name,
    email: row.participant.email,
    registeredAt: row.createdAt.toISOString(),
  }));
}

const MOBILE_RE = /^[6-9]\d{9}$/;

function answerText(
  fields: FormField[],
  answers: Record<string, AnswerValue>,
  key: string,
): string {
  const field = fields.find((item) => !item.deleted && item.key === key);
  if (!field) return '';
  const value = answers[field.id];
  return typeof value === 'string' ? value.trim() : '';
}

function storedAnswers(fields: FormField[], answers: Record<string, AnswerValue>) {
  const stored: Record<string, string | string[] | boolean> = {};
  for (const field of fields) {
    if (field.deleted) continue;
    const value = answers[field.id];
    if (typeof value === 'string' || typeof value === 'boolean' || Array.isArray(value)) {
      stored[field.id] = value;
    }
  }
  return stored;
}

function rejectAnswerIssues(issues: { field: string; message: string }[]) {
  if (issues.length === 0) return;
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    if (!fields[issue.field]) fields[issue.field] = issue.message;
  }
  throw badRequest('Check the registration form and try again.', fields);
}

export async function getFormRegistrant(
  organizationId: string,
  formId: string,
  submissionId: string,
) {
  const form = await loadForm(organizationId, formId);
  const submission = await prisma.contestFormSubmission.findFirst({
    where: { organizationId, formId, id: submissionId },
    include: {
      participant: {
        select: {
          id: true,
          code: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
    },
  });
  if (!submission) throw notFound('Registration not found.');
  const fields = asFields(form.fields);
  return {
    id: submission.id,
    formId,
    participantId: submission.participantId,
    code: submission.participant.code,
    name: submission.participant.name,
    firstName: submission.participant.firstName,
    lastName: submission.participant.lastName,
    email: submission.participant.email,
    phone: submission.participant.phone,
    registeredAt: submission.createdAt.toISOString(),
    answers: (submission.answers ?? {}) as Record<string, AnswerValue>,
    fields,
  };
}

export async function updateFormRegistrant(
  organizationId: string,
  actorUserId: string,
  formId: string,
  submissionId: string,
  answers: Record<string, AnswerValue>,
) {
  const form = await loadForm(organizationId, formId);
  const submission = await prisma.contestFormSubmission.findFirst({
    where: { organizationId, formId, id: submissionId },
    select: { id: true, participantId: true },
  });
  if (!submission) throw notFound('Registration not found.');
  const fields = asFields(form.fields);
  rejectAnswerIssues(validateAnswers(fields, answers));
  const firstName = answerText(fields, answers, 'first_name');
  const lastName = answerText(fields, answers, 'last_name');
  const email = normalizeEmail(answerText(fields, answers, 'email'));
  const phone = normalizeMobile(answerText(fields, answers, 'mobile'));
  if (!firstName || !email) {
    throw badRequest('This form needs a first name and an email.');
  }
  if (phone && !MOBILE_RE.test(phone)) {
    throw badRequest('Enter a 10-digit mobile number.');
  }
  const name = `${firstName} ${lastName}`.trim();
  const stored = storedAnswers(fields, answers);
  await prisma.$transaction(async (tx) => {
    await tx.contestFormSubmission.update({
      where: { id: submission.id },
      data: {
        email,
        mobile: MOBILE_RE.test(phone) ? phone : null,
        answers: stored,
      },
    });
    await tx.participant.update({
      where: { id: submission.participantId },
      data: {
        name,
        firstName,
        lastName: lastName || null,
        email,
        phone: MOBILE_RE.test(phone) ? phone : null,
      },
    });
  });
  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId,
    action: 'contest_form.registrant_update',
    targetType: 'contest_form_submission',
    targetId: submissionId,
    metadata: { formId, participantId: submission.participantId },
  });
  return getFormRegistrant(organizationId, formId, submissionId);
}

export async function listContestQuizzes(organizationId: string, contestId: string) {
  const now = new Date();
  const rows = await prisma.activity.findMany({
    where: { organizationId, contestId, kind: { in: ['quiz', 'assessment'] } },
    select: { id: true, name: true, kind: true, status: true, startsAt: true, endsAt: true },
    orderBy: { name: 'asc' },
  });
  return rows.map((row) => mapQuiz(row, now));
}

export async function createForm(organizationId: string, userId: string, input: SaveFormInput) {
  const domains = normalizeDomains(input.allowedDomains);
  const payload = { ...input, allowedDomains: domains ?? input.allowedDomains };
  assertIssues(validateForm(payload));
  if (input.mode === 'step1') {
    assertIssues(ruleReferenceIssues(payload.fields ?? [], input.rules ?? []));
  }
  await assertThankYouImage(organizationId, input.thankYouImageFileId);
  await assertFieldImages(organizationId, payload.fields ?? []);
  const contest = await assertSponsorContest(organizationId, input.sponsorId, input.contestId);
  const status = input.mode === 'save' ? 'saved' : 'draft';
  const slug =
    status === 'saved' && contest ? await uniqueSlug(slugifyContest(contest.name)) : null;
  const row = await prisma.contestRegistrationForm.create({
    data: {
      organizationId,
      ...dataFromInput({ ...payload, fields: input.fields ?? defaultFields() }, status),
      fields: input.fields ?? defaultFields(),
      slug,
      createdByUserId: userId,
      updatedByUserId: userId,
    },
    include: formInclude,
  });
  await replaceQuizzes(
    organizationId,
    row.id,
    activityListFromInput(input),
    row.contestId,
    new Date(),
  );
  await placeFormImages(organizationId, row.id);
  if (status === 'saved') await assignSavedForm(organizationId, row.id);
  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId: userId,
    action: status === 'saved' ? 'contest_form.save' : 'contest_form.draft',
    targetType: 'contest_form',
    targetId: row.id,
  });
  return mapForm(await loadForm(organizationId, row.id));
}

export async function updateForm(
  organizationId: string,
  userId: string,
  id: string,
  input: SaveFormInput,
) {
  const existing = await loadForm(organizationId, id);
  const sponsorId = existing.status === 'saved' ? existing.sponsorId : input.sponsorId;
  const contestId = existing.status === 'saved' ? existing.contestId : input.contestId;
  const domains = normalizeDomains(input.allowedDomains);
  const payload: SaveFormInput = {
    ...input,
    sponsorId,
    contestId,
    allowedDomains: domains ?? input.allowedDomains,
    fields: input.fields ?? asFields(existing.fields),
  };
  await assertThankYouImage(organizationId, input.thankYouImageFileId);
  assertIssues(
    validateForm({
      ...payload,
      opensAt:
        payload.opensAt === undefined ? (existing.opensAt?.toISOString() ?? null) : payload.opensAt,
      closesAt:
        payload.closesAt === undefined
          ? (existing.closesAt?.toISOString() ?? null)
          : payload.closesAt,
      seats: payload.seats === undefined ? existing.seats : payload.seats,
      domainRestriction: payload.domainRestriction ?? existing.domainRestriction,
      allowedDomains: payload.allowedDomains ?? existing.allowedDomains,
      domainMessage: payload.domainMessage ?? existing.domainMessage,
      assignmentMode: payload.assignmentMode ?? existing.assignmentMode,
      rules: payload.rules ?? normalizeRules(existing.rules),
    }),
  );
  if (input.mode !== 'draft') {
    // A field or option used by a rule can't be removed while the rule uses it.
    assertIssues(
      ruleReferenceIssues(payload.fields ?? [], payload.rules ?? normalizeRules(existing.rules)),
    );
  }
  await assertFieldImages(organizationId, payload.fields ?? []);
  const contest = await assertSponsorContest(organizationId, sponsorId, contestId, id);
  const status = input.mode === 'save' ? 'saved' : existing.status;
  let slug = existing.slug;
  if (status === 'saved' && !slug && contest) {
    slug = await uniqueSlug(slugifyContest(contest.name), id);
  }
  await prisma.contestRegistrationForm.update({
    where: { id },
    data: {
      ...dataFromInput(payload, status),
      sponsorId,
      contestId,
      slug,
      updatedByUserId: userId,
    },
  });
  const before = existing.quizzes.map((quiz) => quiz.activityId);
  const removed = await replaceQuizzes(
    organizationId,
    id,
    activityListFromInput(input, assignmentOf(existing)),
    contestId ?? null,
    new Date(),
  );
  await placeFormImages(organizationId, id);
  let kept = 0;
  if (status === 'saved') {
    kept = await assignSavedForm(organizationId, id, [...before, ...removed]);
  }
  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId: userId,
    action: 'contest_form.update',
    targetType: 'contest_form',
    targetId: id,
    metadata: { startedActivitiesKept: kept },
  });
  return mapForm(await loadForm(organizationId, id));
}

function normalizeDomains(domains: string[] | undefined) {
  if (!domains) return undefined;
  const cleaned: string[] = [];
  for (const domain of domains) {
    const next = cleanDomain(domain);
    if (!next)
      throw badRequest(`"${domain}" isn't a valid domain. Use a form like brainpulses.com.`);
    if (!cleaned.includes(next)) cleaned.push(next);
  }
  return cleaned;
}

export async function regenerateLink(organizationId: string, userId: string, id: string) {
  const existing = await loadForm(organizationId, id);
  if (existing.status !== 'saved' || !existing.slug || !existing.contest) {
    throw badRequest('Save the registration form before creating a new link.');
  }
  const base = slugifyContest(existing.contest.name);
  // New link must differ from the current slug (uniqueSlug excludes this form otherwise).
  let slug = await uniqueSlug(`${base}-${randomBytes(3).toString('hex')}`);
  let guard = 0;
  while (slug === existing.slug && guard < 5) {
    slug = await uniqueSlug(`${base}-${randomBytes(3).toString('hex')}`);
    guard += 1;
  }
  if (slug === existing.slug) {
    throw badRequest('Could not create a new registration link. Try again.');
  }
  await prisma.contestRegistrationForm.update({
    where: { id },
    data: {
      slug,
      retiredSlugs: [...existing.retiredSlugs, existing.slug],
      updatedByUserId: userId,
    },
  });
  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId: userId,
    action: 'contest_form.regenerate_link',
    targetType: 'contest_form',
    targetId: id,
  });
  return mapForm(await loadForm(organizationId, id));
}

/**
 * Gives everyone who registered the activities the form now says they should have.
 * Activities the form used to give and no longer gives them are taken back, except ones
 * the person has already started: those always stay.
 * Returns how many started activities were kept that the rules no longer give.
 */
async function assignSavedForm(
  organizationId: string,
  formId: string,
  previousActivityIds: string[] = [],
) {
  const form = await prisma.contestRegistrationForm.findFirst({
    where: { organizationId, id: formId },
    select: {
      fields: true,
      assignmentMode: true,
      rules: true,
      fallbackActivityIds: true,
      quizzes: { select: { activityId: true } },
    },
  });
  if (!form) return 0;
  const submissions = await prisma.contestFormSubmission.findMany({
    where: { organizationId, formId },
    select: { participantId: true, answers: true },
  });
  if (submissions.length === 0) return 0;
  const config = assignmentOf(form);
  const fields = asFields(form.fields);
  const removable = new Set([...previousActivityIds, ...formActivityIds(config)]);
  const participantIds = submissions.map((row) => row.participantId);
  const attempts = await prisma.attempt.findMany({
    where: {
      organizationId,
      participantId: { in: participantIds },
      activityId: { in: [...removable] },
    },
    select: { participantId: true, activityId: true },
  });
  const started = new Set(attempts.map((row) => `${row.participantId}:${row.activityId}`));
  let kept = 0;
  for (const submission of submissions) {
    const target = activitiesFor({
      ...config,
      fields,
      answers: (submission.answers ?? {}) as Record<string, AnswerValue>,
    });
    await assignQuizzes(organizationId, submission.participantId, target);
    const takeBack = [...removable].filter((activityId) => {
      if (target.includes(activityId)) return false;
      if (started.has(`${submission.participantId}:${activityId}`)) {
        kept += 1;
        return false;
      }
      return true;
    });
    if (takeBack.length > 0) {
      await prisma.registration.updateMany({
        where: {
          organizationId,
          participantId: submission.participantId,
          activityId: { in: takeBack },
          status: 'assigned',
        },
        data: { status: 'unassigned', assignedAt: null },
      });
    }
  }
  return kept;
}

/** The activity list to store for the form: the ticked list, or everything the rules can give. */
function activityListFromInput(
  input: SaveFormInput,
  existing?: ReturnType<typeof assignmentOf>,
): string[] | undefined {
  const mode = input.assignmentMode ?? existing?.mode ?? 'all';
  if (mode === 'all') {
    if (input.quizIds !== undefined) return input.quizIds;
    // Switching from rules back to the ticked list without sending one: start empty.
    if (input.assignmentMode === 'all' && existing?.mode === 'rules') return [];
    return undefined;
  }
  if (
    input.rules === undefined &&
    input.fallbackActivityIds === undefined &&
    existing?.mode === 'rules'
  ) {
    return undefined;
  }
  return formActivityIds({
    mode: 'rules',
    defaultActivityIds: [],
    rules: input.rules ?? existing?.rules ?? [],
    fallbackActivityIds: input.fallbackActivityIds ?? existing?.fallbackActivityIds ?? [],
  });
}

async function assignQuizzes(organizationId: string, participantId: string, activityIds: string[]) {
  for (const activityId of activityIds) {
    await prisma.registration.upsert({
      where: {
        organizationId_activityId_participantId: { organizationId, activityId, participantId },
      },
      create: {
        organizationId,
        activityId,
        participantId,
        status: 'assigned',
        assignedAt: new Date(),
      },
      update: { status: 'assigned' },
    });
  }
}

export async function giveQuizzes(
  organizationId: string,
  userId: string,
  id: string,
  activityIds: string[],
) {
  const existing = await loadForm(organizationId, id);
  if (existing.status !== 'saved' || !existing.contestId) {
    throw badRequest('Save the registration form before giving a quiz.');
  }
  if (existing.assignmentMode === 'rules') {
    throw badRequest(
      'This form gives activities by rules. Add the activity to a rule or the fallback in Step 2.',
    );
  }
  const before = new Set(existing.quizzes.map((quiz) => quiz.activityId));
  const added = activityIds.filter((activityId) => !before.has(activityId));
  await replaceQuizzes(organizationId, id, [...before, ...added], existing.contestId, new Date());
  const submissions = await prisma.contestFormSubmission.findMany({
    where: { organizationId, formId: id },
    select: { participantId: true },
  });
  await assignSavedForm(organizationId, id);
  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId: userId,
    action: 'contest_form.give_quiz',
    targetType: 'contest_form',
    targetId: id,
    metadata: { activityIds: added, emailed: false },
  });
  const form = mapForm(await loadForm(organizationId, id));
  return { form, added: added.length, registrationCount: submissions.length };
}

async function formBySlug(slug: string) {
  const current = await prisma.contestRegistrationForm.findFirst({
    where: { slug, status: 'saved' },
    include: formInclude,
  });
  if (current) return { form: current, retired: false };
  const retired = await prisma.contestRegistrationForm.findFirst({
    where: { retiredSlugs: { has: slug } },
    select: { id: true },
  });
  if (retired) return { form: null, retired: true };
  return { form: null, retired: false };
}

export async function publicForm(slug: string) {
  const found = await formBySlug(slug);
  if (found.retired || (found.form && !found.form.linkActive)) {
    return { state: 'inactive' as const, message: 'This link is no longer active.' };
  }
  if (!found.form) throw notFound('Registration form not found.');
  const form = mapForm(found.form);
  const now = new Date();
  let state: 'open' | 'not_yet' | 'closed' | 'full' = 'open';
  let message = '';
  if (form.opensAt && form.opensAt.getTime() > now.getTime()) {
    state = 'not_yet';
    message = `Registration opens on ${formatWhen(form.opensAt)}.`;
  } else if (form.closesAt && form.closesAt.getTime() <= now.getTime()) {
    state = 'closed';
    message = 'Registration has closed.';
  } else if (form.seats != null && form.registrationCount >= form.seats) {
    state = 'full';
    message = 'All seats are taken.';
  }
  return {
    state,
    message,
    form: {
      slug: form.slug,
      contestName: form.contestName,
      sponsorName: form.sponsorName,
      welcomeMessage: form.welcomeMessage,
      showContestImage: form.showContestImage,
      showSponsorName: form.showSponsorName,
      showRegistrationCloses: form.showRegistrationCloses,
      showSeatsLeft: form.showSeatsLeft && form.seats != null,
      contestImage: form.showContestImage && form.contestImageFileId ? true : false,
      sponsorImage: form.showSponsorName && form.sponsorImageFileId ? true : false,
      closesAt: form.closesAt,
      seats: form.seats,
      seatsLeft: form.seats == null ? null : Math.max(0, form.seats - form.registrationCount),
      fields: form.fields.filter((field) => !field.deleted),
      domainRestriction: form.domainRestriction,
      allowedDomains: form.domainRestriction ? form.allowedDomains : [],
      domainMessage: form.domainMessage,
      thankYou: publicThankYou({
        enabled: form.thankYouEnabled,
        kind: form.thankYouKind,
        title: form.thankYouTitle,
        html: form.thankYouHtml,
        hasImage: Boolean(form.thankYouImageFileId),
        showNextSteps: form.thankYouShowNextSteps,
        showQuizzes: form.thankYouShowQuizzes,
        quizzes: form.quizzes
          .filter((quiz) => quiz.kind === 'quiz' || quiz.kind === 'assessment')
          .map((quiz) => ({
            id: quiz.id,
            name: quiz.name,
            kind: quiz.kind as 'quiz' | 'assessment',
          })),
        buttonLabel: form.thankYouButtonLabel,
        buttonUrl: form.thankYouButtonUrl,
      }),
    },
  };
}

async function assertThankYouImage(organizationId: string, fileId: string | null | undefined) {
  if (!fileId) return;
  const file = await prisma.fileObject.findFirst({
    where: { organizationId, id: fileId },
    select: { id: true, mimeType: true },
  });
  if (!file || !file.mimeType.startsWith('image/')) {
    throw badRequest('Choose an image for the thank-you message.', {
      thankYouImageFileId: 'Choose an image for the thank-you message.',
    });
  }
}

/** Moves the thank-you image and any image blocks into the form's folder. */
async function placeFormImages(organizationId: string, formId: string) {
  const row = await prisma.contestRegistrationForm.findFirst({
    where: { organizationId, id: formId },
    select: { thankYouImageFileId: true, fields: true, contest: { select: { name: true } } },
  });
  if (!row) return;
  const fileIds = [
    row.thankYouImageFileId,
    ...asFields(row.fields).map((field) => (field.type === 'image' ? field.imageFileId : null)),
  ].filter((id): id is string => Boolean(id));
  for (const fileId of new Set(fileIds)) {
    await placeOwnedImage(organizationId, fileId, {
      kind: 'contest-form',
      contestName: row.contest?.name || 'form',
      formId,
    });
  }
}

async function assertFieldImages(organizationId: string, fields: FormField[]) {
  const ids = fields
    .filter((field) => field.type === 'image' && field.imageFileId && !field.deleted)
    .map((field) => field.imageFileId as string);
  if (ids.length === 0) return;
  const files = await prisma.fileObject.findMany({
    where: { organizationId, id: { in: ids } },
    select: { id: true, mimeType: true },
  });
  const ok = new Set(files.filter((file) => file.mimeType.startsWith('image/')).map((f) => f.id));
  const bad = fields.find(
    (field) => field.type === 'image' && field.imageFileId && !ok.has(field.imageFileId),
  );
  if (bad) {
    throw badRequest('Choose an image for the image block.', {
      [bad.id]: 'Choose an image for the image block.',
    });
  }
}

/** An image block on a live form. */
export async function publicFieldImage(slug: string, fieldId: string) {
  const found = await formBySlug(slug);
  if (!found.form || found.retired || !found.form.linkActive) throw notFound('Image not found.');
  const field = asFields(found.form.fields).find(
    (item) => item.id === fieldId && item.type === 'image' && !item.deleted,
  );
  if (!field?.imageFileId) throw notFound('Image not found.');
  return readInlineImage(found.form.organizationId, field.imageFileId);
}

export async function publicImage(slug: string, which: 'contest' | 'sponsor' | 'thank-you') {
  const found = await formBySlug(slug);
  if (!found.form || found.retired || !found.form.linkActive) throw notFound('Image not found.');
  let fileId: string | null | undefined;
  if (which === 'contest') fileId = found.form.contest?.imageFileId;
  else if (which === 'sponsor') fileId = found.form.sponsor?.imageFileId;
  else if (found.form.thankYouEnabled && found.form.thankYouKind === 'image') {
    fileId = found.form.thankYouImageFileId;
  }
  if (!fileId) throw notFound('Image not found.');
  return readInlineImage(found.form.organizationId, fileId);
}

function formatWhen(date: Date) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export async function register(slug: string, answers: Record<string, AnswerValue>) {
  const found = await formBySlug(slug);
  if (found.retired || (found.form && !found.form.linkActive)) {
    throw badRequest('This link is no longer active.');
  }
  if (!found.form) throw notFound('Registration form not found.');
  const row = found.form;
  const now = new Date();
  if (row.opensAt && row.opensAt.getTime() > now.getTime()) {
    throw badRequest(`Registration opens on ${formatWhen(row.opensAt)}.`);
  }
  if (row.closesAt && row.closesAt.getTime() <= now.getTime()) {
    throw badRequest('Registration has closed.');
  }
  if (row.seats != null && row._count.submissions >= row.seats) {
    throw badRequest('All seats are taken.');
  }
  const fields = asFields(row.fields);
  const issues = validateAnswers(fields, answers);
  assertIssues(issues);
  const emailField = fields.find((field) => field.key === 'email' && !field.deleted);
  const mobileField = fields.find((field) => field.key === 'mobile' && !field.deleted);
  const firstField = fields.find((field) => field.key === 'first_name' && !field.deleted);
  const lastField = fields.find((field) => field.key === 'last_name' && !field.deleted);
  const email = normalizeEmail(String(answers[emailField?.id ?? ''] ?? ''));
  const mobile = normalizeMobile(String(answers[mobileField?.id ?? ''] ?? ''));
  const firstName = String(answers[firstField?.id ?? ''] ?? '').trim();
  const lastName = String(answers[lastField?.id ?? ''] ?? '').trim();
  if (row.domainRestriction) {
    const domain = emailDomain(email);
    if (!row.allowedDomains.includes(domain)) {
      throw badRequest(domainMessagePreview(row.domainMessage, row.allowedDomains));
    }
  }
  const participants = await prisma.participant.findMany({
    where: { organizationId: row.organizationId },
    select: {
      id: true,
      code: true,
      name: true,
      firstName: true,
      email: true,
      phone: true,
      createdAt: true,
    },
  });
  const match = findReturningParticipant(
    participants.map((person) => ({
      id: person.id,
      firstName: person.firstName?.trim() || person.name.split(' ')[0] || '',
      email: person.email,
      mobile: person.phone ?? '',
      createdAt: person.createdAt.getTime(),
    })),
    { firstName, email, mobile },
    row.matchRule,
    row.keepExistingId,
  );
  const activityIds = activitiesFor({ ...assignmentOf(row), fields, answers });
  const personActivities = row.quizzes
    .filter((quiz) => activityIds.includes(quiz.activityId))
    .map((quiz) => ({ id: quiz.activity.id, name: quiz.activity.name, kind: quiz.activity.kind }));
  if (match) {
    const person = participants.find((item) => item.id === match.id)!;
    const already = await prisma.contestFormSubmission.findFirst({
      where: { formId: row.id, participantId: person.id },
      select: { id: true },
    });
    if (already) {
      return {
        outcome: 'already_on_form' as const,
        code: person.code,
        message: "You're already registered. Log in with your Registration ID.",
        activities: [],
      };
    }
    await prisma.contestFormSubmission.create({
      data: {
        organizationId: row.organizationId,
        formId: row.id,
        participantId: person.id,
        email,
        mobile: mobile || null,
        answers,
      },
    });
    await assignQuizzes(row.organizationId, person.id, activityIds);
    return {
      outcome: 'existing_id' as const,
      code: person.code,
      message: `You're already registered with BrainPulses. Use your existing Registration ID ${person.code} to log in.`,
      activities: personActivities,
    };
  }
  const sameForm = participants.find(
    (person) =>
      normalizeEmail(person.email) === email &&
      normalizeName(person.firstName?.trim() || person.name.split(' ')[0] || '') ===
        normalizeName(firstName),
  );
  if (sameForm) {
    const already = await prisma.contestFormSubmission.findFirst({
      where: { formId: row.id, participantId: sameForm.id },
    });
    if (already) {
      return {
        outcome: 'already_on_form' as const,
        code: sameForm.code,
        message: "You're already registered. Log in with your Registration ID.",
        activities: [],
      };
    }
  }
  const code = await nextRegistrationId();
  const created = await prisma.participant.create({
    data: {
      organizationId: row.organizationId,
      code,
      name: `${firstName} ${lastName}`.trim(),
      firstName,
      lastName,
      email,
      phone: mobile || null,
    },
  });
  await prisma.contestFormSubmission.create({
    data: {
      organizationId: row.organizationId,
      formId: row.id,
      participantId: created.id,
      email,
      mobile: mobile || null,
      answers,
    },
  });
  await assignQuizzes(row.organizationId, created.id, activityIds);
  return {
    outcome: 'created' as const,
    code,
    message: 'Use it to log in. Your quizzes appear after you log in.',
    activities: personActivities,
  };
}

type FormWipeTx = {
  contestFormSubmission: {
    findMany(args: {
      where: { organizationId: string; formId: string };
      select: { participantId: true };
    }): Promise<Array<{ participantId: string }>>;
  };
  participant: {
    deleteMany(args: { where: { organizationId: string; id: { in: string[] } } }): Promise<unknown>;
  };
  contestRegistrationForm: {
    deleteMany(args: { where: { organizationId: string; id: string } }): Promise<unknown>;
  };
};

/** Deletes everyone who submitted this form, then the form. Quizzes and assessments stay. */
export async function wipeRegistrationForm(tx: FormWipeTx, organizationId: string, formId: string) {
  const submissions = await tx.contestFormSubmission.findMany({
    where: { organizationId, formId },
    select: { participantId: true },
  });
  const participantIds = [...new Set(submissions.map((row) => row.participantId))];
  if (participantIds.length > 0) {
    await tx.participant.deleteMany({
      where: { organizationId, id: { in: participantIds } },
    });
  }
  await tx.contestRegistrationForm.deleteMany({ where: { organizationId, id: formId } });
  return participantIds.length;
}

export async function deleteForm(organizationId: string, actorUserId: string, id: string) {
  const existing = await prisma.contestRegistrationForm.findFirst({
    where: { organizationId, id },
    select: { id: true, contest: { select: { name: true } } },
  });
  if (!existing) throw notFound('Registration form not found.');

  const participantsRemoved = await prisma.$transaction((tx) =>
    wipeRegistrationForm(tx, organizationId, id),
  );

  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId,
    action: 'contest_form.delete',
    targetType: 'contest_form',
    targetId: id,
    metadata: {
      contestName: existing.contest?.name ?? null,
      participantsRemoved,
    },
  });
  await invalidateDashboard(organizationId);
  return { deleted: true as const, participantsRemoved };
}
