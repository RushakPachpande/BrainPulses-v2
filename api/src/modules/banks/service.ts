import { Prisma, type AccessLevel, type ActivityKind, type MembershipRole } from '#prisma';
import { writeAudit } from '../../lib/audit.js';
import { nextHumanCode } from '../../lib/codes.js';
import { conflict, forbidden, notFound, unprocessable } from '../../lib/errors.js';
import { buildPage, listEnvelope, prismaCursorArgs } from '../../lib/pagination.js';
import { prisma } from '../../lib/prisma.js';
import type { z } from 'zod';
import { formatImportIssue } from '../../lib/spreadsheet-import.js';
import {
  buildExportCsv,
  buildExportWorkbook,
  buildSampleCsv,
  buildSampleWorkbook,
  newImportQuestionCode,
  parseBankQuestionsFile,
  rowToCreatePayload,
  type BankImportRow,
  type ExportableQuestion,
  type ImportIssue,
} from './import-export.js';
import { saveSharedPassage, stripPassageText } from './passages.js';
import {
  assertTypeAllowedForKind,
  normalizeAnswerKeyImages,
  type bankListQuerySchema,
  type bulkQuestionStatusSchema,
  type createBankSchema,
  type createQuestionSchema,
  type updateBankSchema,
  type updateQuestionSchema,
} from './schema.js';

const accessRank: Record<AccessLevel, number> = {
  none: 0,
  view: 1,
  edit: 2,
  full: 3,
};

type AccessActor = {
  role: MembershipRole;
  assessmentAccess: AccessLevel;
  quizAccess: AccessLevel;
};

export function assertBankAccess(actor: AccessActor, kind: ActivityKind, min: AccessLevel) {
  if (actor.role === 'super_admin') return;
  const level = kind === 'assessment' ? actor.assessmentAccess : actor.quizAccess;
  if (accessRank[level] < accessRank[min]) {
    throw forbidden('Insufficient access for this question bank.');
  }
}

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

type VersionOption = {
  id: string;
  label: string;
  body: string;
  sortOrder: number;
  isCorrect?: boolean;
  imageUrl?: string | null;
};

function answerKeyRecord(value: Prisma.JsonValue | undefined): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/** Admin bank detail — includes isCorrect / correctLabels; never raw answerKey. */
function mapQuestionAdmin(q: {
  id: string;
  code: string;
  type: string;
  question: string;
  points: Prisma.Decimal;
  isActive: boolean;
  passage?: { body: string } | null;
  versions: {
    id: string;
    version: number;
    answerKey?: Prisma.JsonValue;
    options: VersionOption[];
  }[];
}) {
  const latest = q.versions[0];
  const key = answerKeyRecord(latest?.answerKey);
  const options = (latest?.options ?? []).map((o) => ({
    id: o.id,
    label: o.label,
    body: o.body,
    sortOrder: o.sortOrder,
    isCorrect: Boolean(o.isCorrect),
    imageUrl: o.imageUrl ?? null,
  }));
  const fromKey = Array.isArray(key.correctLabels)
    ? key.correctLabels.filter((x): x is string => typeof x === 'string')
    : [];
  const correctLabels =
    fromKey.length > 0 ? fromKey : options.filter((o) => o.isCorrect).map((o) => o.label);
  const fromPassage = q.passage?.body?.trim();
  const passageFromKey = typeof key.passageText === 'string' ? key.passageText : undefined;
  const passageText = fromPassage || passageFromKey;
  const questionImageUrl =
    typeof key.questionImageUrl === 'string'
      ? key.questionImageUrl
      : typeof key.stemImageUrl === 'string'
        ? key.stemImageUrl
        : undefined;
  const referenceValue = key.value;
  return {
    id: q.id,
    code: q.code,
    type: q.type,
    question: q.question,
    points: Number(q.points),
    isActive: q.isActive,
    version: latest?.version ?? 1,
    correctLabels,
    options,
    ...(passageText !== undefined ? { passageText } : {}),
    ...(questionImageUrl !== undefined ? { questionImageUrl } : {}),
    ...(referenceValue !== undefined ? { referenceValue } : {}),
    ...(typeof key.numericTolerance === 'number' ? { numericTolerance: key.numericTolerance } : {}),
  };
}

