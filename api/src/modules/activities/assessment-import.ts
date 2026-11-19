import { writeAudit } from '../../lib/audit.js';
import { badRequest, notFound, unprocessable } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import {
  BANK_IMPORT_COLUMNS,
  BANK_IMPORT_HEADERS,
  claimQuestionRow,
  contentFromPayload,
  decideImportedQuestion,
  duplicateQuestionIssue,
  findQuestionDuplicate,
  formatQuestionImportError,
  newImportQuestionCode,
  questionImageFromAnswerKey,
  questionUpdatePreviewIssue,
  rowToCreatePayload,
  seedSavedQuestion,
  snapshotFromQuestion,
  type BankImportHeader,
  type ImportIssue,
  type QuestionDuplicateHit,
  type QuestionImportUpdate,
} from '../banks/import-export.js';
import { createQuestion } from '../banks/service.js';
import {
  cellText,
  formatImportIssue,
  normalizeHeaderKey,
  type SpreadsheetColumnSpec,
} from '../../lib/spreadsheet-import.js';
import {
  behaviourToJson,
  defaultRoundBehaviour,
  defaultRoundSettings,
} from '../../lib/round-settings.js';
import type { AccessLevel, MembershipRole } from '#prisma';

export const ASSESSMENT_IMPORT_HEADERS = [...BANK_IMPORT_HEADERS, 'round'] as const;
export type AssessmentImportHeader = (typeof ASSESSMENT_IMPORT_HEADERS)[number];

export const ASSESSMENT_IMPORT_COLUMNS: SpreadsheetColumnSpec<AssessmentImportHeader>[] = [
  ...BANK_IMPORT_COLUMNS,
  { key: 'round', aliases: ['Round', 'roundname', 'subject', 'section'] },
];

const FIELD_LABELS: Record<AssessmentImportHeader, string> = {
  type: 'Type',
  question: 'Question',
  points: 'Points',
  optionA: 'Option A',
  optionB: 'Option B',
  optionC: 'Option C',
  optionD: 'Option D',
  optionE: 'Option E',
  optionF: 'Option F',
  correct: 'Correct',
  numericValue: 'Numeric value',
  numericTolerance: 'Numeric tolerance',
  referenceAnswer: 'Reference answer',
  stemImageUrl: 'Stem image URL',
  optionA_imageUrl: 'Option A image',
  optionB_imageUrl: 'Option B image',
  optionC_imageUrl: 'Option C image',
  optionD_imageUrl: 'Option D image',
  optionE_imageUrl: 'Option E image',
  optionF_imageUrl: 'Option F image',
  passageText: 'Passage text',
  round: 'Round',
};

type AccessActor = {
  role: MembershipRole;
  assessmentAccess: AccessLevel;
  quizAccess: AccessLevel;
};

function blankRow(): Record<AssessmentImportHeader, string> {
  const o = {} as Record<AssessmentImportHeader, string>;
  for (const h of ASSESSMENT_IMPORT_HEADERS) o[h] = '';
  return o;
}

