import { Prisma } from '#prisma';
import { writeAudit } from '../../lib/audit.js';
import { invalidateDashboard } from '../../lib/cache.js';
import { nextHumanCode } from '../../lib/codes.js';
import { conflict, notFound } from '../../lib/errors.js';
import { buildPage, listEnvelope, prismaCursorArgs } from '../../lib/pagination.js';
import { normalizePhone } from '../../lib/phone.js';
import { prisma } from '../../lib/prisma.js';
import type { z } from 'zod';
import type { createStudentSchema, studentListQuerySchema, updateStudentSchema } from './schema.js';

function mapStudent(s: {
  id: string;
  code: string;
  name: string;
  email: string;
  phone: string | null;
  course: string | null;
  city: string | null;
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
    status: s.isActive ? 'Active' : 'Inactive',
    isActive: s.isActive,
    lastLoginAt: s.lastLoginAt,
    registered: s.createdAt,
    activities: s._count?.registrations ?? 0,
  };
}

export async function listStudents(
  organizationId: string,
  query: z.infer<typeof studentListQuerySchema>,
) {
  const where: Prisma.StudentWhereInput = {
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
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      include: { _count: { select: { registrations: true } } },
      ...prismaCursorArgs(query, sort),
    }),
  ]);

  const { items, page } = buildPage(rows, query.limit, total);
  return listEnvelope(items.map(mapStudent), page);
}

export async function getStudent(organizationId: string, id: string) {
  const student = await prisma.student.findFirst({
    where: { organizationId, id },
    include: { _count: { select: { registrations: true } } },
  });
  if (!student) throw notFound('Student not found.');
  return mapStudent(student);
}

export async function createStudent(
  organizationId: string,
  actorUserId: string,
  input: z.infer<typeof createStudentSchema>,
) {
  const code = input.code ?? (await nextHumanCode(organizationId, 'BP', 'student'));
  try {
    const student = await prisma.student.create({
      data: {
        organizationId,
        code,
        name: input.name,
        email: input.email.toLowerCase(),
        phone: input.phone ? normalizePhone(input.phone) : input.phone,
        course: input.course,
        city: input.city,
      },
      include: { _count: { select: { registrations: true } } },
    });
    await writeAudit({
      organizationId,
      actorType: 'user',
      actorUserId,
      action: 'student.create',
      targetType: 'student',
      targetId: student.id,
    });
    await invalidateDashboard(organizationId);
    return mapStudent(student);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw conflict('A student with that email, code, or phone already exists.');
    }
    throw err;
  }
}

export async function updateStudent(
  organizationId: string,
  actorUserId: string,
  id: string,
  input: z.infer<typeof updateStudentSchema>,
) {
  const existing = await prisma.student.findFirst({ where: { organizationId, id } });
  if (!existing) throw notFound('Student not found.');

  try {
    const student = await prisma.student.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email !== undefined ? { email: input.email.toLowerCase() } : {}),
        ...(input.phone !== undefined
          ? { phone: input.phone ? normalizePhone(input.phone) : input.phone }
          : {}),
        ...(input.course !== undefined ? { course: input.course } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      include: { _count: { select: { registrations: true } } },
    });

    await writeAudit({
      organizationId,
      actorType: 'user',
      actorUserId,
      action: 'student.update',
      targetType: 'student',
      targetId: id,
    });
    await invalidateDashboard(organizationId);
    return mapStudent(student);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw conflict('A student with that email, code, or phone already exists.');
    }
    throw err;
  }
}

export async function deactivateStudent(organizationId: string, actorUserId: string, id: string) {
  return updateStudent(organizationId, actorUserId, id, { isActive: false });
}
