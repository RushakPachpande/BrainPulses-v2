import { randomInt } from 'node:crypto';
import type { FlowStatus } from '#prisma';
import { writeAudit } from '../../lib/audit.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { readInlineImage } from '../files/service.js';
import type { SaveFormInput } from './schema.js';
import {
  type AnswerValue,
  type FormField,
  cleanDomain,
  defaultFields,
  domainMessagePreview,
  emailDomain,
  findReturningParticipant,
  normalizeEmail,
  normalizeMobile,
  normalizeName,
  quizAvailability,
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
  return Array.isArray(value) ? (value as FormField[]) : [];
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
) {
  if (!quizIds) return;
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
    status,
  };
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
      formsWithoutQuiz: saved.filter((form) => form.quizzes.length === 0).length,
    },
    forms: mapped,
    people: submissions.map((row) => ({
      id: row.id,
      code: row.participant.code,
      name: row.participant.name,
      email: row.participant.email,
      sponsorName: row.form.sponsor?.name ?? '',
      contestName: row.form.contest?.name ?? '',
      quizzesGiven: row.form.quizzes.length,
      registeredAt: row.createdAt,
    })),
  };
}

export async function getForm(organizationId: string, id: string) {
  return mapForm(await loadForm(organizationId, id));
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
  await replaceQuizzes(organizationId, row.id, input.quizIds, row.contestId, new Date());
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
    }),
  );
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
  await replaceQuizzes(organizationId, id, input.quizIds, contestId ?? null, new Date());
  if (status === 'saved') await assignSavedForm(organizationId, id);
  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId: userId,
    action: 'contest_form.update',
    targetType: 'contest_form',
    targetId: id,
  });
  return mapForm(await loadForm(organizationId, id));
}

function normalizeDomains(domains: string[] | undefined) {
  if (!domains) return undefined;
  const cleaned: string[] = [];
  for (const domain of domains) {
    const next = cleanDomain(domain);
    if (!next) throw badRequest(`"${domain}" isn't a valid domain. Use a form like infosys.com.`);
    if (!cleaned.includes(next)) cleaned.push(next);
  }
  return cleaned;
}

export async function regenerateLink(organizationId: string, userId: string, id: string) {
  const existing = await loadForm(organizationId, id);
  if (existing.status !== 'saved' || !existing.slug || !existing.contest) {
    throw badRequest('Save the registration form before creating a new link.');
  }
  const slug = await uniqueSlug(slugifyContest(existing.contest.name), id);
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

async function assignSavedForm(organizationId: string, formId: string) {
  const [links, submissions] = await Promise.all([
    prisma.contestFormQuiz.findMany({
      where: { organizationId, formId },
      select: { activityId: true },
    }),
    prisma.contestFormSubmission.findMany({
      where: { organizationId, formId },
      select: { participantId: true },
    }),
  ]);
  const activityIds = links.map((link) => link.activityId);
  for (const submission of submissions) {
    await assignQuizzes(organizationId, submission.participantId, activityIds);
  }
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
      update: { status: 'assigned', assignedAt: new Date() },
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
      seatsLeft: form.seats == null ? null : Math.max(0, form.seats - form.registrationCount),
      fields: form.fields.filter((field) => !field.deleted),
      domainRestriction: form.domainRestriction,
      allowedDomains: form.domainRestriction ? form.allowedDomains : [],
      domainMessage: form.domainMessage,
    },
  };
}

export async function publicImage(slug: string, which: 'contest' | 'sponsor') {
  const found = await formBySlug(slug);
  if (!found.form || found.retired || !found.form.linkActive) throw notFound('Image not found.');
  const fileId =
    which === 'contest' ? found.form.contest?.imageFileId : found.form.sponsor?.imageFileId;
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

async function nextRegistrationId() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = `BP${String(randomInt(0, 100_000_000)).padStart(8, '0')}`;
    const taken = await prisma.participant.findFirst({ where: { code }, select: { id: true } });
    if (!taken) return code;
  }
  throw conflict('Could not create a Registration ID. Try again.');
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
  const activityIds = row.quizzes.map((quiz) => quiz.activityId);
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
  };
}