function sampleRows(): Record<AssessmentImportHeader, string>[] {
  const rows: Record<AssessmentImportHeader, string>[] = [];

  {
    const r = blankRow();
    r.round = 'Round 1';
    r.type = 'single_mcq';
    r.question = 'Which planet is known as the Red Planet?';
    r.points = '1';
    r.optionA = 'Venus';
    r.optionB = 'Mars';
    r.optionC = 'Jupiter';
    r.optionD = 'Saturn';
    r.correct = 'B';
    rows.push(r);
  }
  {
    const r = blankRow();
    r.round = 'Round 1';
    r.type = 'single_mcq';
    r.question = 'Which of the following is the Taj Mahal?';
    r.points = '1';
    r.optionA_imageUrl = 'https://example.com/taj-mahal.png';
    r.optionB_imageUrl = 'https://example.com/eiffel.png';
    r.optionC_imageUrl = 'https://example.com/colosseum.png';
    r.correct = 'A';
    rows.push(r);
  }
  {
    const r = blankRow();
    r.round = 'Round 1';
    r.type = 'single_mcq';
    r.question = 'What landmark is shown?';
    r.points = '1';
    r.stemImageUrl = 'https://example.com/landmark.png';
    r.optionA = 'Taj Mahal';
    r.optionB = 'Eiffel Tower';
    r.optionC = 'Colosseum';
    r.correct = 'A';
    rows.push(r);
  }
  {
    const r = blankRow();
    r.round = 'Round 1';
    r.type = 'multiple_mcq';
    r.question = 'Select all prime numbers.';
    r.points = '2';
    r.optionA = '2';
    r.optionB = '3';
    r.optionC = '4';
    r.optionD = '5';
    r.correct = 'A,B,D';
    rows.push(r);
  }
  {
    const r = blankRow();
    r.round = 'Round 1';
    r.type = 'true_false';
    r.question = 'The Pacific Ocean is the largest ocean on Earth.';
    r.points = '1';
    r.correct = 'A';
    rows.push(r);
  }
  {
    const r = blankRow();
    r.round = 'Round 2';
    r.type = 'numeric';
    r.question = 'What is 7 × 8?';
    r.points = '1';
    r.numericValue = '56';
    r.numericTolerance = '0';
    rows.push(r);
  }
  {
    const r = blankRow();
    r.round = 'Round 2';
    r.type = 'short_text';
    r.question = 'Name the capital of France.';
    r.points = '1';
    r.referenceAnswer = 'Paris';
    rows.push(r);
  }
  {
    const r = blankRow();
    r.round = 'Round 2';
    r.type = 'long_text';
    r.question = 'Briefly explain photosynthesis.';
    r.points = '3';
    r.referenceAnswer = 'Plants convert light energy into chemical energy.';
    rows.push(r);
  }
  {
    const r = blankRow();
    r.round = 'Round 1';
    r.type = 'comprehension_mcq';
    r.question = 'According to the passage, what color is the fox?';
    r.points = '1';
    r.passageText = 'The quick brown fox jumps over the lazy dog.';
    r.optionA = 'Brown';
    r.optionB = 'Black';
    r.optionC = 'White';
    r.optionD = 'Grey';
    r.correct = 'A';
    rows.push(r);
  }
  {
    const r = blankRow();
    r.round = 'Round 1';
    r.type = 'comprehension_mcq';
    r.question = 'According to the passage, what does the fox jump over?';
    r.points = '1';
    r.passageText = 'The quick brown fox jumps over the lazy dog.';
    r.optionA = 'A dog';
    r.optionB = 'A cat';
    r.optionC = 'A log';
    r.optionD = 'A wall';
    r.correct = 'A';
    rows.push(r);
  }
  return rows;
}

