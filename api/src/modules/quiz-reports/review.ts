import type { Prisma } from '#prisma';
import { blocksFromItems } from '../../lib/question-order.js';
import { hasSubmittedAnswer, scoreObjective, toNumber } from '../attempts/scoring.js';
import type { ScoreBreakdown } from './rows.js';

export type ReviewOption = {
  label: string;
  body: string;
  isCorrect: boolean;
};

export type ReviewVersion = {
  id: string;
  question: string;
  type: string;
  points: Prisma.Decimal | number;
  answerKey: Prisma.JsonValue;
  passageId: string | null;
  passageText: string | null;
  options: ReviewOption[];
};

export type ReviewQuestion = {
  questionVersionId: string;
  number: number;
  question: string;
  marks: number;
  answered: boolean;
  answerText: string;
  correct: boolean | null;
  correctText: string | null;
};

export type ReviewGroup = {
  passage: string | null;
  questions: ReviewQuestion[];
};

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

function choiceText(labels: string[], options: ReviewOption[]): string {
  if (labels.length === 0) return '';
  return labels
    .map((label) => {
      const option = options.find((item) => item.label === label);
      return option ? `${label}. ${option.body}` : label;
    })
    .join(', ');
}

export function buildAttemptReview(
  order: string[],
  responses: { questionVersionId: string; answer: unknown }[],
  versions: ReviewVersion[],
  negative: { enabled: boolean; penalty: number },
): { summary: ScoreBreakdown; groups: ReviewGroup[] } {
  const byId = new Map(versions.map((version) => [version.id, version]));
  const answers = new Map(
    responses.map((response) => [response.questionVersionId, response.answer]),
  );
  const ids = order.length > 0 ? order : responses.map((response) => response.questionVersionId);
  const questions: ReviewQuestion[] = [];
  let correct = 0;
  let wrong = 0;
  let skipped = 0;
  let negativeMarks = 0;

  ids.forEach((id, index) => {
    const version = byId.get(id);
    if (!version) return;
    const answer = answers.get(id);
    const points = toNumber(version.points);
    const earned = scoreObjective(version.type, version.answerKey, answer, points);
    const answered = hasSubmittedAnswer(version.type, answer);
    const labels = selectedLabels(answer);
    const answerText = answered
      ? choiceText(labels, version.options) || freeText(answer) || 'Answered'
      : 'Not answered';
    let marks = 0;
    let isCorrect: boolean | null;
    if (earned == null) {
      isCorrect = null;
    } else if (!answered) {
      skipped += 1;
      isCorrect = false;
    } else if (earned > 0) {
      correct += 1;
      marks = earned;
      isCorrect = true;
    } else {
      wrong += 1;
      isCorrect = false;
      if (negative.enabled && negative.penalty > 0) {
        marks = -negative.penalty;
        negativeMarks += negative.penalty;
      }
    }
    const correctLabels = version.options
      .filter((option) => option.isCorrect)
      .map((option) => option.label);
    questions.push({
      questionVersionId: version.id,
      number: index + 1,
      question: version.question,
      marks,
      answered,
      answerText,
      correct: isCorrect,
      correctText:
        isCorrect === false && correctLabels.length > 0
          ? choiceText(correctLabels, version.options)
          : null,
    });
  });

  const items = questions.map((question, index) => {
    const version = byId.get(question.questionVersionId);
    return {
      id: question.questionVersionId,
      passageId: version?.passageId ?? null,
      sortOrder: index,
    };
  });
  const blocks = blocksFromItems(items);
  const byQuestion = new Map(questions.map((question) => [question.questionVersionId, question]));
  const groups: ReviewGroup[] = blocks.map((block) => {
    const first = byId.get(block[0]?.id ?? '');
    const passage = first?.passageId && block.length > 0 ? first.passageText?.trim() || null : null;
    return {
      passage: block.length > 1 || first?.passageId ? passage : null,
      questions: block.flatMap((item) => {
        const question = byQuestion.get(item.id);
        return question ? [question] : [];
      }),
    };
  });

  return {
    summary: { correct, wrong, skipped, negative: negativeMarks },
    groups,
  };
}
