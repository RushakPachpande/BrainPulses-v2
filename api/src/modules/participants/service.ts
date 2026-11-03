import { Prisma } from '#prisma';
import { writeAudit } from '../../lib/audit.js';
import { invalidateDashboard } from '../../lib/cache.js';
import { nextHumanCode } from '../../lib/codes.js';
import { AppError, conflict, notFound } from '../../lib/errors.js';
import { buildPage, listEnvelope, prismaCursorArgs } from '../../lib/pagination.js';
import { normalizePhone } from '../../lib/phone.js';
import { prisma } from '../../lib/prisma.js';
import type { z } from 'zod';
import {
  buildParticipantSampleWorkbook,
  parseParticipantsFile,
  participantRowIssue,
  type ParticipantImportIssue,
} from './import-export.js';
import type {
  createParticipantSchema,
  participantListQuerySchema,
  updateParticipantSchema,
} from './schema.js';

function mapParticipant(s: {
  id: string;
  code: string;
  name: string;
  email: string;
  phone: string | null;
  course: string | null;
  city: string | null;
  cohort?: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  _count?: { registrations: number };
}) {
  return {
    id: s.id,
    code: s.code,
    name: s.name,
    email: s.email,
    phone: s.phone,
    course: s.course,
    city: s.city,
    cohort: s.cohort ?? null,
    status: s.isActive ? 'Active' : 'Inactive',
    isActive: s.isActive,
    lastLoginAt: s.lastLoginAt,
    registered: s.createdAt,
    activities: s._count?.registrations ?? 0,
  };
}

export async function listParticipants(
  organizationId: string,
  query: z.infer<typeof participantListQuerySchema>,
) {
  const where: Prisma.ParticipantWhereInput = {
    organizationId,
    ...(query.status === 'active' ? { isActive: true } : {}),
    ...(query.status === 'inactive' ? { isActive: false } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { email: { contains: query.q, mode: 'insensitive' } },
            { code: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const sort =
    query.sort === 'name' ? 'name' : query.sort === 'code' ? 'code' : ('createdAt' as const);
  const [total, rows] = await Promise.all([
    prisma.participant.count({ where }),
    prisma.participant.findMany({
      where,
      include: { _count: { select: { registrations: true } } },
      ...prismaCursorArgs(query, sort),
    }),
  ]);

  const { items, page } = buildPage(rows, query.limit, total);
  return listEnvelope(items.map(mapParticipant), page);
}

export async function getParticipant(organizationId: string, id: string) {
  const participant = await prisma.participant.findFirst({
    where: { organizationId, id },
    include: { _count: { select: { registrations: true } } },
  });
  if (!participant) throw notFound('Participant not found.');
  return mapParticipant(participant);
}

export async function createParticipant(
  organizationId: string,
  actorUserId: string,
  input: z.infer<typeof createParticipantSchema>,
) {
  const code = input.code ?? (await nextHumanCode(organizationId, 'BP', 'participant'));
  try {
    const participant = await prisma.participant.create({
      data: {
        organizationId,
        code,
        name: input.name,
        email: input.email.toLowerCase(),
        phone: input.phone ? normalizePhone(input.phone) : input.phone,
        course: input.course,
        city: input.city,
        cohort: input.cohort,
      },
      include: { _count: { select: { registrations: true } } },
    });
    await writeAudit({
      organizationId,
      actorType: 'user',
      actorUserId,
      action: 'participant.create',
      targetType: 'participant',
      targetId: participant.id,
    });
    await invalidateDashboard(organizationId);
    return mapParticipant(participant);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw conflict('A participant with that email, code, or phone already exists.');
    }
    throw err;
  }
}

export async function updateParticipant(
  organizationId: string,
  actorUserId: string,
  id: string,
  input: z.infer<typeof updateParticipantSchema>,
) {
  const existing = await prisma.participant.findFirst({ where: { organizationId, id } });
  if (!existing) throw notFound('Participant not found.');

  try {
    const participant = await prisma.participant.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email !== undefined ? { email: input.email.toLowerCase() } : {}),
        ...(input.phone !== undefined
          ? { phone: input.phone ? normalizePhone(input.phone) : input.phone }
          : {}),
        ...(input.course !== undefined ? { course: input.course } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.cohort !== undefined ? { cohort: input.cohort } : {}),
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      include: { _count: { select: { registrations: true } } },
    });

    await writeAudit({
      organizationId,
      actorType: 'user',
      actorUserId,
      action: 'participant.update',
      targetType: 'participant',
      targetId: id,
    });
    await invalidateDashboard(organizationId);
    return mapParticipant(participant);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw conflict('A participant with that email, code, or phone already exists.');
    }
    throw err;
  }
}

export async function deactivateParticipant(
  organizationId: string,
  actorUserId: string,
  id: string,
) {
  return updateParticipant(organizationId, actorUserId, id, { isActive: false });
}

async function setParticipantsActive(
  organizationId: string,
  actorUserId: string,
  ids: string[],
  isActive: boolean,
  action: string,
) {
  const result = await prisma.participant.updateMany({
    where: { organizationId, id: { in: ids } },
    data: { isActive },
  });
  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId,
    action,
    targetType: 'participant',
    metadata: { ids, updated: result.count },
  });
  await invalidateDashboard(organizationId);
  return { updated: result.count };
}

