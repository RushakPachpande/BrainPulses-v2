import { parse } from 'csv-parse/sync';
import { Prisma } from '#prisma';
import { writeAudit } from '../../lib/audit.js';
import { nextHumanCode } from '../../lib/codes.js';
import { stripFormulaInjection } from '../../lib/csv.js';
import { conflict, notFound, unprocessable } from '../../lib/errors.js';
import { buildPage, listEnvelope } from '../../lib/pagination.js';
import { prisma } from '../../lib/prisma.js';
import type { z } from 'zod';
import type {
  bankListQuerySchema,
  createBankSchema,
  createQuestionSchema,
  updateBankSchema,
  updateQuestionSchema,
} from './schema.js';

function mapBank(b: {
  id: string;
  code: string;
  name: string;
  description: string | null;
  kind: string;
  presentation: string;
  status: string;
  updatedAt: Date;
  _count?: { questions: number; activityBanks: number };
  questions?: { type: string }[];
}) {
  const types = [...new Set((b.questions ?? []).map((q) => q.type))].join(', ');
  return {
    id: b.id,
    code: b.code,
    name: b.name,
    description: b.description,
    kind: b.kind,
    presentation: b.presentation,
    status: b.status.charAt(0).toUpperCase() + b.status.slice(1),
    statusKey: b.status,
    questions: b._count?.questions ?? 0,
    usedIn: b._count?.activityBanks ?? 0,
    types,
    updatedAt: b.updatedAt,
  };
}

/** Public question shape — never includes answerKey or isCorrect. */
function mapQuestionPublic(q: {
  id: string;
  code: string;
  type: string;
  stem: string;
  points: Prisma.Decimal;
  isActive: boolean;
  versions: {
    id: string;
    version: number;
    options: { id: string; label: string; body: string; sortOrder: number }[];
  }[];
}) {
  const latest = q.versions[0];
  return {
    id: q.id,
    code: q.code,
    type: q.type,
    stem: q.stem,
    points: Number(q.points),
    isActive: q.isActive,
    version: latest?.version ?? 1,
    options: (latest?.options ?? []).map((o) => ({
      id: o.id,
      label: o.label,
      body: o.body,
      sortOrder: o.sortOrder,
    })),
  };
}

export async function listBanks(
  organizationId: string,
  query: z.infer<typeof bankListQuerySchema>,
) {
  const where: Prisma.QuestionBankWhereInput = {
    organizationId,
    kind: query.kind,
    ...(query.status !== 'all' ? { status: query.status } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { code: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(query.cursor ? { id: { lt: query.cursor } } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.questionBank.count({ where: { ...where, id: undefined } }),
    prisma.questionBank.findMany({
      where,
      include: {
        _count: { select: { questions: true, activityBanks: true } },
        questions: { select: { type: true }, take: 20 },
      },
      orderBy: { updatedAt: query.order },
      take: query.limit + 1,
    }),
  ]);

  const { items, page } = buildPage(rows, query.limit, total);
  return listEnvelope(items.map(mapBank), page);
}

export async function getBank(organizationId: string, id: string) {
  const bank = await prisma.questionBank.findFirst({
    where: { organizationId, id },
    include: {
      _count: { select: { questions: true, activityBanks: true } },
      questions: {
        where: { isActive: true },
        include: {
          versions: {
            orderBy: { version: 'desc' },
            take: 1,
            include: { options: { orderBy: { sortOrder: 'asc' } } },
          },
        },
      },
    },
  });
  if (!bank) throw notFound('Question bank not found.');
  return {
    ...mapBank(bank),
    items: bank.questions.map(mapQuestionPublic),
  };
}

export async function createBank(
  organizationId: string,
  actorUserId: string,
  input: z.infer<typeof createBankSchema>,
) {
  const code = input.code ?? (await nextHumanCode(organizationId, 'QB', 'bank'));
  try {
    const bank = await prisma.questionBank.create({
      data: {
        organizationId,
        kind: input.kind,
        code,
        name: input.name,
        description: input.description,
        presentation: input.presentation,
      },
      include: {
        _count: { select: { questions: true, activityBanks: true } },
        questions: { select: { type: true } },
      },
    });
    await writeAudit({
      organizationId,
      actorType: 'user',
      actorUserId,
      action: 'bank.create',
      targetType: 'question_bank',
      targetId: bank.id,
    });
    return mapBank(bank);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw conflict('A bank with that code already exists.');
    }
    throw err;
  }
}

export async function updateBank(
  organizationId: string,
  actorUserId: string,
  id: string,
  input: z.infer<typeof updateBankSchema>,
) {
  const existing = await prisma.questionBank.findFirst({ where: { organizationId, id } });
  if (!existing) throw notFound('Question bank not found.');

  const bank = await prisma.questionBank.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.presentation !== undefined ? { presentation: input.presentation } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.code !== undefined ? { code: input.code } : {}),
    },
    include: {
      _count: { select: { questions: true, activityBanks: true } },
      questions: { select: { type: true } },
    },
  });

  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId,
    action: 'bank.update',
    targetType: 'question_bank',
    targetId: id,
  });
  return mapBank(bank);
}

