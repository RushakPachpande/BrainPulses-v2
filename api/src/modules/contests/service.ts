import type { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { buildPage, listEnvelope, prismaCursorArgs } from '../../lib/pagination.js';
import { prisma } from '../../lib/prisma.js';
import { placeOwnedImage } from '../files/place.js';
import { assertCatalogImage } from '../files/service.js';
import type { contestListQuerySchema, createContestSchema, updateContestSchema } from './schema.js';

function mapContest(row: {
  id: string;
  sponsorId: string;
  name: string;
  description: string | null;
  imageFileId: string;
  createdAt: Date;
  updatedAt: Date;
  sponsor?: { id: string; name: string } | null;
  _count: { activities: number };
  registrationForm: {
    status: 'draft' | 'saved';
    _count: { submissions: number; quizzes: number };
  } | null;
}) {
  return {
    id: row.id,
    sponsorId: row.sponsorId,
    sponsorName: row.sponsor?.name ?? '',
    name: row.name,
    description: row.description,
    imageFileId: row.imageFileId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    activityCount: row._count.activities,
    registrationForm: row.registrationForm
      ? {
          status: row.registrationForm.status,
          submissionCount: row.registrationForm._count.submissions,
          quizCount: row.registrationForm._count.quizzes,
        }
      : null,
  };
}

const contestInclude = {
  sponsor: { select: { id: true, name: true } },
  _count: { select: { activities: true } },
  registrationForm: {
    select: {
      status: true,
      _count: { select: { submissions: true, quizzes: true } },
    },
  },
} as const;

async function assertSponsor(organizationId: string, sponsorId: string) {
  const sponsor = await prisma.sponsor.findFirst({
    where: { organizationId, id: sponsorId },
    select: { id: true },
  });
  if (!sponsor) throw badRequest('Choose a sponsor from this organization.');
}

export async function listContests(
  organizationId: string,
  query: z.infer<typeof contestListQuerySchema>,
) {
  const where = {
    organizationId,
    ...(query.sponsorId ? { sponsorId: query.sponsorId } : {}),
    ...(query.q ? { name: { contains: query.q, mode: 'insensitive' as const } } : {}),
  };
  const sort = query.sort === 'name' ? 'name' : ('createdAt' as const);
  const [total, rows] = await Promise.all([
    prisma.contest.count({ where }),
    prisma.contest.findMany({
      where,
      include: contestInclude,
      ...prismaCursorArgs(query, sort),
    }),
  ]);
  const { items, page } = buildPage(rows, query.limit, total);
  return listEnvelope(items.map(mapContest), page);
}

export async function getContest(organizationId: string, id: string) {
  const row = await prisma.contest.findFirst({
    where: { organizationId, id },
    include: contestInclude,
  });
  if (!row) throw notFound('Contest not found.');
  return mapContest(row);
}

export async function createContest(
  organizationId: string,
  actorUserId: string,
  input: z.infer<typeof createContestSchema>,
) {
  await assertSponsor(organizationId, input.sponsorId);
  await assertCatalogImage(organizationId, input.imageFileId);
  const row = await prisma.contest.create({
    data: {
      organizationId,
      sponsorId: input.sponsorId,
      name: input.name,
      description: input.description,
      imageFileId: input.imageFileId,
    },
    include: contestInclude,
  });
  await placeOwnedImage(organizationId, row.imageFileId, {
    kind: 'contest',
    sponsorName: row.sponsor?.name ?? 'sponsor',
    sponsorId: row.sponsorId,
    contestName: row.name,
    contestId: row.id,
  });
  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId,
    action: 'contest.create',
    targetType: 'contest',
    targetId: row.id,
  });
  return mapContest(row);
}

export async function updateContest(
  organizationId: string,
  actorUserId: string,
  id: string,
  input: z.infer<typeof updateContestSchema>,
) {
  const existing = await prisma.contest.findFirst({ where: { organizationId, id } });
  if (!existing) throw notFound('Contest not found.');
  const sponsorId = input.sponsorId ?? existing.sponsorId;
  if (input.sponsorId) await assertSponsor(organizationId, input.sponsorId);
  if (input.imageFileId) await assertCatalogImage(organizationId, input.imageFileId);
  if (input.sponsorId && input.sponsorId !== existing.sponsorId) {
    const linked = await prisma.activity.count({
      where: { organizationId, contestId: id },
    });
    if (linked > 0) {
      throw badRequest('This contest is already used by a quiz. Its sponsor cannot change.');
    }
  }
  const row = await prisma.contest.update({
    where: { id },
    data: {
      sponsorId,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.imageFileId !== undefined ? { imageFileId: input.imageFileId } : {}),
    },
    include: contestInclude,
  });
  await placeOwnedImage(organizationId, row.imageFileId, {
    kind: 'contest',
    sponsorName: row.sponsor?.name ?? 'sponsor',
    sponsorId: row.sponsorId,
    contestName: row.name,
    contestId: row.id,
  });
  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId,
    action: 'contest.update',
    targetType: 'contest',
    targetId: id,
  });
  return mapContest(row);
}

export async function deleteContest(organizationId: string, actorUserId: string, id: string) {
  const existing = await prisma.contest.findFirst({
    where: { organizationId, id },
    select: {
      id: true,
      name: true,
      _count: { select: { activities: true } },
      registrationForm: { select: { id: true } },
    },
  });
  if (!existing) throw notFound('Contest not found.');

  const activities = existing._count.activities;
  if (activities > 0) {
    throw conflict(
      `Cannot delete this contest while ${activities} activit${activities === 1 ? 'y' : 'ies'} still use it. Remove those links first.`,
    );
  }
  if (existing.registrationForm) {
    throw conflict(
      'Cannot delete this contest while a registration form still uses it. Remove that form first.',
    );
  }

  await prisma.contest.delete({ where: { id } });
  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId,
    action: 'contest.delete',
    targetType: 'contest',
    targetId: id,
    metadata: { name: existing.name },
  });
  return { deleted: true, name: existing.name };
}