export async function buildAssessmentSampleWorkbook(): Promise<Buffer> {
  const { createWorkbook } = await import('../../lib/excel-workbook.js');
  const workbook = await createWorkbook();
  const instructions = workbook.addWorksheet('Instructions');
  instructions.addRow(['BrainPulses assessment question import']);
  instructions.addRow([]);
  instructions.addRow([
    '1. Fill the Questions sheet. Keep the Round column so each question lands in the right round.',
  ]);
  instructions.addRow([
    '2. Delete the example rows before you import, or those examples will be created.',
  ]);
  instructions.addRow(['3. Missing round names are created automatically on the assessment.']);
  instructions.addRow([
    '4. Types: single_mcq, multiple_mcq, true_false, numeric, short_text, long_text, comprehension_mcq.',
  ]);
  instructions.addRow([
    '5. Choice questions may include a stem image (stemImageUrl) and option images (optionA_imageUrl and so on). Question text may be blank only when stemImageUrl is set.',
  ]);
  instructions.addRow([
    '6. comprehension_mcq needs passageText on every row. Rows with the same passage text share one passage.',
  ]);
  instructions.addRow([
    '7. A row is skipped when that question text is already in the same round and the row matches the saved question. If the options, answer, points, or type differ, import asks you to confirm the update. The same text in a different round is still imported.',
  ]);
  instructions.getColumn(1).width = 100;

  const questions = workbook.addWorksheet('Questions');
  questions.addRow([...ASSESSMENT_IMPORT_HEADERS]);
  for (const row of sampleRows()) {
    questions.addRow(ASSESSMENT_IMPORT_HEADERS.map((h) => row[h] ?? ''));
  }
  questions.getRow(1).font = { bold: true };
  ASSESSMENT_IMPORT_HEADERS.forEach((header, index) => {
    questions.getColumn(index + 1).width = Math.min(36, Math.max(12, header.length + 2));
  });

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

function buildAliasMap(): Map<string, AssessmentImportHeader> {
  const map = new Map<string, AssessmentImportHeader>();
  for (const col of ASSESSMENT_IMPORT_COLUMNS) {
    const keys = new Set([
      normalizeHeaderKey(col.key),
      ...(col.aliases ?? []).map((a) => normalizeHeaderKey(a)),
    ]);
    for (const key of keys) {
      if (key) map.set(key, col.key);
    }
  }
  return map;
}

export type ColumnMapping = Partial<Record<AssessmentImportHeader, string | null>>;

export type AssessmentImportPreview = {
  headers: string[];
  mapping: ColumnMapping;
  fields: { key: AssessmentImportHeader; label: string }[];
  issues: ImportIssue[];
  validCount: number;
  updateCount: number;
  totalRows: number;
  rows: Array<Record<AssessmentImportHeader, string> & { sheetRow: number }>;
};

function applyMapping(
  rawHeaders: string[],
  dataRows: string[][],
  mapping: ColumnMapping,
): Array<Record<AssessmentImportHeader, string> & { sheetRow: number }> {
  const headerIndex = new Map<string, number>();
  rawHeaders.forEach((h, i) => {
    if (h.trim()) headerIndex.set(h.trim(), i);
  });

  return dataRows.map((cells, index) => {
    const row = { sheetRow: index + 2 } as Record<AssessmentImportHeader, string> & {
      sheetRow: number;
    };
    for (const key of ASSESSMENT_IMPORT_HEADERS) {
      const headerName = mapping[key];
      if (!headerName) {
        row[key] = '';
        continue;
      }
      const col = headerIndex.get(headerName);
      row[key] = col == null ? '' : String(cells[col] ?? '').trim();
    }
    return row;
  });
}

function autoMapping(rawHeaders: string[]): ColumnMapping {
  const aliasMap = buildAliasMap();
  const mapping: ColumnMapping = {};
  for (const key of ASSESSMENT_IMPORT_HEADERS) mapping[key] = null;
  for (const header of rawHeaders) {
    const trimmed = header.trim();
    if (!trimmed) continue;
    const key = aliasMap.get(normalizeHeaderKey(trimmed));
    if (key && !mapping[key]) mapping[key] = trimmed;
  }
  return mapping;
}

async function readWorkbookRows(
  buffer: Buffer,
): Promise<{ headers: string[]; dataRows: string[][] }> {
  const { loadWorkbook } = await import('../../lib/excel-workbook.js');
  const workbook = await loadWorkbook(buffer);
  const sheet =
    workbook.getWorksheet('Questions') ??
    workbook.worksheets.find((s) => s.name.toLowerCase().includes('question')) ??
    workbook.worksheets[0];
  if (!sheet) {
    throw unprocessable(
      'The file has no worksheet. Open it in Excel, keep one sheet with a header row, save as .xlsx, and try again.',
    );
  }

  const matrix: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cells[col - 1] = cellText(cell.value);
    });
    matrix.push(cells.map((c) => c ?? ''));
  });
  if (matrix.length < 2) {
    throw unprocessable(
      'No questions found in the file. Row 1 should be the column names, and the questions should start on the next row. Download Sample Excel if you need the layout.',
    );
  }

  const headers = (matrix[0] ?? []).map((h) => h.trim());
  const dataRows = matrix.slice(1).filter((row) => row.some((c) => String(c).trim()));
  if (dataRows.length === 0) {
    throw unprocessable(
      'No questions found in the file. The header row is there, but every row under it is empty. Add your questions, or download Sample Excel and replace the examples.',
    );
  }
  return { headers, dataRows };
}