async function createQuestionVersion(
  organizationId: string,
  questionId: string,
  input: {
    type: z.infer<typeof createQuestionSchema>['type'];
    stem: string;
    points: number;
    options: { label: string; body: string; isCorrect: boolean }[];
    answerKey: Record<string, unknown>;
  },
  version: number,
) {
  const answerKey =
    Object.keys(input.answerKey).length > 0
      ? input.answerKey
      : {
          correctLabels: input.options.filter((o) => o.isCorrect).map((o) => o.label),
        };

  const created = await prisma.questionVersion.create({
    data: {
      organizationId,
      questionId,
      version,
      type: input.type,
      stem: input.stem,
      points: input.points,
      answerKey: answerKey as Prisma.InputJsonValue,
    },
  });

  if (input.options.length > 0) {
    await prisma.questionOption.createMany({
      data: input.options.map((o, i) => ({
        questionId,
        questionVersionId: created.id,
        label: o.label,
        body: o.body,
        sortOrder: i,
        isCorrect: o.isCorrect,
      })),
    });
  }

  const options = await prisma.questionOption.findMany({
    where: { questionVersionId: created.id },
    orderBy: { sortOrder: 'asc' },
  });

  return { ...created, options };
}

export async function createQuestion(
  organizationId: string,
  actorUserId: string,
  bankId: string,
  input: z.infer<typeof createQuestionSchema>,
) {
  const bank = await prisma.questionBank.findFirst({ where: { organizationId, id: bankId } });
  if (!bank) throw notFound('Question bank not found.');

  const code = input.code ?? `Q-${Date.now().toString(36)}`;
  const question = await prisma.question.create({
    data: {
      organizationId,
      bankId,
      code,
      type: input.type,
      stem: input.stem,
      points: input.points,
    },
  });

  const version = await createQuestionVersion(organizationId, question.id, input, 1);

  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId,
    action: 'question.create',
    targetType: 'question',
    targetId: question.id,
  });

  return mapQuestionPublic({
    ...question,
    versions: [
      {
        id: version.id,
        version: version.version,
        options: version.options.map((o) => ({
          id: o.id,
          label: o.label,
          body: o.body,
          sortOrder: o.sortOrder,
        })),
      },
    ],
  });
}

export async function updateQuestion(
  organizationId: string,
  actorUserId: string,
  bankId: string,
  questionId: string,
  input: z.infer<typeof updateQuestionSchema>,
) {
  const question = await prisma.question.findFirst({
    where: { organizationId, bankId, id: questionId },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
  });
  if (!question) throw notFound('Question not found.');

  const latest = question.versions[0];
  const nextVersion = (latest?.version ?? 0) + 1;

  const type = input.type ?? question.type;
  const stem = input.stem ?? question.stem;
  const points = input.points ?? Number(question.points);
  const options = input.options ?? [];
  const answerKey = input.answerKey ?? {};

  await prisma.question.update({
    where: { id: questionId },
    data: { type, stem, points },
  });

  const version = await createQuestionVersion(
    organizationId,
    questionId,
    { type, stem, points, options, answerKey },
    nextVersion,
  );

  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId,
    action: 'question.update',
    targetType: 'question',
    targetId: questionId,
    metadata: { version: nextVersion },
  });

  return mapQuestionPublic({
    id: questionId,
    code: question.code,
    type,
    stem,
    points: new Prisma.Decimal(points),
    isActive: question.isActive,
    versions: [
      {
        id: version.id,
        version: version.version,
        options: version.options.map((o) => ({
          id: o.id,
          label: o.label,
          body: o.body,
          sortOrder: o.sortOrder,
        })),
      },
    ],
  });
}

export async function importQuestions(
  organizationId: string,
  actorUserId: string,
  bankId: string,
  csv: string,
  idempotencyKey?: string,
) {
  const bank = await prisma.questionBank.findFirst({ where: { organizationId, id: bankId } });
  if (!bank) throw notFound('Question bank not found.');

  if (idempotencyKey) {
    const existing = await prisma.auditEvent.findFirst({
      where: {
        organizationId,
        action: 'bank.import',
        targetId: bankId,
        metadata: { path: ['idempotencyKey'], equals: idempotencyKey },
      },
    });
    if (existing?.metadata && typeof existing.metadata === 'object') {
      const meta = existing.metadata as { result?: unknown };
      if (meta.result) return meta.result;
    }
  }

  let records: Record<string, string>[];
  try {
    records = parse(csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as Record<string, string>[];
  } catch {
    throw unprocessable('CSV could not be parsed.');
  }

  const errors: { row: number; message: string }[] = [];
  let created = 0;

  for (let i = 0; i < records.length; i++) {
    const row = records[i]!;
    const stem = stripFormulaInjection(row.stem ?? row.question ?? '');
    const typeRaw = (row.type ?? 'single_mcq').toLowerCase();
    if (!stem) {
      errors.push({ row: i + 2, message: 'stem is required' });
      continue;
    }

    const type = (
      [
        'single_mcq',
        'multiple_mcq',
        'numeric',
        'short_text',
        'passage',
        'match',
        'image_mcq',
      ] as const
    ).includes(typeRaw as 'single_mcq')
      ? (typeRaw as z.infer<typeof createQuestionSchema>['type'])
      : 'single_mcq';

    const options: { label: string; body: string; isCorrect: boolean }[] = [];
    for (const label of ['A', 'B', 'C', 'D', 'E']) {
      const body = stripFormulaInjection(row[`option_${label}`] ?? row[label] ?? '');
      if (body) {
        const correct = (row.correct ?? '').toUpperCase().includes(label);
        options.push({ label, body, isCorrect: correct });
      }
    }

    try {
      await createQuestion(organizationId, actorUserId, bankId, {
        type,
        stem,
        points: Number(row.points ?? 1) || 1,
        options,
        answerKey: {},
      });
      created += 1;
    } catch (err) {
      errors.push({
        row: i + 2,
        message: err instanceof Error ? err.message : 'Failed to import row',
      });
    }
  }

  const result = { created, errors };
  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId,
    action: 'bank.import',
    targetType: 'question_bank',
    targetId: bankId,
    metadata: { idempotencyKey, result },
  });
  return result;
}
