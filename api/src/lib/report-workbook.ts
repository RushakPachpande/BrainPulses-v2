import { hasSubmittedAnswer, scoreObjective } from '../modules/attempts/scoring.js';
import { formatMarks } from '../modules/quiz-reports/rows.js';
import { createWorkbook } from './excel-workbook.js';

export type ExportQuestion = {
  id: string;
  sortOrder: number;
  code: string;
  question: string;
  type: string;
  points: number;
  answerKey: unknown;
  options: { label: string; body: string; isCorrect: boolean }[];
};

export type AttemptAnswers = {
  startedAt: string;
  disqualified: boolean;
  questionIds: string[];
  answers: Map<string, unknown>;
};

export type ParticipantProfile = {
  course: string | null;
  cohort: string | null;
  city: string | null;
};

export type Timing = {
  durationMode: 'overall' | 'per_question';
  durationMinutes: number | null;
  perQuestionSeconds: number | null;
};

export type NegativeMarking = {
  enabled: boolean;
  penalty: number;
};

export type SummaryHeader = {
  header: string;
  width: number;
};

export type ReportLine = {
  summary: (string | number)[];
  questionIds: string[];
  answers: ReadonlyMap<string, unknown>;
};

export type ReportSheet = {
  sheetName: string;
  negative: NegativeMarking;
  lines: ReportLine[];
};

const IST_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export function formatIst(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const parts = Object.fromEntries(
    IST_FORMATTER.formatToParts(date).map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day} ${hour}:${parts.minute}:${parts.second}`;
}

/** Overall attempt length as HH:MM:SS. Per-question time is not stored. */
export function formatClock(seconds: number | null | undefined): string {
  if (seconds == null) return '';
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(rest)}`;
}

export function allowedTimeLabel(timing: Timing | undefined): string {
  if (!timing) return '';
  if (timing.durationMode === 'per_question') {
    return timing.perQuestionSeconds == null ? '' : `${timing.perQuestionSeconds} s each`;
  }
  return timing.durationMinutes == null ? '' : `${timing.durationMinutes} min`;
}

export function passMarkLabel(
  mode: 'percent' | 'score',
  percent: number | null,
  score: number | null,
): string {
  if (mode === 'score') return score == null ? '' : formatMarks(score);
  return percent == null ? '' : `${formatMarks(percent)}%`;
}

export function attemptsUsedLabel(started: number, allowed: number | null): string {
  const cap = allowed == null ? 'Unlimited' : String(allowed);
  return `${started} of ${cap}`;
}

export function attemptStatusLabel(status: 'completed' | 'in_progress' | 'not_started'): string {
  if (status === 'completed') return 'Completed';
  if (status === 'in_progress') return 'In progress';
  return 'Not started';
}

export function yesNo(value: boolean | null | undefined): string {
  if (value == null) return '';
  return value ? 'Yes' : 'No';
}

export function autoSubmittedLabel(
  value: boolean | null,
  reason: string | null | undefined,
  labels: Record<string, string>,
): string {
  if (value == null) return '';
  if (!value) return 'No';
  if (reason && labels[reason]) return `Yes (${labels[reason]})`;
  return 'Yes';
}

export function blankNumber(value: number | null | undefined): number | '' {
  return value == null ? '' : value;
}