function validateMappedRows(
  rows: Array<Record<AssessmentImportHeader, string> & { sheetRow: number }>,
): { issues: ImportIssue[]; valid: typeof rows } {
  const issues: ImportIssue[] = [];
  const valid: typeof rows = [];
  for (const row of rows) {
    if (!row.question.trim() && !row.type.trim()) continue;
    if (!row.round.trim()) {
      issues.push({
        row: row.sheetRow,
        message: formatImportIssue({
          sheetRow: row.sheetRow,
          column: 'Round',
          value: row.round,
          problem: row.question.trim()
            ? `for “${row.question.trim().slice(0, 60)}”, every question needs a round name`
            : 'every question needs a round name so it lands in the right round',
          expected: 'the round name. A name that does not exist yet is created on the assessment',
          example: 'Round 1',
        }),
      });
      continue;
    }
    const { round: _round, ...bankFields } = row;
    void _round;
    const bankRow = { ...bankFields, sheetRow: row.sheetRow } as Record<
      BankImportHeader,
      string
    > & {
      sheetRow: number;
    };
    for (const h of BANK_IMPORT_HEADERS) {
      if (bankRow[h] === undefined) bankRow[h] = '';
    }
    try {
      rowToCreatePayload(bankRow, 'assessment');
      valid.push(row);
    } catch (err) {
      issues.push({
        row: row.sheetRow,
        message: formatQuestionImportError(bankRow, 'assessment', err),
      });
    }
  }
  return { issues, valid };
}

async function loadRoundQuestionSeen(
  organizationId: string,
  activityId: string,
  roundNames: string[],
): Promise<Map<string, QuestionDuplicateHit>> {
  const seen = new Map<string, QuestionDuplicateHit>();
  const wanted = new Set(
    roundNames
      .map((name) => name.trim().replace(/\s+/g, ' ').toLowerCase())
      .filter((name) => name.length > 0),
  );
  if (wanted.size === 0) return seen;

  const rounds = await prisma.activityRound.findMany({
    where: { organizationId, activityId, localBankId: { not: null } },
    select: { name: true, localBankId: true },
  });
  const matched = rounds.filter((round) =>
    wanted.has(round.name.trim().replace(/\s+/g, ' ').toLowerCase()),
  );
  const bankIds = matched.flatMap((round) => (round.localBankId ? [round.localBankId] : []));
  if (bankIds.length === 0) return seen;

  const questions = await prisma.question.findMany({
    where: { organizationId, bankId: { in: bankIds } },
    select: {
      id: true,
      bankId: true,
      type: true,
      question: true,
      points: true,
      passage: { select: { body: true } },
      versions: {
        orderBy: { version: 'desc' },
        take: 1,
        select: {
          answerKey: true,
          options: {
            orderBy: { sortOrder: 'asc' },
            select: { label: true, body: true, isCorrect: true, imageUrl: true },
          },
        },
      },
    },
  });
  const roundNameByBank = new Map(
    matched.flatMap((round) =>
      round.localBankId ? [[round.localBankId, round.name] as const] : [],
    ),
  );
  for (const question of questions) {
    const roundName = roundNameByBank.get(question.bankId);
    if (!roundName) continue;
    seedSavedQuestion(seen, {
      question: question.question,
      stemImageUrl: questionImageFromAnswerKey(question.versions[0]?.answerKey),
      roundName,
      where: { source: 'round', roundName, saved: snapshotFromQuestion(question) },
    });
  }
  return seen;
}

function assessmentBankRow(
  row: Record<AssessmentImportHeader, string> & { sheetRow: number },
): Record<BankImportHeader, string> & { sheetRow: number } {
  const { round: _round, ...bankFields } = row;
  void _round;
  const bankRow = { ...bankFields, sheetRow: row.sheetRow } as Record<BankImportHeader, string> & {
    sheetRow: number;
  };
  for (const header of BANK_IMPORT_HEADERS) {
    if (bankRow[header] === undefined) bankRow[header] = '';
  }
  return bankRow;
}

