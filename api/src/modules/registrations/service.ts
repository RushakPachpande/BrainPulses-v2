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
  student: {
    id: string;
    code: string;
    name: string;
    email: string;
    phone: string | null;
    city: string | null;
    course: string | null;
  };
  activity: { id: string; name: string; kind: string; code: string };
  studentAttempts?: { status: string }[];
}) {
  const attempt = r.studentAttempts?.[0];
  return {
    id: r.id,
    studentId: r.student.id,
    code: r.student.code,
    name: r.student.name,
    email: r.student.email,
    phone: r.student.phone,
    city: r.student.city,
    course: r.student.course,
    activityId: r.activity.id,
    activity: r.activity.name,
    activityKind: r.activity.kind,
    assignment: r.status === 'assigned' ? 'Assigned' : 'Unassigned',
    statusKey: r.status,
    attempt: attempt?.status ?? 'Not started',
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
            { student: { name: { contains: query.q, mode: 'insensitive' } } },
            { student: { email: { contains: query.q, mode: 'insensitive' } } },
            { student: { code: { contains: query.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.registration.count({ where }),
    prisma.registration.findMany({
      where,
      include: {
        student: true,
        activity: true,
      },
      ...prismaCursorArgs(query),
    }),
  ]);

  const attemptMap = new Map<string, { status: string }[]>();
  if (rows.length > 0) {
    const attempts = await prisma.attempt.findMany({
      where: {
        organizationId,
        OR: rows.map((r) => ({ activityId: r.activityId, studentId: r.studentId })),
      },
      select: { activityId: true, studentId: true, status: true },
      orderBy: { createdAt: 'desc' },
    });
    for (const a of attempts) {
      const key = `${a.activityId}:${a.studentId}`;
      if (!attemptMap.has(key)) attemptMap.set(key, []);
      attemptMap.get(key)!.push({ status: a.status });
    }
  }

  const mapped = rows.map((r) =>
    mapRegistration({
      ...r,
      studentAttempts: attemptMap.get(`${r.activityId}:${r.studentId}`),
    }),
  );
  const { items, page } = buildPage(mapped, query.limit, total);
  return listEnvelope(items, page);
}

export async function assign(
  organizationId: string,
  actor: RegistrationActor,
  activityId: string,
  studentIds: string[],
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
  for (const studentId of studentIds) {
    const student = await prisma.student.findFirst({ where: { organizationId, id: studentId } });
    if (!student) continue;

    const row = await prisma.registration.upsert({
      where: {
        organizationId_activityId_studentId: { organizationId, activityId, studentId },
      },
      create: {
        organizationId,
        activityId,
        studentId,
        status: 'assigned',
        assignedAt: new Date(),
      },
      update: { status: 'assigned', assignedAt: new Date() },
      include: { student: true, activity: true },
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
    metadata: { idempotencyKey, studentIds, result: results },
  });

  return results;
}

export async function unassign(
  organizationId: string,
  actor: RegistrationActor,
  activityId: string,
  studentIds: string[],
) {
  const activity = await prisma.activity.findFirst({ where: { organizationId, id: activityId } });
  if (!activity) throw notFound('Activity not found.');
  assertActivityAccess(actor.role, actor.assessmentAccess, actor.quizAccess, activity.kind, 'edit');

  await prisma.registration.updateMany({
    where: { organizationId, activityId, studentId: { in: studentIds } },
    data: { status: 'unassigned', assignedAt: null },
  });

  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId: actor.userId,
    action: 'registration.unassign',
    targetType: 'activity',
    targetId: activityId,
    metadata: { studentIds },
  });

  return { ok: true, count: studentIds.length };
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
    include: { student: true, activity: true },
    orderBy: { createdAt: 'asc' },
  });

  const csv = stringify(
    rows.map((r) => ({
      code: sanitizeCsvCell(r.student.code),
      name: sanitizeCsvCell(r.student.name),
      email: sanitizeCsvCell(r.student.email),
      phone: sanitizeCsvCell(r.student.phone ?? ''),
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