export async function deactivateParticipants(
  organizationId: string,
  actorUserId: string,
  ids: string[],
) {
  return setParticipantsActive(
    organizationId,
    actorUserId,
    ids,
    false,
    'participant.bulk_deactivate',
  );
}

export async function activateParticipants(
  organizationId: string,
  actorUserId: string,
  ids: string[],
) {
  return setParticipantsActive(organizationId, actorUserId, ids, true, 'participant.bulk_activate');
}

export async function deleteParticipant(organizationId: string, actorUserId: string, id: string) {
  const existing = await prisma.participant.findFirst({
    where: { organizationId, id },
    select: { id: true, email: true, name: true, code: true },
  });
  if (!existing) throw notFound('Participant not found.');

  await prisma.participant.delete({ where: { id } });
  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId,
    action: 'participant.delete',
    targetType: 'participant',
    targetId: id,
    metadata: { email: existing.email, code: existing.code, name: existing.name },
  });
  await invalidateDashboard(organizationId);
  return { deleted: true, email: existing.email };
}

export async function sampleParticipantsWorkbook() {
  return buildParticipantSampleWorkbook();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function importParticipantsFile(
  organizationId: string,
  actorUserId: string,
  file: { buffer: Buffer; originalname: string },
) {
  const { rows, ignoredColumns } = await parseParticipantsFile(file.buffer, file.originalname);
  const issues: ParticipantImportIssue[] = [];
  let created = 0;
  const seenEmails = new Set<string>();
  const seenCodes = new Set<string>();
  const seenPhones = new Set<string>();

  for (const row of rows) {
    const name = row.name.trim();
    const emailRaw = row.email.trim();
    const email = emailRaw.toLowerCase();
    const phoneRaw = row.phone.trim();
    const codeRaw = row.code.trim();
    const course = row.course.trim() || undefined;
    const city = row.city.trim() || undefined;
    const cohort = row.cohort.trim() || undefined;

    if (!name) {
      issues.push(
        participantRowIssue(row.sheetRow, 'name is required', {
          column: 'name',
          value: row.name,
          expected: 'the participant’s full name',
          example: 'Asha Verma',
        }),
      );
      continue;
    }
    if (!emailRaw) {
      issues.push(
        participantRowIssue(row.sheetRow, 'email is required', {
          column: 'email',
          value: row.email,
          expected: 'a real email address',
          example: 'participant@college.edu',
        }),
      );
      continue;
    }
    if (!EMAIL_RE.test(email)) {
      issues.push(
        participantRowIssue(row.sheetRow, 'this is not a valid email', {
          column: 'email',
          value: emailRaw,
          expected: 'a real email address',
          example: 'participant@college.edu',
        }),
      );
      continue;
    }
    if (seenEmails.has(email)) {
      issues.push(
        participantRowIssue(row.sheetRow, 'this email is duplicated earlier in the file', {
          column: 'email',
          value: email,
        }),
      );
      continue;
    }
    if (codeRaw && seenCodes.has(codeRaw.toLowerCase())) {
      issues.push(
        participantRowIssue(row.sheetRow, 'this code is duplicated earlier in the file', {
          column: 'code',
          value: codeRaw,
        }),
      );
      continue;
    }

    let phone: string | undefined;
    if (phoneRaw) {
      const normalized = normalizePhone(phoneRaw);
      if (!normalized) {
        issues.push(
          participantRowIssue(row.sheetRow, 'this is not a valid phone number', {
            column: 'phone',
            value: phoneRaw,
            expected: 'a phone number with country code when possible',
            example: '+919876543210',
          }),
        );
        continue;
      }
      if (seenPhones.has(normalized)) {
        issues.push(
          participantRowIssue(row.sheetRow, 'this phone is duplicated earlier in the file', {
            column: 'phone',
            value: phoneRaw,
          }),
        );
        continue;
      }
      phone = normalized;
    }

    try {
      await createParticipant(organizationId, actorUserId, {
        name,
        email,
        phone,
        course,
        city,
        cohort,
        code: codeRaw || undefined,
      });
      created += 1;
      seenEmails.add(email);
      if (codeRaw) seenCodes.add(codeRaw.toLowerCase());
      if (phone) seenPhones.add(phone);
    } catch (err) {
      if (
        (err instanceof AppError && err.status === 409) ||
        (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')
      ) {
        issues.push(
          participantRowIssue(
            row.sheetRow,
            'a participant with that email, code, or phone already exists in this organization',
            { column: 'email', value: email },
          ),
        );
        continue;
      }
      const message =
        err instanceof Error && err.message
          ? err.message.replace(/\.$/, '')
          : 'the row could not be saved';
      issues.push(participantRowIssue(row.sheetRow, message));
    }
  }

  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId,
    action: 'participant.import',
    targetType: 'participant',
    metadata: { created, issues: issues.length, ignoredColumns },
  });

  return { created, issues, ignoredColumns };
}