export async function previewAssessmentImport(
  buffer: Buffer,
  mappingOverride?: ColumnMapping,
  scope?: { organizationId: string; activityId: string },
): Promise<AssessmentImportPreview> {
  const { headers, dataRows } = await readWorkbookRows(buffer);
  const mapping = mappingOverride
    ? { ...autoMapping(headers), ...mappingOverride }
    : autoMapping(headers);
  const rows = applyMapping(headers, dataRows, mapping);
  const { issues, valid } = validateMappedRows(rows);
  let readyCount = 0;
  let updateCount = 0;
  const duplicateIssues: ImportIssue[] = [];
  if (scope && valid.length > 0) {
    const seen = await loadRoundQuestionSeen(
      scope.organizationId,
      scope.activityId,
      valid.map((row) => row.round),
    );
    for (const row of valid) {
      const bankRow = assessmentBankRow(row);
      const payload = rowToCreatePayload(bankRow, 'assessment');
      const hit = findQuestionDuplicate(seen, {
        question: row.question,
        stemImageUrl: row.stemImageUrl,
        roundName: row.round,
      });
      const decision = decideImportedQuestion(hit, contentFromPayload(payload));
      if (decision.action === 'create') {
        readyCount += 1;
        claimQuestionRow(seen, {
          sheetRow: row.sheetRow,
          question: row.question,
          stemImageUrl: row.stemImageUrl,
          roundName: row.round,
        });
        continue;
      }
      if (decision.action === 'update' && hit) {
        updateCount += 1;
        duplicateIssues.push(
          questionUpdatePreviewIssue(
            row.sheetRow,
            row.question,
            row.stemImageUrl,
            hit,
            decision.changes,
          ),
        );
        claimQuestionRow(seen, {
          sheetRow: row.sheetRow,
          question: row.question,
          stemImageUrl: row.stemImageUrl,
          roundName: row.round,
        });
      } else {
        duplicateIssues.push(
          duplicateQuestionIssue(
            row.sheetRow,
            row.question,
            row.stemImageUrl,
            hit ?? { source: 'bank' },
          ),
        );
      }
    }
  } else {
    readyCount = valid.length;
  }
  return {
    headers,
    mapping,
    fields: ASSESSMENT_IMPORT_HEADERS.map((key) => ({ key, label: FIELD_LABELS[key] })),
    issues: [...issues, ...duplicateIssues],
    validCount: readyCount,
    updateCount,
    totalRows: rows.filter((r) => r.question.trim() || r.type.trim()).length,
    rows,
  };
}

