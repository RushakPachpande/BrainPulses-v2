import type { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { conflict, notFound } from '../../lib/errors.js';
import { buildPage, listEnvelope, prismaCursorArgs } from '../../lib/pagination.js';
import { prisma } from '../../lib/prisma.js';
import { assertCatalogImage } from '../files/service.js';
import type { createSponsorSchema, sponsorListQuerySchema, updateSponsorSchema } from './schema.js';

function mapSponsor(row: {
  id: string;
  name: string;
  imageFileId: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: { contests: number };
}) {
  return {
    id: row.id,
    name: row.name,
    imageFileId: row.imageFileId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    contests: row._count?.contests ?? 0,
  };
}

export async function listSponsors(
  organizationId: string,
  query: z.infer<typeof sponsorListQuerySchema>,
) {
  const where = {
    organizationId,
    ...(query.q ? { name: { contains: query.q, mode: 'insensitive' as const } } : {}),
  };
  const sort = query.sort === 'name' ? 'name' : ('createdAt' as const);
  const [total, rows] = await Promise.all([
    prisma.sponsor.count({ where }),
    prisma.sponsor.findMany({
      where,
      include: { _count: { select: { contests: true } } },
      ...prismaCursorArgs(query, sort),
    }),
  ]);
  const { items, page } = buildPage(rows, query.limit, total);
  return listEnvelope(items.map(mapSponsor), page);
}

export async function getSponsor(organizationId: string, id: string) {
  const row = await prisma.sponsor.findFirst({
    where: { organizationId, id },
    include: { _count: { select: { contests: true } } },
  });
  if (!row) throw notFound('Sponsor not found.');
  return mapSponsor(row);
}

export async function createSponsor(
  organizationId: string,
  actorUserId: string,
  input: z.infer<typeof createSponsorSchema>,
) {
  await assertCatalogImage(organizationId, input.imageFileId);
  const row = await prisma.sponsor.create({
    data: {
      organizationId,
      name: input.name,
      imageFileId: input.imageFileId,
    },
    include: { _count: { select: { contests: true } } },
  });
  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId,
    action: 'sponsor.create',
    targetType: 'sponsor',
    targetId: row.id,
  });
  return mapSponsor(row);
}

export async function updateSponsor(
  organizationId: string,
  actorUserId: string,
  id: string,
  input: z.infer<typeof updateSponsorSchema>,
) {
  const existing = await prisma.sponsor.findFirst({ where: { organizationId, id } });
  if (!existing) throw notFound('Sponsor not found.');
  if (input.imageFileId) await assertCatalogImage(organizationId, input.imageFileId);
  const row = await prisma.sponsor.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.imageFileId !== undefined ? { imageFileId: input.imageFileId } : {}),
    },
    include: { _count: { select: { contests: true } } },
  });
  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId,
    action: 'sponsor.update',
    targetType: 'sponsor',
    targetId: id,
  });
  return mapSponsor(row);
}

export async function deleteSponsor(organizationId: string, actorUserId: string, id: string) {
  const existing = await prisma.sponsor.findFirst({
    where: { organizationId, id },
    include: { _count: { select: { contests: true, activities: true } } },
  });
  if (!existing) throw notFound('Sponsor not found.');

  const contests = existing._count.contests;
  const activities = existing._count.activities;
  if (contests > 0 || activities > 0) {
    throw conflict(
      `Cannot delete this sponsor while ${contests} contest${contests === 1 ? '' : 's'} and ${activities} activit${activities === 1 ? 'y' : 'ies'} still use it. Remove those links first.`,
    );
  }

  await prisma.sponsor.delete({ where: { id } });
  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId,
    action: 'sponsor.delete',
    targetType: 'sponsor',
    targetId: id,
    metadata: { name: existing.name },
  });
  return { deleted: true, name: existing.name };
}
