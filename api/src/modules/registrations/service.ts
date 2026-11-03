import { stringify } from 'csv-stringify/sync';
import { Prisma, type AccessLevel, type ActivityKind, type MembershipRole } from '#prisma';
import { writeAudit } from '../../lib/audit.js';
import { sanitizeCsvCell } from '../../lib/csv.js';
import { notFound } from '../../lib/errors.js';
import { buildPage, listEnvelope, prismaCursorArgs } from '../../lib/pagination.js';
import { prisma } from '../../lib/prisma.js';
import { assertActivityAccess } from '../activities/service.js';
import type { z } from 'zod';
import type { registrationListQuerySchema } from './schema.js';

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