async function ensureRoundLocalBank(
  organizationId: string,
  activityId: string,
  roundName: string,
  actor: AccessActor,
  actorUserId: string,
) {
  const existing = await prisma.activityRound.findFirst({
    where: {
      organizationId,
      activityId,
      name: { equals: roundName, mode: 'insensitive' },
    },
    include: { localBank: true },
  });
  if (existing?.localBankId) return existing;

  if (existing) {
    const bank = await prisma.questionBank.create({
      data: {
        organizationId,
        kind: 'assessment',
        origin: 'round_local',
        name: `${roundName} questions`,
        code: `RL-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        presentation: 'one_at_a_time',
      },
    });
    return prisma.activityRound.update({
      where: { id: existing.id },
      data: { localBankId: bank.id },
      include: { localBank: true },
    });
  }

  const maxOrder = await prisma.activityRound.aggregate({
    where: { organizationId, activityId },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
  const bank = await prisma.questionBank.create({
    data: {
      organizationId,
      kind: 'assessment',
      origin: 'round_local',
      name: `${roundName} questions`,
      code: `RL-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      presentation: 'one_at_a_time',
    },
  });
  void actor;
  void actorUserId;
  return prisma.activityRound.create({
    data: {
      organizationId,
      activityId,
      name: roundName,
      sortOrder,
      durationMinutes: defaultRoundSettings.durationMinutes,
      durationMode: 'overall',
      presentation: 'one_at_a_time',
      passMode: 'percent',
      passingPercent: 40,
      settings: behaviourToJson(defaultRoundBehaviour),
      localBankId: bank.id,
    },
    include: { localBank: true },
  });
}

export async function confirmAssessmentImport(
  organizationId: string,
  actor: AccessActor,
  actorUserId: string,
  activityId: string,
  buffer: Buffer,
  mappingOverride?: ColumnMapping,
) {
  const activity = await prisma.activity.findFirst({
    where: { organizationId, id: activityId, kind: 'assessment' },
  });
  if (!activity) throw notFound('Assessment not found.');
  if (activity.status !== 'draft' && activity.status !== 'active') {
    throw badRequest('Questions can only be imported while the assessment is draft or active.');
  }

  const preview = await previewAssessmentImport(buffer, mappingOverride, {
    organizationId,
    activityId,
  });
  if (preview.validCount === 0 && preview.updateCount === 0) {
    throw unprocessable(
      preview.issues[0]?.message ??
        'No valid question rows to import. Fix the listed errors first.',
    );
  }

  const { issues: validationIssues, valid } = validateMappedRows(preview.rows);
  let imported = 0;
  let seq = 0;
  const passageCaches = new Map<string, Map<string, string>>();
  const roundCache = new Map<string, Awaited<ReturnType<typeof ensureRoundLocalBank>>>();
  const seen = await loadRoundQuestionSeen(
    organizationId,
    activityId,
    valid.map((row) => row.round),
  );
  const duplicateIssues: ImportIssue[] = [];
  const updates: QuestionImportUpdate[] = [];
  for (const row of valid) {
    const bankRow = assessmentBankRow(row);
    const parsed = rowToCreatePayload(bankRow, 'assessment');
    const hit = findQuestionDuplicate(seen, {
      question: row.question,
      stemImageUrl: row.stemImageUrl,
      roundName: row.round,
    });
    const decision = decideImportedQuestion(hit, contentFromPayload(parsed));
    if (decision.action === 'skip-sheet' || decision.action === 'skip-unchanged') {
      duplicateIssues.push(
        duplicateQuestionIssue(
          row.sheetRow,
          row.question,
          row.stemImageUrl,
          hit ?? { source: 'bank' },
        ),
      );
      continue;
    }
    if (decision.action === 'update') {
      const roundName = row.round.trim();
      let round = roundCache.get(roundName);
      if (!round) {
        round = await ensureRoundLocalBank(
          organizationId,
          activityId,
          roundName,
          actor,
          actorUserId,
        );
        roundCache.set(roundName, round);
      }
      if (!round.localBankId) throw badRequest('Could not create a local bank for the round.');
      updates.push({
        questionId: decision.questionId,
        bankId: round.localBankId,
        sheetRow: row.sheetRow,
        question: parsed.question.trim() || row.stemImageUrl.trim(),
        roundName: decision.roundName,
        changes: decision.changes,
        payload: parsed,
      });
      claimQuestionRow(seen, {
        sheetRow: row.sheetRow,
        question: row.question,
        stemImageUrl: row.stemImageUrl,
        roundName: row.round,
      });
      continue;
    }
    const roundName = row.round.trim();
    let round = roundCache.get(roundName);
    if (!round) {
      round = await ensureRoundLocalBank(organizationId, activityId, roundName, actor, actorUserId);
      roundCache.set(roundName, round);
    }
    if (!round.localBankId) throw badRequest('Could not create a local bank for the round.');
    seq += 1;
    const passageCache = passageCaches.get(round.localBankId) ?? new Map<string, string>();
    passageCaches.set(round.localBankId, passageCache);
    await createQuestion(
      organizationId,
      actorUserId,
      actor,
      round.localBankId,
      {
        ...parsed,
        code: newImportQuestionCode(row.sheetRow, seq),
      },
      passageCache,
      {
        bank: { id: round.localBankId, kind: 'assessment' },
        skipAudit: true,
      },
    );
    claimQuestionRow(seen, {
      sheetRow: row.sheetRow,
      question: row.question,
      stemImageUrl: row.stemImageUrl,
      roundName: row.round,
    });
    imported += 1;
  }

  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId,
    action: 'activity.import_questions',
    targetType: 'activity',
    targetId: activityId,
  });

  const issues = [...validationIssues, ...duplicateIssues];
  return {
    imported,
    skipped: issues.length,
    issues,
    updates,
  };
}
