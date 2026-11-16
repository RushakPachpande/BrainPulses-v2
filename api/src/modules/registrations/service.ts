import { stringify } from 'csv-stringify/sync';
import { Prisma, type AccessLevel, type ActivityKind, type MembershipRole } from '#prisma';
import { writeAudit } from '../../lib/audit.js';
import { invalidateDashboard } from '../../lib/cache.js';
import { sanitizeCsvCell } from '../../lib/csv.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { buildPage, listEnvelope, prismaCursorArgs } from '../../lib/pagination.js';
import { prisma } from '../../lib/prisma.js';
import { nextRegistrationId } from '../../lib/registration-id.js';
import { assertActivityAccess } from '../activities/service.js';
import {
  normalizeEmail,
  normalizeMobile,
  validateAnswers,
  type AnswerValue,
  type FormField,
} from '../contest-forms/rules.js';
import type { z } from 'zod';
import type { manualRegistrationSchema, registrationListQuerySchema } from './schema.js';

export type RegistrationActor = {
  userId: string;
  role: MembershipRole;
  assessmentAccess: AccessLevel;
  quizAccess: AccessLevel;
};

function viewableKinds(actor: RegistrationActor): ActivityKind[] {
  if (actor.role === 'super_admin') return ['assessment', 'quiz'];
  const kinds: ActivityKind[] = [];
  if (actor.assessmentAccess !== 'none') kinds.push('assessment');
  if (actor.quizAccess !== 'none') kinds.push('quiz');
  return kinds;
}

function mapRegistration(r: {
  id: string;
  status: string;
  assignedAt: Date | null;
  createdAt: Date;
  participant: {
    id: string;
    code: string;
    name: string;
    email: string;
    phone: string | null;
    city: string | null;
    course: string | null;
  };
  activity: { id: string; name: string; kind: string; code: string };
  participantAttempts?: { id: string; status: string; resultId: string | null }[];
}) {
  const statuses = r.participantAttempts ?? [];
  const primary =
    statuses.find((a) => a.status === 'in_progress') ??
    statuses.find((a) => a.status === 'submitted' || a.status === 'auto_submitted') ??
    statuses[0] ??
    null;
  const attemptStatus = primary?.status ?? 'not_started';
  return {
    id: r.id,
    participantId: r.participant.id,
    code: r.participant.code,
    name: r.participant.name,
    email: r.participant.email,
    phone: r.participant.phone,
    city: r.participant.city,
    course: r.participant.course,
    activityId: r.activity.id,
    activity: r.activity.name,
    activityKind: r.activity.kind,
    assignment: r.status === 'assigned' ? 'Assigned' : 'Unassigned',
    statusKey: r.status,
    attempt: attemptStatus,
    attemptId: primary?.id ?? null,
    resultId: primary?.resultId ?? null,
    registered: r.createdAt,
    assignedAt: r.assignedAt,
  };
}

