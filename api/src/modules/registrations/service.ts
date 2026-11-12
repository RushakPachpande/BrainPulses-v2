import { stringify } from 'csv-stringify/sync';
import { Prisma, type AccessLevel, type ActivityKind, type MembershipRole } from '#prisma';
import { writeAudit } from '../../lib/audit.js';
import { invalidateDashboard } from '../../lib/cache.js';
import { sanitizeCsvCell } from '../../lib/csv.js';
import { conflict, notFound } from '../../lib/errors.js';
import { buildPage, listEnvelope, prismaCursorArgs } from '../../lib/pagination.js';
import { normalizePhone } from '../../lib/phone.js';
import { prisma } from '../../lib/prisma.js';
import { nextRegistrationId } from '../../lib/registration-id.js';
import { assertActivityAccess } from '../activities/service.js';
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

type LooseField = { id: string; key: string; type: string; deleted: boolean };

function looseFields(value: unknown): LooseField[] {
  if (!Array.isArray(value)) return [];
  const fields: LooseField[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== 'string' || typeof row.key !== 'string') continue;
    fields.push({
      id: row.id,
      key: row.key,
      type: typeof row.type === 'string' ? row.type : 'text',
      deleted: row.deleted === true,
    });
  }
  return fields;
}

function submissionAnswers(
  fields: LooseField[],
  input: { firstName: string; lastName: string; email: string; mobile: string },
): Prisma.InputJsonObject {
  const answers: Record<string, string | boolean> = {};
  for (const field of fields) {
    if (field.deleted) continue;
    if (field.key === 'first_name') answers[field.id] = input.firstName;
    else if (field.key === 'last_name') answers[field.id] = input.lastName;
    else if (field.key === 'email') answers[field.id] = input.email;
    else if (field.key === 'mobile') answers[field.id] = input.mobile;
    else if (field.type === 'consent') answers[field.id] = true;
  }
  return answers;
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

  const name = input.name.trim().replace(/\s+/g, ' ');
  const [firstName, ...rest] = name.split(' ');
  const lastName = rest.join(' ');
  const email = input.email.trim().toLowerCase();
  const phone = input.phone ? normalizePhone(input.phone) : null;
  const course = input.course?.trim() || null;
  const city = input.city?.trim() || null;

  const forms = await prisma.contestRegistrationForm.findMany({
    where: {
      organizationId,
      status: 'saved',
      quizzes: { some: { activityId: activity.id } },
    },
    select: {
      id: true,
      fields: true,
      quizzes: { select: { activityId: true } },
    },
  });

  const activityIds = new Set<string>([activity.id]);
  for (const form of forms) {
    for (const quiz of form.quizzes) activityIds.add(quiz.activityId);
  }

  const code = await nextRegistrationId();
  const person = { firstName: firstName ?? name, lastName, email, mobile: phone ?? '' };

  try {
    const created = await prisma.$transaction(async (tx) => {
      const participant = await tx.participant.create({
        data: {
          organizationId,
          code,
          name,
          firstName: person.firstName,
          lastName: lastName || null,
          email,
          phone,
          course,
          city,
        },
        select: { id: true, code: true, name: true },
      });
      const now = new Date();
      await tx.registration.createMany({
        data: [...activityIds].map((activityId) => ({
          organizationId,
          activityId,
          participantId: participant.id,
          status: 'assigned',
          assignedAt: now,
        })),
      });
      if (forms.length > 0) {
        await tx.contestFormSubmission.createMany({
          data: forms.map((form) => ({
            organizationId,
            formId: form.id,
            participantId: participant.id,
            email,
            mobile: phone,
            answers: submissionAnswers(looseFields(form.fields), person),
          })),
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
      metadata: {
        code: created.code,
        activityId: activity.id,
        formIds: forms.map((form) => form.id),
      },
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