export async function listBanks(
  organizationId: string,
  query: z.infer<typeof bankListQuerySchema>,
) {
  const where: Prisma.QuestionBankWhereInput = {
    organizationId,
    kind: query.kind,
    origin: 'reusable',
    ...(query.status !== 'all' ? { status: query.status } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { code: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.questionBank.count({ where }),
    prisma.questionBank.findMany({
      where,
      include: {
        _count: { select: { questions: true, activityBanks: true } },
        questions: { select: { type: true }, take: 20 },
      },
      ...prismaCursorArgs(query, 'updatedAt'),
    }),
  ]);

  const { items, page } = buildPage(rows, query.limit, total);
  return listEnvelope(items.map(mapBank), page);
}

export async function getBank(organizationId: string, id: string, actor?: AccessActor) {
  const bank = await prisma.questionBank.findFirst({
    where: { organizationId, id },
    include: {
      _count: { select: { questions: true, activityBanks: true } },
      questions: {
        orderBy: { createdAt: 'asc' },
        include: {
          passage: true,
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
  if (actor) assertBankAccess(actor, bank.kind, 'view');
  const shared = new Map<string, number>();
  for (const question of bank.questions) {
    if (!question.passageId) continue;
    shared.set(question.passageId, (shared.get(question.passageId) ?? 0) + 1);
  }
  return {
    ...mapBank(bank),
    items: bank.questions.map((question) => ({
      ...mapQuestionAdmin(question),
      ...(question.passageId ? { passageSharedCount: shared.get(question.passageId) ?? 1 } : {}),
    })),
  };
}

export async function createBank(
  organizationId: string,
  actorUserId: string,
  actor: AccessActor,
  input: z.infer<typeof createBankSchema>,
) {
  assertBankAccess(actor, input.kind, 'edit');
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
  actor: AccessActor,
  id: string,
  input: z.infer<typeof updateBankSchema>,
) {
  const existing = await prisma.questionBank.findFirst({ where: { organizationId, id } });
  if (!existing) throw notFound('Question bank not found.');
  assertBankAccess(actor, existing.kind, 'edit');

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

async function linkQuestionPassage(
  organizationId: string,
  bankId: string,
  type: string,
  answerKey: Record<string, unknown>,
  options: {
    cache?: Map<string, string>;
    passageId?: string | null;
    editingQuestionId?: string;
    fallbackBody?: string | null;
  } = {},
): Promise<{
  passageId: string | null;
  sortOrder: number;
  answerKey: Record<string, unknown>;
  passageBody: string | null;
}> {
  if (type !== 'comprehension_mcq') {
    return {
      passageId: null,
      sortOrder: 0,
      answerKey: stripPassageText(answerKey),
      passageBody: null,
    };
  }
  const incoming = typeof answerKey.passageText === 'string' ? answerKey.passageText : '';
  const body = incoming.trim() || options.fallbackBody?.trim() || '';
  const saved = await saveSharedPassage({
    organizationId,
    bankId,
    body,
    passageId: options.passageId,
    editingQuestionId: options.editingQuestionId,
    cache: options.cache,
  });
  return {
    passageId: saved.passageId,
    sortOrder: saved.sortOrder,
    answerKey: stripPassageText(answerKey),
    passageBody: body,
  };
}

async function createQuestionVersion(
  organizationId: string,
  questionId: string,
  input: {
    type: z.infer<typeof createQuestionSchema>['type'];
    question: string;
    points: number;
    options: {
      label: string;
      body: string;
      isCorrect: boolean;
      imageUrl?: string | null;
    }[];
    answerKey: Record<string, unknown>;
    passageId?: string | null;
  },
  version: number,
) {
  const rawKey =
    Object.keys(input.answerKey).length > 0
      ? input.answerKey
      : {
          correctLabels: input.options.filter((o) => o.isCorrect).map((o) => o.label),
        };
  const answerKey = stripPassageText(normalizeAnswerKeyImages(rawKey));

  const created = await prisma.questionVersion.create({
    data: {
      organizationId,
      questionId,
      version,
      type: input.type,
      question: input.question,
      points: input.points,
      answerKey: answerKey as Prisma.InputJsonValue,
      passageId: input.passageId ?? null,
    },
  });

  if (input.options.length > 0) {
    await prisma.questionOption.createMany({
      data: input.options.map((o, i) => ({
        questionId,
        questionVersionId: created.id,
        label: o.label,
        body: o.body ?? '',
        imageUrl: o.imageUrl ?? null,
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
  actor: AccessActor,
  bankId: string,
  input: z.infer<typeof createQuestionSchema>,
  passageCache?: Map<string, string>,
) {
  const bank = await prisma.questionBank.findFirst({ where: { organizationId, id: bankId } });
  if (!bank) throw notFound('Question bank not found.');
  assertBankAccess(actor, bank.kind, 'edit');
  assertTypeAllowedForKind(bank.kind, input.type);

  const linked = await linkQuestionPassage(organizationId, bankId, input.type, input.answerKey, {
    cache: passageCache,
  });
  const code = input.code ?? `Q-${Date.now().toString(36)}`;
  const question = await prisma.question.create({
    data: {
      organizationId,
      bankId,
      code,
      type: input.type,
      question: input.question,
      points: input.points,
      passageId: linked.passageId,
      sortOrder: linked.sortOrder,
    },
  });

  const version = await createQuestionVersion(
    organizationId,
    question.id,
    { ...input, answerKey: linked.answerKey, passageId: linked.passageId },
    1,
  );

  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId,
    action: 'question.create',
    targetType: 'question',
    targetId: question.id,
  });

  return mapQuestionAdmin({
    ...question,
    passage: linked.passageBody ? { body: linked.passageBody } : null,
    versions: [
      {
        id: version.id,
        version: version.version,
        answerKey: version.answerKey,
        options: version.options.map((o) => ({
          id: o.id,
          label: o.label,
          body: o.body,
          sortOrder: o.sortOrder,
          isCorrect: o.isCorrect,
          imageUrl: o.imageUrl,
        })),
      },
    ],
  });
}

export async function updateQuestion(
  organizationId: string,
  actorUserId: string,
  actor: AccessActor,
  bankId: string,
  questionId: string,
  input: z.infer<typeof updateQuestionSchema>,
) {
  const bank = await prisma.questionBank.findFirst({ where: { organizationId, id: bankId } });
  if (!bank) throw notFound('Question bank not found.');
  assertBankAccess(actor, bank.kind, 'edit');

  const question = await prisma.question.findFirst({
    where: { organizationId, bankId, id: questionId },
    include: {
      passage: true,
      versions: {
        orderBy: { version: 'desc' },
        take: 1,
        include: { options: { orderBy: { sortOrder: 'asc' } } },
      },
    },
  });
  if (!question) throw notFound('Question not found.');

  const contentTouched =
    input.type !== undefined ||
    input.question !== undefined ||
    input.points !== undefined ||
    input.options !== undefined ||
    input.answerKey !== undefined;

  if (!contentTouched && input.isActive === undefined) {
    return mapQuestionAdmin({
      ...question,
      versions: question.versions.map((v) => ({
        id: v.id,
        version: v.version,
        answerKey: v.answerKey,
        options: v.options,
      })),
    });
  }

  const latest = question.versions[0];
  let liveIsActive = question.isActive;
  let liveType = question.type;
  let passageForMap: { body: string } | null = question.passage;
  let liveQuestion = question.question;
  let livePoints = Number(question.points);
  let versionForMap = latest
    ? {
        id: latest.id,
        version: latest.version,
        answerKey: latest.answerKey,
        options: latest.options,
      }
    : null;

  if (contentTouched) {
    const nextVersion = (latest?.version ?? 0) + 1;
    liveType = input.type ?? question.type;
    // Quiz banks: coerce legacy image_mcq → single_mcq on save; reject other types.
    if (bank.kind === 'quiz' && liveType === 'image_mcq') {
      liveType = 'single_mcq';
    }
    assertTypeAllowedForKind(bank.kind, liveType);
    liveQuestion = input.question ?? question.question;
    livePoints = input.points ?? Number(question.points);
    const options =
      input.options ??
      latest?.options.map((o) => ({
        label: o.label,
        body: o.body,
        isCorrect: o.isCorrect,
        imageUrl: o.imageUrl,
      })) ??
      [];
    const answerKey =
      input.answerKey ??
      (latest?.answerKey && typeof latest.answerKey === 'object'
        ? (latest.answerKey as Record<string, unknown>)
        : {});
    const linked = await linkQuestionPassage(organizationId, bankId, liveType, answerKey, {
      passageId: question.passageId,
      editingQuestionId: question.id,
      fallbackBody: question.passage?.body,
    });
    passageForMap = linked.passageBody ? { body: linked.passageBody } : null;

    await prisma.question.update({
      where: { id: questionId },
      data: {
        type: liveType,
        question: liveQuestion,
        points: livePoints,
        passageId: linked.passageId,
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
    if (input.isActive !== undefined) liveIsActive = input.isActive;

    const version = await createQuestionVersion(
      organizationId,
      questionId,
      {
        type: liveType,
        question: liveQuestion,
        points: livePoints,
        options,
        answerKey: linked.answerKey,
        passageId: linked.passageId,
      },
      nextVersion,
    );
    versionForMap = {
      id: version.id,
      version: version.version,
      answerKey: version.answerKey,
      options: version.options,
    };

    await writeAudit({
      organizationId,
      actorType: 'user',
      actorUserId,
      action: 'question.update',
      targetType: 'question',
      targetId: questionId,
      metadata: { version: nextVersion },
    });
  } else if (input.isActive !== undefined) {
    await prisma.question.update({
      where: { id: questionId },
      data: { isActive: input.isActive },
    });
    liveIsActive = input.isActive;
    await writeAudit({
      organizationId,
      actorType: 'user',
      actorUserId,
      action: 'question.update',
      targetType: 'question',
      targetId: questionId,
      metadata: { isActive: input.isActive },
    });
  }

  return mapQuestionAdmin({
    id: questionId,
    code: question.code,
    type: liveType,
    question: liveQuestion,
    points: new Prisma.Decimal(livePoints),
    isActive: liveIsActive,
    passage: passageForMap,
    versions: versionForMap
      ? [
          {
            id: versionForMap.id,
            version: versionForMap.version,
            answerKey: versionForMap.answerKey,
            options: versionForMap.options.map((o) => ({
              id: o.id,
              label: o.label,
              body: o.body,
              sortOrder: o.sortOrder,
              isCorrect: o.isCorrect,
              imageUrl: o.imageUrl,
            })),
          },
        ]
      : [],
  });
}

export async function setBankQuestionsActive(
  organizationId: string,
  actorUserId: string,
  actor: AccessActor,
  bankId: string,
  input: z.infer<typeof bulkQuestionStatusSchema>,
) {
  const bank = await prisma.questionBank.findFirst({
    where: { organizationId, id: bankId },
    select: { id: true, kind: true },
  });
  if (!bank) throw notFound('Question bank not found.');
  assertBankAccess(actor, bank.kind, 'edit');

  const result = await prisma.question.updateMany({
    where: { organizationId, bankId, id: { in: input.ids } },
    data: { isActive: input.isActive },
  });

  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId,
    action: input.isActive ? 'question.bulk_activate' : 'question.bulk_deactivate',
    targetType: 'question_bank',
    targetId: bankId,
    metadata: { ids: input.ids, isActive: input.isActive, updated: result.count },
  });

  return { updated: result.count };
}

function importRowMessage(sheetRow: number, err: unknown): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return formatImportIssue({
        sheetRow,
        problem: 'this row duplicates an existing question code in the bank',
        expected: 'a unique question, or omit the duplicate row',
      });
    }
    return formatImportIssue({
      sheetRow,
      problem: 'the row could not be saved',
      expected: 'valid question fields matching the sample Excel',
    });
  }
  if (err instanceof Error && err.message) {
    return formatImportIssue({
      sheetRow,
      problem: err.message.replace(/\.$/, ''),
    });
  }
  return formatImportIssue({
    sheetRow,
    problem: 'the row could not be imported',
    expected: 'fix the listed columns using Sample Excel as a guide',
  });
}

async function importFromRows(
  organizationId: string,
  actorUserId: string,
  actor: AccessActor,
  bankId: string,
  rows: BankImportRow[],
  idempotencyKey?: string,
) {
  const bank = await prisma.questionBank.findFirst({ where: { organizationId, id: bankId } });
  if (!bank) throw notFound('Question bank not found.');
  assertBankAccess(actor, bank.kind, 'edit');

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
      if (meta.result) return meta.result as { created: number; issues: ImportIssue[] };
    }
  }

  if (rows.length === 0) {
    throw unprocessable('No question rows found in the file.');
  }

  const issues: ImportIssue[] = [];
  let created = 0;
  const passageCache = new Map<string, string>();

  for (const row of rows) {
    try {
      const payload = rowToCreatePayload(row, bank.kind);
      await createQuestion(
        organizationId,
        actorUserId,
        actor,
        bankId,
        {
          ...payload,
          code: payload.code ?? newImportQuestionCode(row.sheetRow, created + issues.length),
        },
        passageCache,
      );
      created += 1;
    } catch (err) {
      issues.push({
        row: row.sheetRow,
        message: importRowMessage(row.sheetRow, err),
      });
    }
  }

  const result = { created, issues };
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

export async function importQuestionsFile(
  organizationId: string,
  actorUserId: string,
  actor: AccessActor,
  bankId: string,
  file: { buffer: Buffer; originalname: string; mimetype?: string },
  idempotencyKey?: string,
) {
  const rows = await parseBankQuestionsFile(file.buffer, file.originalname, file.mimetype);
  return importFromRows(organizationId, actorUserId, actor, bankId, rows, idempotencyKey);
}

export async function sampleQuestionsWorkbook(
  organizationId: string,
  actor: AccessActor,
  bankId: string,
) {
  const bank = await prisma.questionBank.findFirst({ where: { organizationId, id: bankId } });
  if (!bank) throw notFound('Question bank not found.');
  assertBankAccess(actor, bank.kind, 'view');
  return buildSampleWorkbook(bank.kind);
}

export async function sampleQuestionsCsv(
  organizationId: string,
  actor: AccessActor,
  bankId: string,
) {
  const bank = await prisma.questionBank.findFirst({ where: { organizationId, id: bankId } });
  if (!bank) throw notFound('Question bank not found.');
  assertBankAccess(actor, bank.kind, 'view');
  return buildSampleCsv(bank.kind);
}

export async function exportQuestionsWorkbook(
  organizationId: string,
  actorUserId: string,
  actor: AccessActor,
  bankId: string,
) {
  const { kind, questions } = await loadExportableQuestions(organizationId, actor, bankId);
  const buffer = await buildExportWorkbook(questions, kind);
  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId,
    action: 'bank.export',
    targetType: 'question_bank',
    targetId: bankId,
    metadata: { format: 'xlsx', count: questions.length },
  });
  return buffer;
}

export async function exportQuestionsCsv(
  organizationId: string,
  actorUserId: string,
  actor: AccessActor,
  bankId: string,
) {
  const { kind, questions } = await loadExportableQuestions(organizationId, actor, bankId);
  const csv = buildExportCsv(questions, kind);
  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId,
    action: 'bank.export',
    targetType: 'question_bank',
    targetId: bankId,
    metadata: { format: 'csv', count: questions.length },
  });
  return csv;
}

async function loadExportableQuestions(
  organizationId: string,
  actor: AccessActor,
  bankId: string,
): Promise<{ kind: 'quiz' | 'assessment'; questions: ExportableQuestion[] }> {
  const bank = await prisma.questionBank.findFirst({
    where: { organizationId, id: bankId },
    include: {
      questions: {
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        include: {
          passage: true,
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
  assertBankAccess(actor, bank.kind, 'view');
  return {
    kind: bank.kind,
    questions: bank.questions.map((q) => mapQuestionAdmin(q) as ExportableQuestion),
  };
}