export async function listRegistrations(
  organizationId: string,
  actor: RegistrationActor,
  query: z.infer<typeof registrationListQuerySchema>,
) {
  const kinds = viewableKinds(actor);
  const allowedKinds =
    query.kind && kinds.includes(query.kind) ? [query.kind] : query.kind ? [] : kinds;

  const where: Prisma.RegistrationWhereInput = {
    organizationId,
    ...(query.activityId ? { activityId: query.activityId } : {}),
    activity:
      allowedKinds.length > 0
        ? { kind: { in: allowedKinds } }
        : { id: '00000000-0000-0000-0000-000000000000' },
    ...(query.status !== 'all' ? { status: query.status } : {}),
    ...(query.q
      ? {
          OR: [
            { participant: { name: { contains: query.q, mode: 'insensitive' } } },
            { participant: { email: { contains: query.q, mode: 'insensitive' } } },
            { participant: { code: { contains: query.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.registration.count({ where }),
    prisma.registration.findMany({
      where,
      include: {
        participant: true,
        activity: true,
      },
      ...prismaCursorArgs(query),
    }),
  ]);

  const attemptMap = new Map<string, { id: string; status: string; resultId: string | null }[]>();
  if (rows.length > 0) {
    const attempts = await prisma.attempt.findMany({
      where: {
        organizationId,
        OR: rows.map((r) => ({ activityId: r.activityId, participantId: r.participantId })),
      },
      select: {
        id: true,
        activityId: true,
        participantId: true,
        status: true,
        result: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    for (const a of attempts) {
      const key = `${a.activityId}:${a.participantId}`;
      if (!attemptMap.has(key)) attemptMap.set(key, []);
      attemptMap.get(key)!.push({
        id: a.id,
        status: a.status,
        resultId: a.result?.id ?? null,
      });
    }
  }

  const mapped = rows.map((r) =>
    mapRegistration({
      ...r,
      participantAttempts: attemptMap.get(`${r.activityId}:${r.participantId}`),
    }),
  );
  const { items, page } = buildPage(mapped, query.limit, total);
  return listEnvelope(items, page);
}

export async function assign(
  organizationId: string,
  actor: RegistrationActor,
  activityId: string,
  participantIds: string[],
  idempotencyKey?: string,
) {
  const activity = await prisma.activity.findFirst({ where: { organizationId, id: activityId } });
  if (!activity) throw notFound('Activity not found.');
  assertActivityAccess(actor.role, actor.assessmentAccess, actor.quizAccess, activity.kind, 'edit');

  if (idempotencyKey) {
    const prior = await prisma.auditEvent.findFirst({
      where: {
        organizationId,
        action: 'registration.assign',
        targetId: activityId,
        metadata: { path: ['idempotencyKey'], equals: idempotencyKey },
      },
    });
    if (prior?.metadata && typeof prior.metadata === 'object') {
      const meta = prior.metadata as { result?: unknown };
      if (meta.result) return meta.result;
    }
  }

  const results = [];
  for (const participantId of participantIds) {
    const participant = await prisma.participant.findFirst({
      where: { organizationId, id: participantId },
    });
    if (!participant) continue;

    const row = await prisma.registration.upsert({
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
      include: { participant: true, activity: true },
    });
    results.push(mapRegistration(row));
  }

  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId: actor.userId,
    action: 'registration.assign',
    targetType: 'activity',
    targetId: activityId,
    metadata: { idempotencyKey, participantIds, result: results },
  });

  return results;
}

const MOBILE_RE = /^[6-9]\d{9}$/;

function formFields(value: unknown): FormField[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is FormField => {
    if (!item || typeof item !== 'object') return false;
    const row = item as Partial<FormField>;
    return typeof row.id === 'string' && typeof row.key === 'string';
  });
}

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

function storedAnswers(
  fields: FormField[],
  answers: Record<string, AnswerValue>,
): Prisma.InputJsonObject {
  const stored: Record<string, string | string[] | boolean> = {};
  for (const field of fields) {
    if (field.deleted) continue;
    const value = answers[field.id];
    if (typeof value === 'string' || typeof value === 'boolean' || Array.isArray(value)) {
      stored[field.id] = value;
    }
  }
  return stored as Prisma.InputJsonObject;
}

function rejectAnswerIssues(issues: { field: string; message: string }[]) {
  if (issues.length === 0) return;
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    if (!fields[issue.field]) fields[issue.field] = issue.message;
  }
  throw badRequest('Check the registration form and try again.', fields);
}

export async function createManual(
  organizationId: string,
  actor: RegistrationActor,
  input: z.infer<typeof manualRegistrationSchema>,
) {
  const activity = await prisma.activity.findFirst({
    where: { organizationId, id: input.activityId },
    select: { id: true, kind: true, name: true },
  });
  if (!activity) throw notFound('Activity not found.');
  assertActivityAccess(actor.role, actor.assessmentAccess, actor.quizAccess, activity.kind, 'edit');

  const activityIds = new Set<string>([activity.id]);
  let formId: string | null = null;
  let answers: Prisma.InputJsonObject | null = null;
  let firstName: string;
  let lastName: string;
  let email: string;
  let phone: string;

  if ('formId' in input) {
    const form = await prisma.contestRegistrationForm.findFirst({
      where: { organizationId, id: input.formId, status: 'saved' },
      select: { id: true, fields: true, quizzes: { select: { activityId: true } } },
    });
    if (!form) throw notFound('Registration form not found.');
    if (!form.quizzes.some((quiz) => quiz.activityId === activity.id)) {
      throw badRequest('That registration form is not for this activity.');
    }
    const fields = formFields(form.fields);
    rejectAnswerIssues(validateAnswers(fields, input.answers));
    firstName = answerText(fields, input.answers, 'first_name');
    lastName = answerText(fields, input.answers, 'last_name');
    email = normalizeEmail(answerText(fields, input.answers, 'email'));
    phone = normalizeMobile(answerText(fields, input.answers, 'mobile'));
    if (!firstName || !email) {
      throw badRequest('This form needs a first name and an email.');
    }
    if (phone && !MOBILE_RE.test(phone)) {
      throw badRequest('Enter a 10-digit mobile number.');
    }
    for (const quiz of form.quizzes) activityIds.add(quiz.activityId);
    formId = form.id;
    answers = storedAnswers(fields, input.answers);
  } else {
    firstName = input.firstName.trim().replace(/\s+/g, ' ');
    lastName = input.lastName.trim().replace(/\s+/g, ' ');
    email = normalizeEmail(input.email);
    phone = normalizeMobile(input.phone);
    if (!MOBILE_RE.test(phone)) {
      throw badRequest('Enter a 10-digit mobile number.', {
        phone: 'Enter a 10-digit mobile number.',
      });
    }
  }

  const linked = await prisma.activity.findMany({
    where: { organizationId, id: { in: [...activityIds] } },
    select: { id: true, kind: true },
  });
  const linkedIds = new Set(linked.map((item) => item.id));
  for (const item of linked) {
    if (item.id === activity.id) continue;
    assertActivityAccess(actor.role, actor.assessmentAccess, actor.quizAccess, item.kind, 'edit');
  }

  const name = `${firstName} ${lastName}`.trim();
  const code = await nextRegistrationId();

  try {
    const created = await prisma.$transaction(async (tx) => {
      const participant = await tx.participant.create({
        data: {
          organizationId,
          code,
          name,
          firstName,
          lastName: lastName || null,
          email,
          phone: MOBILE_RE.test(phone) ? phone : null,
        },
        select: { id: true, code: true, name: true },
      });
      const now = new Date();
      await tx.registration.createMany({
        data: [...linkedIds].map((activityId) => ({
          organizationId,
          activityId,
          participantId: participant.id,
          status: 'assigned',
          assignedAt: now,
        })),
      });
      if (formId && answers) {
        await tx.contestFormSubmission.create({
          data: {
            organizationId,
            formId,
            participantId: participant.id,
            email,
            mobile: MOBILE_RE.test(phone) ? phone : null,
            answers,
          },
        });
      }
      return participant;
    });

    await writeAudit({
      organizationId,
      actorType: 'user',
      actorUserId: actor.userId,
      action: 'registration.manual',
      targetType: 'participant',
      targetId: created.id,
      metadata: { code: created.code, activityId: activity.id, formId },
    });
    await invalidateDashboard(organizationId);
    return {
      participantId: created.id,
      code: created.code,
      name: created.name,
      activity: activity.name,
    };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw conflict('A participant with that Registration ID already exists.');
    }
    throw err;
  }
}

export async function unassign(
  organizationId: string,
  actor: RegistrationActor,
  activityId: string,
  participantIds: string[],
) {
  const activity = await prisma.activity.findFirst({ where: { organizationId, id: activityId } });
  if (!activity) throw notFound('Activity not found.');
  assertActivityAccess(actor.role, actor.assessmentAccess, actor.quizAccess, activity.kind, 'edit');

  await prisma.registration.updateMany({
    where: { organizationId, activityId, participantId: { in: participantIds } },
    data: { status: 'unassigned', assignedAt: null },
  });

  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId: actor.userId,
    action: 'registration.unassign',
    targetType: 'activity',
    targetId: activityId,
    metadata: { participantIds },
  });

  return { ok: true, count: participantIds.length };
}

export async function exportCsv(
  organizationId: string,
  actor: RegistrationActor,
  activityId: string,
) {
  const activity = await prisma.activity.findFirst({ where: { organizationId, id: activityId } });
  if (!activity) throw notFound('Activity not found.');
  assertActivityAccess(actor.role, actor.assessmentAccess, actor.quizAccess, activity.kind, 'view');

  const rows = await prisma.registration.findMany({
    where: { organizationId, activityId },
    include: { participant: true, activity: true },
    orderBy: { createdAt: 'asc' },
  });

  const csv = stringify(
    rows.map((r) => ({
      code: sanitizeCsvCell(r.participant.code),
      name: sanitizeCsvCell(r.participant.name),
      email: sanitizeCsvCell(r.participant.email),
      phone: sanitizeCsvCell(r.participant.phone ?? ''),
      status: r.status,
      activity: sanitizeCsvCell(r.activity.name),
    })),
    { header: true },
  );

  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId: actor.userId,
    action: 'registration.export',
    targetType: 'activity',
    targetId: activityId,
  });

  return csv;
}