export function sanitizeSheetName(name: string): string {
  const cleaned = name
    .replace(/[\\/*?:[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (cleaned || 'Sheet').slice(0, 31);
}

function uniqueSheetNames(rawNames: string[]): string[] {
  const used = new Map<string, number>();
  return rawNames.map((raw) => {
    const base = sanitizeSheetName(raw);
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    if (count === 1) return base;
    const suffix = ` (${count})`;
    return `${base.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`;
  });
}

/** Round or quiz name, prefixed with the assessment or contest when names collide. */
export function assignSheetNames(items: { name: string; qualifier: string }[]): string[] {
  const bases = items.map((item) => sanitizeSheetName(item.name));
  const frequency = new Map<string, number>();
  for (const base of bases) frequency.set(base, (frequency.get(base) ?? 0) + 1);
  const preferred = items.map((item, index) => {
    const base = bases[index] ?? 'Sheet';
    if ((frequency.get(base) ?? 0) <= 1) return base;
    const qualified = sanitizeSheetName(`${item.qualifier} ${item.name}`);
    return qualified || base;
  });
  return uniqueSheetNames(preferred);
}

function selectedLabels(answer: unknown): string[] {
  if (Array.isArray(answer)) return answer.map(String);
  if (answer && typeof answer === 'object') {
    const obj = answer as Record<string, unknown>;
    if (Array.isArray(obj.labels)) return obj.labels.map(String);
    if (typeof obj.label === 'string' && obj.label.trim()) return [obj.label];
  }
  if (typeof answer === 'string' && answer.trim()) return [answer];
  return [];
}

function freeText(answer: unknown): string | null {
  if (typeof answer === 'string') return answer.trim() || null;
  if (typeof answer === 'number' && Number.isFinite(answer)) return String(answer);
  if (answer && typeof answer === 'object') {
    const obj = answer as Record<string, unknown>;
    if (typeof obj.text === 'string') return obj.text.trim() || null;
    if (typeof obj.value === 'number' || typeof obj.value === 'string') {
      const text = String(obj.value).trim();
      return text || null;
    }
  }
  return null;
}

function choiceText(labels: string[], options: ExportQuestion['options']): string {
  if (labels.length === 0) return '';
  return labels
    .map((label) => {
      const option = options.find((item) => item.label === label);
      return option ? `${label}. ${option.body}` : label;
    })
    .join(', ');
}

export function formatStudentAnswer(
  question: ExportQuestion,
  answer: unknown,
  onPaper: boolean,
): string {
  if (!onPaper) return '';
  if (!hasSubmittedAnswer(question.type, answer)) return 'Not answered';
  const labels = selectedLabels(answer);
  const chosen = choiceText(labels, question.options);
  if (chosen) return chosen;
  return freeText(answer) || 'Answered';
}

export function formatCorrectAnswer(question: ExportQuestion): string {
  if (
    question.type === 'short_text' ||
    question.type === 'long_text' ||
    question.type === 'numeric'
  ) {
    const key = (question.answerKey ?? {}) as { value?: unknown };
    if (key.value === undefined || key.value === null) return '';
    const text = String(key.value).trim();
    return text;
  }
  return question.options
    .filter((option) => option.isCorrect)
    .map((option) => `${option.label}. ${option.body}`)
    .join(', ');
}

/** Blank when the item was not on the paper, skipped, or unscored. */
export function questionMarks(
  question: ExportQuestion,
  answer: unknown,
  onPaper: boolean,
  negative: NegativeMarking,
): number | '' {
  if (!onPaper) return '';
  const earned = scoreObjective(question.type, question.answerKey, answer, question.points);
  if (earned == null) return '';
  if (!hasSubmittedAnswer(question.type, answer)) return '';
  if (earned > 0) return earned;
  if (negative.enabled && negative.penalty > 0) return -negative.penalty;
  return 0;
}

export function orderQuestions(
  ids: string[],
  questions: Map<string, ExportQuestion>,
): ExportQuestion[] {
  const unique = [...new Set(ids)].filter((id) => questions.has(id));
  unique.sort((left, right) => {
    const a = questions.get(left)!;
    const b = questions.get(right)!;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    const code = a.code.localeCompare(b.code);
    if (code !== 0) return code;
    return a.id.localeCompare(b.id);
  });
  return unique.map((id) => questions.get(id)!);
}

function questionHeaders(count: number): SummaryHeader[] {
  const headers: SummaryHeader[] = [];
  for (let index = 1; index <= count; index += 1) {
    headers.push(
      { header: `Q${index} Question Text`, width: 40 },
      { header: `Q${index} Student Answer`, width: 24 },
      { header: `Q${index} Correct Answer`, width: 24 },
      { header: `Q${index} Marks`, width: 12 },
    );
  }
  return headers;
}

export async function writeReportWorkbook(input: {
  summaryHeaders: SummaryHeader[];
  sheets: ReportSheet[];
  questions: Map<string, ExportQuestion>;
  emptySheetName?: string;
}): Promise<Buffer> {
  const workbook = await createWorkbook();
  const sheets =
    input.sheets.length > 0
      ? input.sheets
      : [
          {
            sheetName: input.emptySheetName ?? 'Results',
            negative: { enabled: false, penalty: 0 },
            lines: [],
          },
        ];

  for (const spec of sheets) {
    const ordered = orderQuestions(
      spec.lines.flatMap((line) => line.questionIds),
      input.questions,
    );
    const headers = [...input.summaryHeaders, ...questionHeaders(ordered.length)];
    const sheet = workbook.addWorksheet(sanitizeSheetName(spec.sheetName), {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    const headerRow = sheet.addRow(headers.map((column) => column.header));
    headerRow.font = { bold: true };
    headers.forEach((column, index) => {
      sheet.getColumn(index + 1).width = column.width;
    });
    for (const line of spec.lines) {
      const cells: (string | number)[] = [...line.summary];
      const paper = new Set(line.questionIds);
      for (const question of ordered) {
        const included = paper.has(question.id);
        const answer = line.answers.get(question.id);
        cells.push(
          question.question,
          formatStudentAnswer(question, answer, included),
          formatCorrectAnswer(question),
          questionMarks(question, answer, included, spec.negative),
        );
      }
      sheet.addRow(cells);
    }
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
